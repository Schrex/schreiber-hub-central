#!/usr/bin/env python3
"""Build guarded five-trigger activation for the fixed isolated rehearsal."""
from pathlib import Path
import hashlib
import os
import re
import time
ARCHIVE = Path('/Users/sumanththota/Schrex/archive/database-2026-10-19')
PIN = '995142ef62107a6a32d73cc6e723d56704d1e51c338ff1afc948627b276086e8'
FUNCTION_PINS = {'validate_comp_history': '6f02bf25608c1633a30be83a3917293e', 'validate_employee_benefit': '45d94e0f49252b0abea21634c2703fe5', 'validate_employee_position': 'a1ad72f8fd95733139f7066999f6968d', 'validate_equipment_rental': 'ca3e58850ab9ab669c2dffcb4839c81d'}
ISOLATION = "\nSET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='2min';\nSELECT pg_advisory_xact_lock(19761019,15);\nDO $guard$ BEGIN\n IF current_user<>'postgres' OR current_database()<>'postgres' THEN RAISE EXCEPTION 'Wrong database role'; END IF;\n IF EXISTS(SELECT 1 FROM auth.sessions) OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal) THEN RAISE EXCEPTION 'Auth isolation mismatch'; END IF;\n IF EXISTS(SELECT 1 FROM pg_extension WHERE extname IN ('pg_cron','pg_net','pgmq')) OR EXISTS(SELECT 1 FROM storage.buckets WHERE public) OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage') THEN RAISE EXCEPTION 'Isolation mismatch'; END IF;\n IF has_schema_privilege('anon','public','USAGE') OR has_schema_privilege('authenticated','public','CREATE') OR NOT has_schema_privilege('authenticated','public','USAGE') THEN RAISE EXCEPTION 'Reviewed grants missing or changed'; END IF;\nEND $guard$;\n"

def state_check(inventory, activated):
    values = ','.join("('%s','%s','%s','%s')" % (table,name,fn,'O' if fn=='update_updated_at_column' or (activated and fn in FUNCTION_PINS) else 'D') for name,table,fn in inventory)
    return """DO $state$ BEGIN
 IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal)<>70 OR
 (SELECT count(*) FROM (VALUES %s) e(tbl,trg,fn,state) JOIN pg_class c ON c.relname=e.tbl AND c.relnamespace='public'::regnamespace JOIN pg_trigger t ON t.tgrelid=c.oid AND t.tgname=e.trg JOIN pg_proc p ON p.oid=t.tgfoid WHERE p.pronamespace='public'::regnamespace AND p.proname=e.fn AND t.tgenabled::text=e.state AND NOT t.tgisinternal)<>70 THEN RAISE EXCEPTION 'Trigger state mismatch; reconcile before retry'; END IF;
END $state$;
""" % values

def core(source):
    if hashlib.sha256(source.encode()).hexdigest()!=PIN:
        raise ValueError('Reviewed trigger artifact changed')
    inventory=re.findall(r'^CREATE TRIGGER (\w+) .*? ON public\.(\w+) .*?EXECUTE FUNCTION public\.(\w+)\(\);$',source,re.M)
    targets=[x for x in inventory if x[2] in FUNCTION_PINS]
    if len(inventory)!=70 or len(targets)!=5 or len(set(inventory))!=70:
        raise ValueError('Unexpected trigger inventory')
    sql=state_check(inventory,False)
    for name, digest in FUNCTION_PINS.items():
        sql+="""DO $fn$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.%s()'::regprocedure AND md5(prosrc)='%s' AND NOT prosecdef AND proconfig=ARRAY['search_path=public'] AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND prorettype='trigger'::regtype AND prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')) THEN RAISE EXCEPTION 'Validation function changed'; END IF;
END $fn$;
""" % (name,digest)
    for name,table,fn in targets:
        sql+="""DO $def$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.oid='public.%s'::regclass AND t.tgname='%s' AND t.tgfoid='public.%s()'::regprocedure AND t.tgtype=23 AND t.tgnargs=0 AND t.tgqual IS NULL AND t.tgattr::text='' AND NOT t.tgisinternal AND c.relrowsecurity AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname='postgres')) THEN RAISE EXCEPTION 'Validation trigger definition changed'; END IF;
END $def$;
""" % (table,name,fn)
    sql+='\n'.join(f'ALTER TABLE public.{table} ENABLE TRIGGER {name};' for name,table,fn in targets)
    return sql+'\n'+state_check(inventory,True)+"SELECT 'PASS: 48 timestamp and 5 validation triggers active; 17 remain disabled' AS result;\n"

if __name__=='__main__':
    os.umask(0o077)
    sql=ISOLATION+core((ARCHIVE/'behavior-review/public-triggers-disabled.sql').read_text())
    out=ARCHIVE/f'validation-run-{time.time_ns()}'
    out.mkdir(mode=0o700)
    (out/'install.sql').write_text(sql)
    print(out)
