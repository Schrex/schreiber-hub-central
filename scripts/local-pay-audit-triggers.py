#!/usr/bin/env python3
"""Rollback-only synthetic tests of source pay-audit bindings, fixed local Docker.
Full-shape temporary tables isolate auditing from business RLS/FKs/other triggers.
The real public audit sink and profile lookup are exercised; no hosted access.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ARCHIVE = Path('/Users/sumanththota/Schrex/archive/database-2026-10-19')

def literal(value):
    return "'" + value.replace("'", "''") + "'"

def query(sql):
    result = subprocess.run(['docker', 'exec', '-i', 'supabase_db_schreiber-local', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', 'postgres'], input=sql, text=True, capture_output=True)
    if result.returncode:
        # Statements contain only synthetic fixtures, never exported rows.
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

source = (ARCHIVE / 'inspection/schema.sql').read_text()
triggers = (ARCHIVE / 'behavior-review/public-triggers-disabled.sql').read_text()
assert hashlib.sha256(triggers.encode()).hexdigest() == '995142ef62107a6a32d73cc6e723d56704d1e51c338ff1afc948627b276086e8'
body = re.search(r'CREATE FUNCTION public.log_pay_change\(\).*?AS \$\$(.*?)\$\$;', source, re.S)[1]
bindings = re.findall(r'^CREATE TRIGGER (\w+) AFTER INSERT OR DELETE OR UPDATE ON public\.(\w+) FOR EACH ROW EXECUTE FUNCTION public.log_pay_change\(\);$', triggers, re.M)
assert len(bindings) == 3
actor = 'c6eab83a-4000-4000-8000-000000000001'
subject = 'c6eab83a-4000-4000-8000-000000000002'
record = 'c6eab83a-4000-4000-8000-000000000003'
ref = 'c6eab83a-4000-4000-8000-000000000004'
sql = f"""BEGIN;
SELECT pg_advisory_xact_lock(19761019,99);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid='public.log_pay_change()'::regprocedure AND md5(prosrc)={literal(hashlib.md5(body.encode()).hexdigest())} AND prosecdef AND proconfig=ARRAY['search_path=public'] AND r.rolname='postgres') THEN RAISE EXCEPTION 'Source function/security mismatch'; END IF;
END $$;
CREATE TEMP TABLE baseline(audit_count bigint,triggers text,acls text);
INSERT INTO baseline SELECT (SELECT count(*) FROM public.pay_audit_log) AS audit_count, (SELECT md5(string_agg(oid::text||':'||tgenabled::text,',' ORDER BY oid)) FROM pg_trigger) AS triggers, (SELECT md5(string_agg(oid::text||':'||coalesce(relacl::text,''),',' ORDER BY oid)) FROM pg_class) AS acls;
SAVEPOINT audit_probe;
ALTER TABLE auth.users DISABLE TRIGGER USER;
ALTER TABLE public.profiles DISABLE TRIGGER USER;
ALTER TABLE public.pay_audit_log DISABLE TRIGGER USER;
INSERT INTO auth.users(id,email) VALUES('{actor}','pay-audit-probe@example.test');
INSERT INTO public.profiles(user_id,email,display_name) VALUES('{actor}','pay-audit-probe@example.test','Synthetic audit caller');
REVOKE ALL ON public.pay_audit_log FROM PUBLIC,authenticated;
SELECT set_config('request.jwt.claim.sub','{actor}',true);
CREATE TEMP TABLE snapshots(old_row jsonb,new_row jsonb);
CREATE FUNCTION pg_temp.check_audit(tab text, op text, expected_actor uuid, expected_email text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE a public.pay_audit_log; s record;
BEGIN
 SELECT * INTO STRICT a FROM public.pay_audit_log WHERE record_id='{record}' AND table_name=tab AND action=op;
 SELECT * INTO s FROM snapshots;
 IF a.affected_user_id IS DISTINCT FROM '{subject}'::uuid OR a.changed_by IS DISTINCT FROM expected_actor OR a.changed_by_email IS DISTINCT FROM expected_email OR a.old_values IS DISTINCT FROM s.old_row OR a.new_values IS DISTINCT FROM s.new_row OR a.id IS NULL OR a.created_at IS NULL THEN RAISE EXCEPTION 'Audit payload/attribution mismatch'; END IF;
END $$;
CREATE FUNCTION pg_temp.reject_write(statement text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE cname text;
BEGIN
 BEGIN EXECUTE statement;
 EXCEPTION WHEN check_violation THEN
  GET STACKED DIAGNOSTICS cname=CONSTRAINT_NAME;
  IF cname='synthetic_audit_failure' THEN RETURN; END IF;
  RAISE;
 END;
 RAISE EXCEPTION 'Audit sink failure did not abort business mutation';
END $$;
"""
for trigger, table in bindings:
    columns = 'id,user_id,'
    values = f"'{record}','{subject}',"
    if table == 'employee_benefits':
        columns += 'benefit_type_id,annual_value'; values += f"'{ref}',120"
    elif table == 'employee_positions':
        columns += 'position_id,pay_rate'; values += f"'{ref}',35"
    else:
        columns += 'year,base_salary'; values += '2026,50000'
    insert = f'INSERT INTO pg_temp.{table}({columns}) VALUES({values})'
    sql += f"""
CREATE TEMP TABLE {table}(LIKE public.{table} INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING CONSTRAINTS);
CREATE TRIGGER {trigger} AFTER INSERT OR DELETE OR UPDATE ON pg_temp.{table} FOR EACH ROW EXECUTE FUNCTION public.log_pay_change();
GRANT SELECT,INSERT,UPDATE,DELETE ON pg_temp.{table} TO authenticated;
TRUNCATE snapshots;
SET LOCAL ROLE authenticated;
{insert};
RESET ROLE;
INSERT INTO snapshots SELECT NULL,to_jsonb(t) FROM pg_temp.{table} t;
SELECT pg_temp.check_audit('{table}','INSERT','{actor}','pay-audit-probe@example.test');
UPDATE snapshots SET old_row=new_row;
SET LOCAL ROLE authenticated;
UPDATE pg_temp.{table} SET notes='Synthetic updated note';
RESET ROLE;
UPDATE snapshots SET new_row=(SELECT to_jsonb(t) FROM pg_temp.{table} t);
SELECT pg_temp.check_audit('{table}','UPDATE','{actor}','pay-audit-probe@example.test');
"""
    # A failing audit INSERT must atomically roll back each business operation.
    sql += f"""
ALTER TABLE public.pay_audit_log ADD CONSTRAINT synthetic_audit_failure CHECK(record_id<>'{record}'::uuid) NOT VALID;
CREATE TEMP TABLE before_failure AS SELECT to_jsonb(t) AS row FROM pg_temp.{table} t;
CREATE TEMP TABLE audit_before_failure AS SELECT to_jsonb(t) AS row FROM public.pay_audit_log t;
SET LOCAL ROLE authenticated;
SELECT pg_temp.reject_write({literal(insert)});
SELECT pg_temp.reject_write('UPDATE pg_temp.{table} SET notes=''must roll back''');
SELECT pg_temp.reject_write('DELETE FROM pg_temp.{table}');
RESET ROLE;
DO $$ BEGIN
 IF (SELECT jsonb_agg(to_jsonb(t)) FROM pg_temp.{table} t) IS DISTINCT FROM (SELECT jsonb_agg(row) FROM before_failure) OR (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.pay_audit_log t) IS DISTINCT FROM (SELECT jsonb_agg(row ORDER BY row->>'id') FROM audit_before_failure) THEN RAISE EXCEPTION 'Failure changed rows'; END IF;
END $$;
DROP TABLE before_failure,audit_before_failure;
ALTER TABLE public.pay_audit_log DROP CONSTRAINT synthetic_audit_failure;
UPDATE snapshots SET old_row=new_row,new_row=NULL;
SET LOCAL ROLE authenticated;
DELETE FROM pg_temp.{table};
RESET ROLE;
SELECT pg_temp.check_audit('{table}','DELETE','{actor}','pay-audit-probe@example.test');
DELETE FROM public.pay_audit_log WHERE record_id='{record}' AND table_name='{table}';
-- Background work without a JWT has NULL actor/email; no invented attribution.
SELECT set_config('request.jwt.claim.sub','',true);
{insert};
UPDATE snapshots SET old_row=NULL,new_row=(SELECT to_jsonb(t) FROM pg_temp.{table} t);
SELECT pg_temp.check_audit('{table}','INSERT',NULL,NULL);
DELETE FROM public.pay_audit_log WHERE record_id='{record}' AND table_name='{table}';
SELECT set_config('request.jwt.claim.sub','{actor}',true);
"""
sql += """ROLLBACK TO SAVEPOINT audit_probe;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.pay_audit_log) <> (SELECT audit_count FROM baseline)
 OR (SELECT md5(string_agg(oid::text||':'||tgenabled::text,',' ORDER BY oid)) FROM pg_trigger) IS DISTINCT FROM (SELECT triggers FROM baseline)
 OR (SELECT md5(string_agg(oid::text||':'||coalesce(relacl::text,''),',' ORDER BY oid)) FROM pg_class) IS DISTINCT FROM (SELECT acls FROM baseline)
 THEN RAISE EXCEPTION 'Rollback state mismatch'; END IF;
END $$;
ROLLBACK;"""
query(sql)
assert query(f"SELECT count(*) FROM public.profiles WHERE user_id='{actor}';") == '0'
assert query(f"SELECT count(*) FROM public.pay_audit_log WHERE record_id='{record}';") == '0'
print('PASS: source function hash/security and 3 exact trigger bindings; 9 INSERT/UPDATE/DELETE full audit payloads with authenticated caller attribution; 9 audit-sink failures preserve business and audit rows; 3 background inserts retain NULL attribution; rollback leaves no fixtures. Scope: isolated full-shape temporary tables, not complete RLS/FK workflows or hosted activation.')
