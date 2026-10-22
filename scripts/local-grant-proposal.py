#!/usr/bin/env python3
"""Rollback-only synthetic ACL test. Reads only a commented private schema grant draft.
Never connects to hosted databases; fixed disposable Docker container, no credentials.
"""
import json
from pathlib import Path
import re
import subprocess
import uuid
import sys
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = Path('/Users/sumanththota/Schrex/archive/database-2026-10-19')
FUNCTIONS = ['has_role(uuid, public.app_role)', 'list_employee_directory()',
             'get_attendee_by_token(text)', 'get_employee_contact_sensitive(uuid)']

def psql(sql):
    result = subprocess.run(['docker', 'exec', '-i', 'supabase_db_schreiber-local',
                             'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U',
                             'supabase_admin', '-d', 'postgres'], input=sql, text=True,
                            capture_output=True, check=False)
    if result.returncode:
        # Only synthetic SQL runs here; suppress statement/context and values.
        raise RuntimeError('\n'.join(x for x in result.stderr.splitlines() if x.startswith(('ERROR:', 'CONTEXT:', 'SQL statement'))))
    return result.stdout.strip() + ('\n' + '\n'.join(x for x in result.stderr.splitlines() if 'BLOCKER:' in x) if 'BLOCKER:' in result.stderr else '')

CATALOG = """SELECT md5(string_agg(x, E'\\n' ORDER BY x)) FROM (
 SELECT 'relation:'||oid||':'||coalesce(relacl::text,'') x FROM pg_class WHERE relnamespace='public'::regnamespace
 UNION ALL SELECT 'column:'||attrelid||':'||attnum||':'||coalesce(attacl::text,'') FROM pg_attribute WHERE attrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)
 UNION ALL SELECT 'function:'||oid||':'||coalesce(proacl::text,'') FROM pg_proc WHERE pronamespace='public'::regnamespace
 UNION ALL SELECT 'trigger:'||oid||':'||tgenabled::text FROM pg_trigger WHERE NOT tgisinternal
 UNION ALL SELECT 'policy:'||oid||':'||coalesce(polqual::text,'')||':'||coalesce(polwithcheck::text,'') FROM pg_policy
 UNION ALL SELECT 'schema:'||oid||':'||coalesce(nspacl::text,'') FROM pg_namespace WHERE nspname='public'
) s;"""

