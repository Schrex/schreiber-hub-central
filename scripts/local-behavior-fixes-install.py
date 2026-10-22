#!/usr/bin/env python3
"""Rollback-only exact activation-core checks in synthetic local Docker."""
from pathlib import Path
import importlib.util
import subprocess

ROOT=Path(__file__).resolve().parent

def load(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/(name+'.py'))
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def query(sql):
    result=subprocess.run(['docker','exec','-i','supabase_db_schreiber-local','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres'],input=sql,text=True,capture_output=True)
    if result.returncode:raise RuntimeError(result.stderr)
    return result.stdout.strip()

validation=load('rehearsal-pay-audit-runner')
prior=load('rehearsal-validation-runner')
timestamps=load('rehearsal-timestamps-runner')
source=(validation.ARCHIVE/'behavior-review/public-triggers-disabled.sql').read_text()
fingerprint="SELECT md5(string_agg(oid||':'||tgenabled::text,',' ORDER BY oid)) FROM pg_trigger;"
function_fingerprint="SELECT md5(string_agg(oid||':'||md5(prosrc)||':'||coalesce(proacl::text,'')||':'||prosecdef::text,',' ORDER BY oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace;"
before=query(fingerprint)
functions_before=query(function_fingerprint)
setup="""BEGIN; SELECT pg_advisory_xact_lock(19761019,99);
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT c.relname,t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal LOOP
 EXECUTE format('DROP TRIGGER %I ON public.%I',r.tgname,r.relname);
 END LOOP;
END $$;
"""+source
ready=setup+timestamps.core(source)+prior.core(source)
fixes=load('rehearsal-behavior-fixes-runner')
parts={n:(ROOT.parent/'local/candidate-migrations'/n).read_text() for n in fixes.PINS}
ready+=validation.core(source)
payload=fixes.core(source,parts)
print(query(ready+payload+'ROLLBACK;'))
for sql,expected in [
 (ready+payload+payload,'Function baseline mismatch'),
 (ready+"ALTER FUNCTION public.notify_safety_violation() SECURITY INVOKER;"+payload,'Function baseline mismatch'),
 (ready+"INSERT INTO public.job_contact_template_slots(category,role_label,material,default_name,sort_order,is_active) VALUES ('guard-probe','role',NULL,'First',1,true),('guard-probe','role',NULL,'Second',1,true);"+payload,'Conflicting templates require review')]:
 try:
  query(sql+'ROLLBACK;')
  raise AssertionError('Invalid install accepted')
 except RuntimeError as error:
  assert expected in str(error),str(error)
changed=dict(parts);name=next(iter(changed));changed[name]+='\n'
try:
 fixes.core(source,changed)
 raise AssertionError('Tamper accepted')
except ValueError:pass
assert query(fingerprint)==before
assert query(function_fingerprint)==functions_before
print('PASS fixes core/postchecks; repeat, security drift, conflicting templates, tamper rejected; trigger state restored. Hosted isolation guards not simulated.')
