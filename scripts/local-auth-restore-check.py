#!/usr/bin/env python3
"""Test exported Auth setup with restored contact/profile triggers, local and rollback-only.
No hosted connection, Auth HTTP endpoint, SMTP, passwords, or real export rows.
"""
import hashlib
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = Path('/Users/sumanththota/Schrex/archive/database-2026-10-19')
def lit(s):
    return "'" + s.replace("'", "''") + "'"
def query(s):
    p = subprocess.run(['docker','exec','-i','supabase_db_schreiber-local','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres'],input=s,text=True,capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr)
    return p.stdout
source = (ARCHIVE/'inspection/schema.sql').read_text()
triggers = (ARCHIVE/'behavior-review/public-triggers-disabled.sql').read_text()
assert hashlib.sha256(triggers.encode()).hexdigest() == '995142ef62107a6a32d73cc6e723d56704d1e51c338ff1afc948627b276086e8'
names = ['handle_new_user','sync_employee_contact_name','sync_employee_contact_display_email','sync_contact_to_profile','sync_profile_to_contact','update_updated_at_column']
sql = "BEGIN; SELECT pg_advisory_xact_lock(19761019,99); SET LOCAL statement_timeout='20s';\n"
for name in names:
    definition = re.search(r'CREATE FUNCTION public\.'+name+r'\(\).*?AS \$\$(.*?)\$\$;',source,re.S)
    assert definition
    sql += f"""DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.{name}()'::regprocedure AND md5(prosrc)={lit(hashlib.md5(definition[1].encode()).hexdigest())} AND prosecdef={'true' if 'SECURITY DEFINER' in definition[0] else 'false'} AND proconfig=ARRAY['search_path=public'] AND proowner='postgres'::regrole) THEN RAISE EXCEPTION 'Source function/security mismatch: {name}'; END IF; END $$;\n"""
sql += """
CREATE TEMP TABLE original_state(triggers text,functions text);
INSERT INTO original_state SELECT
 (SELECT md5(string_agg(oid::text||pg_get_triggerdef(oid)||tgenabled::text,',' ORDER BY oid)) FROM pg_trigger),
 (SELECT md5(string_agg(oid::text||pg_get_functiondef(oid)||coalesce(proacl::text,''),',' ORDER BY oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f');
SAVEPOINT probes;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT n.nspname,c.relname,tr.tgname FROM pg_trigger tr JOIN pg_class c ON c.oid=tr.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT tr.tgisinternal AND n.nspname IN ('public','auth','pgmq') LOOP
 EXECUTE format('ALTER TABLE %I.%I DISABLE TRIGGER %I',t.nspname,t.relname,t.tgname);
 END LOOP;
END $$;
CREATE FUNCTION pg_temp.check_true(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Check failed: %',label; END IF; END $$;
"""
bindings = [x for x in triggers.splitlines() if x.startswith('CREATE TRIGGER ') and re.search(r'ON public\.(profiles|employee_contacts) ',x)]
assert len(bindings)==6
for binding in bindings:
    name,table = re.search(r'CREATE TRIGGER (\w+).*? ON public\.(\w+)',binding).groups()
    sql += f'DROP TRIGGER {name} ON public.{table};\n{binding}\n'
sql += (ROOT/'local/candidate-migrations/20261020001000_contact_sync_effective_changes.sql').read_text()
sql += """
ALTER TABLE public.employee_contacts ENABLE TRIGGER trg_sync_contact_to_profile;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- Local managed-table CREATE capability is tested as postgres, not superuser.
SET LOCAL ROLE postgres;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
RESET ROLE;
"""
prefix='d8060000-0000-4000-8000-'
def uid(i): return prefix+f'{i:012d}'
def signup(i,email,meta='{}'):
    return f"SET LOCAL ROLE supabase_auth_admin; INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('{uid(i)}',{lit(email)},{lit(meta)}::jsonb); RESET ROLE;\n"
def check(i,display):
    return f"""SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.profiles WHERE user_id='{uid(i)}' AND display_name={lit(display)} AND email=(SELECT email FROM auth.users WHERE id='{uid(i)}')),'profile/email/name');
SELECT pg_temp.check_true((SELECT count(*)=1 AND bool_and(role='employee') FROM public.user_roles WHERE user_id='{uid(i)}'),'employee role only');
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.profiles p JOIN public.employee_contacts c ON c.id=p.contact_id AND c.converted_user_id=p.user_id WHERE p.user_id='{uid(i)}'),'bidirectional linkage');\n"""
for i,email,meta,display in [(1,'auth-new@example.test','{"display_name":"Display Name","full_name":"Ignored","role":"admin"}','Display Name'),(2,'auth-full@example.test','{"full_name":"Full Name"}','Full Name'),(3,'auth-email@example.test','{}','auth-email'),(4,'auth-blank@example.test','{"display_name":"","full_name":"Ignored"}','')]:
    sql+=signup(i,email,meta)+check(i,display)