def main():
    assert sys.argv[1:] in ([], ['--candidate']), 'Only --candidate accepted'
    candidate = sys.argv[1:] == ['--candidate']
    grants = []
    for line in (PRIVATE / 'behavior-review/authenticated-data-grants-review.sql').read_text().splitlines():
        if line.startswith('-- GRANT '):
            sql = line[3:]
            if not re.fullmatch(r'GRANT (?:SELECT|INSERT|UPDATE|DELETE)(?:\(\w+\))?(?:,(?:SELECT|INSERT|UPDATE|DELETE))* ON TABLE public\.\w+ TO authenticated;', sql):
                raise ValueError('Unexpected grant syntax')
            grants.append(sql)
    assert len(grants) == 118
    source = (PRIVATE / 'inspection/schema-with-acl.sql').read_text()
    # Assert source function bodies match local implementations; do not execute the source dump.
    for signature in FUNCTIONS:
        name = signature.split('(')[0]
        match = re.search(r'CREATE FUNCTION public\.' + name + r'\([^;]+?AS \$\$(.*?)\$\$;', source, re.S)
        assert match, 'Source function not located'
        local = psql(f"SELECT prosrc FROM pg_proc WHERE oid='public.{signature}'::regprocedure;")
        assert re.sub(r'\s+', ' ', local).strip() == re.sub(r'\s+', ' ', match[1]).strip(), 'Function body parity failed'
    policy_helpers = psql("SELECT DISTINCT p.proname FROM pg_depend d JOIN pg_proc p ON p.oid=d.refobjid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE d.classid='pg_policy'::regclass AND d.refclassid='pg_proc'::regclass AND n.nspname='public';")
    assert policy_helpers == 'has_role'
    assert psql("SELECT count(*) FROM pg_sequences WHERE schemaname='public';") == '0'
    assert psql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosrc ~ 'net[.]http|cron[.]schedule';") == '0'
    local_schema = subprocess.check_output(['docker', 'exec', 'supabase_db_schreiber-local', 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '--schema-only', '--schema=public'], text=True)
    def affected_policies(schema):
        return {re.search(r'^CREATE POLICY (.*?) ON ', stmt)[1]: re.sub(r'\s+', ' ', stmt).strip()
                for stmt in re.findall(r'^CREATE POLICY .*?;', schema, re.M | re.S)
                if re.search(r' ON public.toolbox_talk_(attendees|sessions)\b', stmt)}
    assert affected_policies(source) == affected_policies(local_schema), 'Affected policy source parity failed'
    assert len(affected_policies(source)) == 10
    before = psql(CATALOG)
    ids = {k: str(uuid.uuid4()) for k in ['employee', 'foreman', 'office', 'admin', 'other', 'job', 'talk', 'session', 'attendee', 'unassigned', 'comp']}
    sql = """BEGIN; SET LOCAL statement_timeout='30s'; SET LOCAL lock_timeout='3s';
DO $block$ DECLARE r record; BEGIN
 FOR r IN SELECT n.nspname,c.relname,t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth','pgmq') LOOP
 EXECUTE format('ALTER TABLE %I.%I DISABLE TRIGGER %I',r.nspname,r.relname,r.tgname);
 END LOOP;
END $block$;
"""
    for role in ['employee', 'foreman', 'office', 'admin', 'other']:
        uid = ids[role]
        sql += f"INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ('{uid}','grant-{uid}@example.test','{{\"display_name\":\"Synthetic Grant Test\"}}');\n"
        sql += f"INSERT INTO public.profiles(user_id) VALUES ('{uid}'); INSERT INTO public.employee_contacts(name,converted_user_id) VALUES ('Synthetic {uid}','{uid}'); INSERT INTO public.user_roles(user_id,role) VALUES ('{uid}','employee'); UPDATE public.user_roles SET role='{role if role != 'other' else 'employee'}' WHERE user_id='{uid}';\n"
    sql += f"""
INSERT INTO public.jobs(id,name) VALUES ('{ids['job']}','Synthetic ACL Job');
INSERT INTO public.employee_compensation_history(id,user_id,year,base_salary,bonus,benefits_value) VALUES ('{ids['comp']}','{ids['other']}',extract(year from now())::int,50000,0,0);
UPDATE public.employee_contacts SET address='Synthetic address',notes='Synthetic private note',ssn='SYNTHETIC-NOT-AN-SSN' WHERE converted_user_id='{ids['other']}';
INSERT INTO public.toolbox_talks(id,title,content) VALUES ('{ids['talk']}','Synthetic ACL Talk','Synthetic');
INSERT INTO public.toolbox_talk_sessions(id,talk_id,foreman_id) VALUES ('{ids['session']}','{ids['talk']}','{ids['foreman']}');
INSERT INTO public.toolbox_talk_attendees(id,session_id,user_id,attendee_name,access_token) VALUES ('{ids['attendee']}','{ids['session']}','{ids['employee']}','Synthetic','synthetic-bound-token');
INSERT INTO public.toolbox_talk_attendees(id,session_id,user_id,attendee_name,access_token) VALUES ('{ids['unassigned']}','{ids['session']}',NULL,'Synthetic unassigned','synthetic-unassigned-token');
REVOKE ALL ON SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC,anon,authenticated;
DO $block$ DECLARE r record; BEGIN
 FOR r IN SELECT c.relname,a.attname FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','v','p') AND a.attnum>0 AND NOT a.attisdropped LOOP
 EXECUTE format('REVOKE ALL (%I) ON TABLE public.%I FROM PUBLIC,anon,authenticated',r.attname,r.relname);
 END LOOP;
END $block$;
GRANT USAGE ON SCHEMA public TO authenticated;
"""
    sql += '\n'.join(grants) + '\n'
    sql += '\n'.join('GRANT EXECUTE ON FUNCTION public.' + f + ' TO authenticated;' for f in FUNCTIONS) + '\n'
    if candidate:
        sql += (ROOT / 'local/candidate-migrations/20261019220000_attendance_policy_recursion.sql').read_text() + '\n'
        spec = importlib.util.spec_from_file_location('grant_runner', ROOT / 'scripts/rehearsal-grants-runner.py')
        grant_runner = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(grant_runner)
        sql += grant_runner.permissions(grant_runner.DRAFT.read_text()) + grant_runner.postcheck()
    for role in ['employee', 'foreman', 'office', 'admin']:
        uid = ids[role]
        is_admin = role == 'admin'
        trusted = role in ['office', 'admin']
        sql += f"""
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='{uid}';
DO $test$ DECLARE n integer; v text; BEGIN
 IF NOT public.has_role(auth.uid(),'{role}') THEN RAISE EXCEPTION 'role fixture failure'; END IF;
 IF (SELECT count(*) FROM public.jobs WHERE id='{ids['job']}')<>1 THEN RAISE EXCEPTION 'job read failed'; END IF;
 IF (SELECT count(*) FROM public.employee_compensation_history WHERE id='{ids['comp']}')<>{1 if is_admin else 0} THEN RAISE EXCEPTION 'salary boundary failed'; END IF;
 IF has_table_privilege('authenticated','public.jobs','TRUNCATE') OR has_table_privilege('authenticated','public.jobs','TRIGGER') OR has_table_privilege('authenticated','public.jobs','REFERENCES') OR has_table_privilege('authenticated','public.jobs','MAINTAIN') OR has_schema_privilege('authenticated','public','CREATE') THEN RAISE EXCEPTION 'management privileges remain'; END IF;
 BEGIN PERFORM ssn FROM public.employee_contacts LIMIT 1; RAISE EXCEPTION 'sensitive column leaked'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF has_column_privilege('authenticated','public.toolbox_talk_attendees','access_token','SELECT') THEN RAISE EXCEPTION 'token column grant leaked'; END IF;
 BEGIN
 IF (SELECT count(*) FROM public.toolbox_talk_attendees WHERE session_id='{ids['session']}')<>{1 if role == 'employee' else 2} THEN RAISE EXCEPTION 'attendee visibility differs'; END IF;
 IF (SELECT count(*) FROM public.toolbox_talk_sessions WHERE id='{ids['session']}')<>1 THEN RAISE EXCEPTION 'session visibility failed'; END IF;
 EXCEPTION WHEN SQLSTATE '42P17' THEN RAISE NOTICE 'BLOCKER: attendee table RLS recursion (42P17)'; END;
 IF (SELECT count(*) FROM public.get_attendee_by_token('synthetic-bound-token'))<>{1 if role == 'employee' else 0} THEN RAISE EXCEPTION 'wrong-user token boundary failed'; END IF;
 IF (SELECT count(*) FROM public.get_attendee_by_token('synthetic-invalid-token'))<>0 THEN RAISE EXCEPTION 'invalid token boundary failed'; END IF;
 IF (SELECT count(*) FROM public.get_attendee_by_token('synthetic-unassigned-token'))<>1 THEN RAISE EXCEPTION 'unassigned token behavior changed'; END IF;
 SELECT address INTO v FROM public.list_employee_directory() WHERE converted_user_id='{ids['other']}';
 IF {"v IS DISTINCT FROM 'Synthetic address'" if trusted else 'v IS NOT NULL'} THEN RAISE EXCEPTION 'directory redaction failed'; END IF;
"""
        if candidate:
            sql += f"""
 UPDATE public.toolbox_talk_attendees SET signed_at=now() WHERE id='{ids['attendee']}';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>{0 if role == 'office' else 1} THEN RAISE EXCEPTION 'attendance update boundary failed'; END IF;
"""
            if role in ['foreman', 'admin']:
                sql += f"""
 INSERT INTO public.toolbox_talk_attendees(session_id,user_id,attendee_name) VALUES ('{ids['session']}','{uid}','Synthetic temporary');
 DELETE FROM public.toolbox_talk_attendees WHERE session_id='{ids['session']}' AND attendee_name='Synthetic temporary';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'authorized attendance insert/delete failed'; END IF;
"""
            else:
                sql += f"""
 BEGIN
 INSERT INTO public.toolbox_talk_attendees(session_id,user_id,attendee_name) VALUES ('{ids['session']}','{uid}','Forbidden');
 RAISE EXCEPTION 'unauthorized attendee insert'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 DELETE FROM public.toolbox_talk_attendees WHERE id='{ids['unassigned']}';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'unauthorized attendee delete'; END IF;
"""
        if trusted:
            sql += f"IF (SELECT count(*) FROM public.get_employee_contact_sensitive((SELECT id FROM public.employee_contacts WHERE converted_user_id='{ids['other']}')))<>1 THEN RAISE EXCEPTION 'sensitive RPC allowed path failed'; END IF;\n"
        else:
            # Row may be filtered, so select contact UUID before setting role via scalar subquery directory.
            sql += f"BEGIN PERFORM * FROM public.get_employee_contact_sensitive((SELECT id FROM public.list_employee_directory() WHERE converted_user_id='{ids['other']}')); RAISE EXCEPTION 'sensitive RPC leaked'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'not authorized' THEN RAISE; END IF; END;\n"
        if not is_admin:
            sql += f"BEGIN INSERT INTO public.user_roles(user_id,role) VALUES ('{uid}','admin'); RAISE EXCEPTION 'self promotion succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;\n"
        if role != 'employee':
            sql += f"INSERT INTO public.job_plans(job_id,category,title,file_path,uploaded_by) VALUES ('{ids['job']}','civil','Synthetic ACL Plan','synthetic/acl.txt','{uid}'); DELETE FROM public.job_plans WHERE job_id='{ids['job']}' AND uploaded_by='{uid}'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'job plan delete failed'; END IF;\n"
        else:
            sql += f"BEGIN INSERT INTO public.job_plans(job_id,category,title,file_path,uploaded_by) VALUES ('{ids['job']}','civil','Synthetic ACL Plan','synthetic/acl.txt','{uid}'); RAISE EXCEPTION 'employee plan write succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;\n"
        sql += f"END $test$; RESET ROLE; SELECT 'PASS {role}: reads, redaction, token ownership, column denial, role boundary, plan writes';\n"
    if candidate:
        sql += f"""
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='{ids['other']}';
DO $test$ BEGIN
 IF public.is_current_user_talk_attendee('{ids['session']}') THEN RAISE EXCEPTION 'helper leaked another membership'; END IF;
 IF (SELECT count(*) FROM public.toolbox_talk_attendees WHERE session_id='{ids['session']}')<>0 THEN RAISE EXCEPTION 'uninvited employee sees attendees'; END IF;
 IF (SELECT count(*) FROM public.toolbox_talk_sessions WHERE id='{ids['session']}')<>0 THEN RAISE EXCEPTION 'uninvited employee sees session'; END IF;
 UPDATE public.toolbox_talk_attendees SET attendee_name='Forbidden' WHERE id='{ids['attendee']}';
 IF FOUND THEN RAISE EXCEPTION 'uninvited employee edits attendee'; END IF;
END $test$;
RESET ROLE;
DO $test$ BEGIN
 IF has_function_privilege('anon','public.is_current_user_talk_attendee(uuid)','EXECUTE') THEN RAISE EXCEPTION 'anonymous helper access'; END IF;
 IF (SELECT attendee_name FROM public.toolbox_talk_attendees WHERE id='{ids['attendee']}')<>'Synthetic' THEN RAISE EXCEPTION 'denied write persisted'; END IF;
END $test$;
SELECT 'PASS candidate: outsider read/write denial, helper identity boundary and anonymous denial';
"""
    sql += """
DO $test$ DECLARE r record; BEGIN
 IF has_schema_privilege('anon','public','USAGE') THEN RAISE EXCEPTION 'anonymous schema access remains'; END IF;
 FOR r IN SELECT oid,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname NOT IN ('has_role','list_employee_directory','get_attendee_by_token','get_employee_contact_sensitive','is_current_user_talk_attendee') LOOP
 IF has_function_privilege('authenticated',r.oid,'EXECUTE') THEN RAISE EXCEPTION 'unexpected function execution grant'; END IF;
 END LOOP;
END $test$;
SET LOCAL ROLE anon;
DO $test$ BEGIN
 BEGIN PERFORM id FROM public.jobs LIMIT 1; RAISE EXCEPTION 'anonymous table access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.list_employee_directory(); RAISE EXCEPTION 'anonymous directory RPC'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.get_attendee_by_token('synthetic-unassigned-token'); RAISE EXCEPTION 'anonymous token RPC'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $test$;
RESET ROLE;
SELECT 'PASS anonymous access and internal/outbound function EXECUTE denied';
ROLLBACK;
"""
    try:
        output = psql(sql)
    finally:
        assert psql(CATALOG) == before, 'ACL restoration failed'
        for role in ['employee', 'foreman', 'office', 'admin', 'other']:
            assert psql(f"SELECT count(*) FROM auth.users WHERE id='{ids[role]}';") == '0', 'Fixture rollback failed'
    print(output)
    print('PASS original ACL/trigger/policy fingerprint restored; synthetic transaction rolled back')
    print(json.dumps({'table_column_statements':len(grants),'function_grants':len(FUNCTIONS) + int(candidate),'schema_usage_grants':1,'sequence_grants':0,'source_function_bodies_match':len(FUNCTIONS),'affected_source_policies_match':10}))
    if 'BLOCKER:' in output:
        print('FAIL activation gate: attendee SELECT policy recursion; source policies unchanged')
        raise SystemExit(2)

if __name__ == '__main__':
    main()
