#!/usr/bin/env python3
"""Pinned isolated fixes; no row rewrites or trigger activation."""
from pathlib import Path
import hashlib
import importlib.util
import os
import re
import time
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('audit',ROOT/'scripts/rehearsal-pay-audit-runner.py')
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
ARCHIVE=audit.ARCHIVE
PINS={'20261019233000_safety_notification_recipient_dedup.sql': 'b6422f98b88c6adca552dc25bbd171875edeb6c332657cc3e8f9726fe2ff526e', '20261020001000_contact_sync_effective_changes.sql': '6c9984ab607e779e1a2c4ab66a6fb7d519a39ec5f7a1e5689cdec24d192befbc', '20261020001100_job_contact_seed_duplicates.sql': '5c35f7ded2fc0cb615fb2d74e7ad009589d799ade7ecc093263fd5332b2a0c8c'}
OLD={'notify_safety_violation': '15eadb4c7f04b8237d80dc1053be811e', 'seed_job_contact_slots': 'fa703e43e47afa556b200da465718ac5'}
NEW={'notify_safety_violation': '85d0c1902cb505f4852baf5772d0920f', 'seed_job_contact_slots': '539fe70b792aea57e771962f37daad30'}

def function_check(hashes):
    sql=''
    for name,digest in hashes.items():
        args='uuid' if name=='seed_job_contact_slots' else ''
        sql+=f"""DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.{name}({args})'::regprocedure AND md5(prosrc)='{digest}' AND prosecdef AND proconfig=ARRAY['search_path=public'] AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')) THEN RAISE EXCEPTION 'Function baseline mismatch; reconcile before retry'; END IF;
END $$;
"""
    return sql

def core(source,parts):
    if hashlib.sha256(source.encode()).hexdigest()!=audit.PIN:raise ValueError('Trigger artifact changed')
    for name,pin in PINS.items():
        if hashlib.sha256(parts[name].encode()).hexdigest()!=pin:raise ValueError('Candidate changed')
    inventory=re.findall(r'^CREATE TRIGGER (\w+) .*? ON public\.(\w+) .*?EXECUTE FUNCTION public\.(\w+)\(\);$',source,re.M)
    if len(inventory)!=70:raise ValueError('Unexpected inventory')
    state=audit.state_check(inventory,True)
    original=next(x for x in source.splitlines() if x.startswith('CREATE TRIGGER trg_sync_contact_to_profile ')).rstrip(';').replace('public.','')
    sql=state+function_check(OLD)+f"""
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.employee_contacts'::regclass AND tgname='trg_sync_contact_to_profile' AND replace(pg_get_triggerdef(oid),'public.','')='{original}') THEN RAISE EXCEPTION 'Contact trigger baseline mismatch'; END IF;
END $$;
LOCK TABLE public.job_contact_template_slots IN SHARE MODE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.job_contact_template_slots WHERE is_active GROUP BY category,role_label,COALESCE(material,'') HAVING count(DISTINCT (COALESCE(default_name,''),sort_order))>1) THEN RAISE EXCEPTION 'Conflicting templates require review'; END IF;
END $$;
CREATE TEMP TABLE behavior_acl_before ON COMMIT DROP AS SELECT oid,proacl FROM pg_proc WHERE oid IN ('public.notify_safety_violation()'::regprocedure,'public.seed_job_contact_slots(uuid)'::regprocedure);
"""
    sql+='\n'.join(parts[n] for n in PINS)
    sql+=state+function_check(NEW)+"""
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM behavior_acl_before b JOIN pg_proc p ON p.oid=b.oid WHERE p.proacl IS DISTINCT FROM b.proacl) THEN RAISE EXCEPTION 'Function permissions changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.employee_contacts'::regclass AND tgname='trg_sync_contact_to_profile' AND tgenabled='D' AND tgtype=17 AND tgattr::text='' AND tgqual IS NOT NULL AND tgfoid='public.sync_contact_to_profile()'::regprocedure) THEN RAISE EXCEPTION 'Disabled contact trigger mismatch'; END IF;
END $$;
SELECT 'PASS: three behavior fixes installed; 56 triggers active and 14 still disabled; keep access OFF' AS result;
"""
    return sql

if __name__=='__main__':
    os.umask(0o077)
    parts={n:(ROOT/'local/candidate-migrations'/n).read_text() for n in PINS}
    sql=audit.ISOLATION.replace('19761019,16','19761019,17')+core((ARCHIVE/'behavior-review/public-triggers-disabled.sql').read_text(),parts)
    out=ARCHIVE/f'behavior-fixes-run-{time.time_ns()}'
    out.mkdir(mode=0o700)
    (out/'install.sql').write_text(sql)
    print(out)
