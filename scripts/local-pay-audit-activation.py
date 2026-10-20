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
before=query(fingerprint)
setup="""BEGIN; SELECT pg_advisory_xact_lock(19761019,99);
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT c.relname,t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal LOOP
 EXECUTE format('DROP TRIGGER %I ON public.%I',r.tgname,r.relname);
 END LOOP;
END $$;
"""+source
ready=setup+timestamps.core(source)+prior.core(source)
print(query(ready+validation.core(source)+'ROLLBACK;'))
for sql,expected in [
    (setup+validation.core(source),'Trigger state mismatch'),
    (ready+validation.core(source)+validation.core(source),'Trigger state mismatch'),
    (ready+"ALTER FUNCTION public.log_pay_change() SECURITY INVOKER;"+validation.core(source),'Pay-audit function changed'),
    (ready+"DROP TRIGGER audit_employee_benefits ON public.employee_benefits; CREATE TRIGGER audit_employee_benefits AFTER INSERT ON public.employee_benefits FOR EACH ROW EXECUTE FUNCTION public.log_pay_change(); ALTER TABLE public.employee_benefits DISABLE TRIGGER audit_employee_benefits;"+validation.core(source),'Pay-audit trigger definition changed')]:
    try:
        query(sql+'ROLLBACK;')
        raise AssertionError('Invalid activation accepted')
    except RuntimeError as error:
        assert expected in str(error),str(error)
try:
    validation.core(source+'\n')
    raise AssertionError('Tampered source accepted')
except ValueError:pass
assert query(fingerprint)==before
print('PASS: activation core/postcheck; wrong prior state, repeat, changed function security, changed trigger timing and tampered artifact rejected; rollback restored local triggers.')
print('Hosted isolation preflight remains mandatory; not simulated by this local test.')