sql += f"""
INSERT INTO public.employee_contacts(id,name,email,is_active,created_at) VALUES
 ('{uid(101)}','Existing First','AUTH-MATCH@example.test',false,'2025-01-01'),
 ('{uid(102)}','Existing Second','auth-match@example.test',false,'2025-02-01');
"""
sql+=signup(5,'auth-match@example.test','{"display_name":"Auth Metadata"}')+check(5,'Auth Metadata')
sql+=f"""SELECT pg_temp.check_true((SELECT contact_id='{uid(101)}'::uuid FROM public.profiles WHERE user_id='{uid(5)}'),'oldest case-insensitive unlinked match');
SELECT pg_temp.check_true((SELECT converted_user_id IS NULL AND NOT is_active FROM public.employee_contacts WHERE id='{uid(102)}'),'later duplicate untouched');
SELECT pg_temp.check_true((SELECT is_active AND name='Existing First' FROM public.employee_contacts WHERE id='{uid(101)}'),'existing contact activated; name preserved');
"""
# Auth table rejects exact duplicate email before trigger side effects.
sql+=f"""
SET LOCAL ROLE supabase_auth_admin;
DO $$ DECLARE cn text; BEGIN
 BEGIN INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('{uid(6)}','auth-match@example.test','{{}}');
 RAISE EXCEPTION 'Expected duplicate email rejection';
 EXCEPTION WHEN unique_violation THEN GET STACKED DIAGNOSTICS cn=CONSTRAINT_NAME; IF cn<>'users_email_partial_key' THEN RAISE; END IF;
 END;
END $$;
RESET ROLE;
SELECT pg_temp.check_true(NOT EXISTS(SELECT 1 FROM auth.users WHERE id='{uid(6)}') AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id='{uid(6)}') AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id='{uid(6)}') AND (SELECT converted_user_id IS NULL FROM public.employee_contacts WHERE id='{uid(102)}'),'duplicate Auth email rejects without linking next contact');
INSERT INTO public.employee_contacts(id,name,email,converted_user_id) VALUES('{uid(103)}','Already linked','auth-linked@example.test','{uid(1)}');
"""
sql+=signup(7,'auth-linked@example.test')+check(7,'auth-linked')
sql+=f"SELECT pg_temp.check_true((SELECT contact_id<>'{uid(103)}'::uuid FROM public.profiles WHERE user_id='{uid(7)}'),'already-linked contact not reused');\n"
sql+=f"""
ALTER TABLE public.user_roles ADD CONSTRAINT synthetic_auth_failure CHECK(user_id<>'{uid(8)}'::uuid) NOT VALID;
SET LOCAL ROLE supabase_auth_admin;
DO $$ DECLARE cn text; BEGIN
 BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('{uid(8)}','auth-atomic@example.test','{{}}');
 RAISE EXCEPTION 'Missing expected role insert failure';
 EXCEPTION WHEN check_violation THEN GET STACKED DIAGNOSTICS cn=CONSTRAINT_NAME; IF cn<>'synthetic_auth_failure' THEN RAISE; END IF;
 END;
END $$;
RESET ROLE;
SELECT pg_temp.check_true(NOT EXISTS(SELECT 1 FROM auth.users WHERE id='{uid(8)}') AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id='{uid(8)}') AND NOT EXISTS(SELECT 1 FROM public.employee_contacts WHERE converted_user_id='{uid(8)}') AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id='{uid(8)}'),'downstream failure atomically removes all signup writes');
ROLLBACK TO SAVEPOINT probes;
SELECT pg_temp.check_true(true,'unreachable after rollback');
"""
# Temporary helper was created inside savepoint and is gone after rollback.
sql=sql.replace("SELECT pg_temp.check_true(true,'unreachable after rollback');", """DO $$ BEGIN
 IF (SELECT md5(string_agg(oid::text||pg_get_triggerdef(oid)||tgenabled::text,',' ORDER BY oid)) FROM pg_trigger) IS DISTINCT FROM (SELECT triggers FROM original_state)
 OR (SELECT md5(string_agg(oid::text||pg_get_functiondef(oid)||coalesce(proacl::text,''),',' ORDER BY oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f') IS DISTINCT FROM (SELECT functions FROM original_state) THEN RAISE EXCEPTION 'Rollback metadata mismatch'; END IF;
END $$;
ROLLBACK;""")
query(sql)
assert query(f"SELECT count(*) FROM auth.users WHERE id::text LIKE '{prefix}%';").strip()=='0'
print('PASS: 6 source function/security checks, 6 related business bindings with reviewed contact fix; local postgres creates managed Auth trigger; 6 complete Auth-admin INSERT workflows and exact duplicate-email rejection; display/full/email/blank-name precedence, metadata cannot grant admin, oldest case-insensitive duplicate linkage, linked-contact avoidance; downstream role failure atomically rolls back signup; trigger/function/ACL fingerprints restored and fixtures absent.')
print('LIMITS: SQL signup trigger integration only; no hosted capability proof, Auth HTTP/email/password/session/provider behavior, RLS acceptance or concurrent same-email signup test. Existing contact name and profile metadata can differ; blank display_name stays blank; duplicate email matching picks oldest unlinked contact without ambiguity rejection.')
