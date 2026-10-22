#!/usr/bin/env python3
"""Synthetic rollback-only tests of four sync bindings and one job setup binding.
Uses only the fixed disposable Docker database. No hosted connections or real rows.
Requires private schema definitions, never export row data.
"""
import argparse
import hashlib
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--candidate', action='store_true')
args = parser.parse_args()
ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = Path('/Users/sumanththota/Schrex/archive/database-2026-10-19')
NAMES = ['sync_employee_contact_name', 'sync_employee_contact_display_email',
         'sync_contact_to_profile', 'sync_profile_to_contact',
         'trg_seed_job_contact_slots', 'seed_job_contact_slots']

def literal(value):
    return "'" + value.replace("'", "''") + "'"

def query(sql):
    result = subprocess.run(['docker', 'exec', '-i', 'supabase_db_schreiber-local',
        'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin',
        '-d', 'postgres'], input=sql, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

source = (ARCHIVE / 'inspection/schema.sql').read_text()
triggers = (ARCHIVE / 'behavior-review/public-triggers-disabled.sql').read_text()
assert hashlib.sha256(triggers.encode()).hexdigest() == '995142ef62107a6a32d73cc6e723d56704d1e51c338ff1afc948627b276086e8'
fingerprint = "SELECT md5(string_agg(oid::text||':'||tgenabled::text||':'||pg_get_triggerdef(oid),',' ORDER BY oid)) FROM pg_trigger;"
before = query(fingerprint)
function_fingerprint = "SELECT md5(string_agg(oid::text||':'||pg_get_functiondef(oid)||':'||coalesce(proacl::text,''),',' ORDER BY oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f';"
before_functions = query(function_fingerprint)
sql = "BEGIN; SELECT pg_advisory_xact_lock(19761019,99); SET LOCAL statement_timeout='20s';\n"
for name in NAMES:
    definition = re.search(r'CREATE FUNCTION public\.' + name + r'\(.*?AS \$\$(.*?)\$\$;', source, re.S)
    assert definition
    body = definition[1]
    signature = name + ('(uuid)' if name == 'seed_job_contact_slots' else '()')
    # Validate transitive helper as well as directly bound functions, including authority.
    sql += f"""DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p
      WHERE oid={literal('public.' + signature)}::regprocedure
      AND md5(prosrc)={literal(hashlib.md5(body.encode()).hexdigest())}
      AND prosecdef={'true' if 'SECURITY DEFINER' in definition[0] else 'false'}
      AND proconfig=ARRAY['search_path=public'] AND proowner='postgres'::regrole)
      THEN RAISE EXCEPTION 'Function parity failed: {name}'; END IF; END $$;\n"""
sql += """
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT n.nspname,c.relname,tr.tgname FROM pg_trigger tr
 JOIN pg_class c ON c.oid=tr.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE NOT tr.tgisinternal AND n.nspname IN ('public','auth','pgmq') LOOP
 EXECUTE format('ALTER TABLE %I.%I DISABLE TRIGGER %I',t.nspname,t.relname,t.tgname);
 END LOOP;
END $$;
"""
bindings = [line for line in triggers.splitlines() if line.startswith('CREATE TRIGGER ') and
            any('FUNCTION public.' + name + '();' in line for name in NAMES)]
assert len(bindings) == 5
for binding in bindings:
    name, table = re.search(r'CREATE TRIGGER (\w+).*? ON public\.(\w+)', binding).groups()
    sql += f'DROP TRIGGER IF EXISTS {name} ON public.{table};\n{binding}\n'
sql += """
CREATE FUNCTION pg_temp.check_true(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Check failed: %',label; END IF; END $$;
INSERT INTO auth.users(id,email) VALUES ('c7000000-0000-4000-8000-000000000001','sync-probe@example.test');
INSERT INTO public.profiles(user_id,display_name,email) VALUES ('c7000000-0000-4000-8000-000000000001','Initial','initial@example.test');
INSERT INTO public.employee_contacts(id,name,first_name,last_name,middle_initial,work_email,personal_email)
 VALUES ('c7000000-0000-4000-8000-000000000002','Ignored','  Ada  ','  Example ',' xy ',' work@example.test ','personal@example.test');
SELECT pg_temp.check_true((SELECT name='Ada Example' AND middle_initial='X' AND email='work@example.test' FROM public.employee_contacts WHERE id='c7000000-0000-4000-8000-000000000002'),'normalization/work priority');
UPDATE public.employee_contacts SET work_email=' ',middle_initial=' ' WHERE id='c7000000-0000-4000-8000-000000000002';
SELECT pg_temp.check_true((SELECT email='personal@example.test' AND middle_initial IS NULL FROM public.employee_contacts WHERE id='c7000000-0000-4000-8000-000000000002'),'personal fallback/blank middle');
UPDATE public.employee_contacts SET personal_email=' ' WHERE id='c7000000-0000-4000-8000-000000000002';
SELECT pg_temp.check_true((SELECT email='personal@example.test' FROM public.employee_contacts WHERE id='c7000000-0000-4000-8000-000000000002'),'blank sources preserve display email');
UPDATE public.employee_contacts SET converted_user_id='c7000000-0000-4000-8000-000000000001' WHERE id='c7000000-0000-4000-8000-000000000002';
SELECT pg_temp.check_true((SELECT display_name='Ada Example' AND contact_id='c7000000-0000-4000-8000-000000000002' FROM public.profiles WHERE user_id='c7000000-0000-4000-8000-000000000001'),'link pushes contact to profile');
UPDATE public.employee_contacts SET first_name='Bea' WHERE id='c7000000-0000-4000-8000-000000000002';
SELECT pg_temp.check_true((SELECT c.name='Bea Example' AND p.display_name='Ada Example' FROM public.employee_contacts c JOIN public.profiles p ON p.contact_id=c.id WHERE c.id='c7000000-0000-4000-8000-000000000002'),'known gap: first_name update does not fire UPDATE OF name sync');
UPDATE public.employee_contacts SET work_email='new@example.test' WHERE id='c7000000-0000-4000-8000-000000000002';
SELECT pg_temp.check_true((SELECT c.email='new@example.test' AND p.email='personal@example.test' FROM public.employee_contacts c JOIN public.profiles p ON p.contact_id=c.id WHERE c.id='c7000000-0000-4000-8000-000000000002'),'known gap: work_email update does not fire UPDATE OF email sync');
UPDATE public.employee_contacts SET name=name,email=email WHERE id='c7000000-0000-4000-8000-000000000002';
SELECT pg_temp.check_true((SELECT c.name=p.display_name AND c.email=p.email FROM public.employee_contacts c JOIN public.profiles p ON p.contact_id=c.id WHERE c.id='c7000000-0000-4000-8000-000000000002'),'explicit display-column update converges');
UPDATE public.profiles SET display_name='Profile Name',email='profile@example.test',is_active=false WHERE user_id='c7000000-0000-4000-8000-000000000001';
SELECT pg_temp.check_true((SELECT c.name='Bea Example' AND p.display_name='Bea Example' AND c.email='profile@example.test' AND p.email=c.email AND NOT c.is_active FROM public.employee_contacts c JOIN public.profiles p ON p.contact_id=c.id WHERE c.id='c7000000-0000-4000-8000-000000000002'),'profile roundtrip terminates; structured contact name overrides profile');
UPDATE public.employee_contacts SET is_active=true WHERE id='c7000000-0000-4000-8000-000000000002';
SELECT pg_temp.check_true((SELECT c.is_active AND NOT p.is_active FROM public.employee_contacts c JOIN public.profiles p ON p.contact_id=c.id WHERE c.id='c7000000-0000-4000-8000-000000000002'),'contact active status is not reverse-synced');
-- Control templates transactionally; no existing synthetic template rows are deleted.
UPDATE public.job_contact_template_slots SET is_active=false;
INSERT INTO public.job_contact_template_slots(category,role_label,material,default_name,sort_order,is_active)
VALUES ('sync-probe','Supervisor',NULL,'Synthetic Lead',7,true),('sync-probe','Inactive',NULL,'No',9,false);
INSERT INTO public.jobs(id,name) VALUES ('c7000000-0000-4000-8000-000000000003','Synthetic sync job');
SELECT pg_temp.check_true((SELECT count(*)=1 AND bool_and(name='Synthetic Lead' AND sort_order=7 AND is_template_slot) FROM public.job_contacts WHERE job_id='c7000000-0000-4000-8000-000000000003'),'active template seeded exactly once');
SELECT public.seed_job_contact_slots('c7000000-0000-4000-8000-000000000003');
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.job_contacts WHERE job_id='c7000000-0000-4000-8000-000000000003'),'sequential repeat seed idempotent');
UPDATE public.job_contact_template_slots SET material='' WHERE category='sync-probe';
SELECT public.seed_job_contact_slots('c7000000-0000-4000-8000-000000000003');
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.job_contacts WHERE job_id='c7000000-0000-4000-8000-000000000003'),'null/empty material duplicate equivalence');
INSERT INTO public.job_contact_template_slots(category,role_label,material,default_name,is_active)
VALUES ('sync-duplicate','Duplicate',NULL,'One',true),('sync-duplicate','Duplicate',NULL,'Two',true);
INSERT INTO public.jobs(id,name) VALUES ('c7000000-0000-4000-8000-000000000004','Synthetic duplicate job');
SELECT pg_temp.check_true((SELECT count(*)=2 FROM public.job_contacts WHERE job_id='c7000000-0000-4000-8000-000000000004' AND category='sync-duplicate'),'known gap: duplicate template definitions create duplicate slots');
ROLLBACK;
SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM auth.users WHERE id='c7000000-0000-4000-8000-000000000001')
 AND NOT EXISTS(SELECT 1 FROM public.jobs WHERE id='c7000000-0000-4000-8000-000000000003') THEN 'PASS cleanup' ELSE 'FAIL cleanup' END;
"""
if args.candidate:
    # Apply only after the local source parity checks and exact source bindings setup.
    marker = 'CREATE FUNCTION pg_temp.check_true'
    candidate = '\n'.join((ROOT / 'local/candidate-migrations' / name).read_text() for name in [
        '20261020001000_contact_sync_effective_changes.sql',
        '20261020001100_job_contact_seed_duplicates.sql'])
    candidate += "\nALTER TABLE public.employee_contacts ENABLE TRIGGER trg_sync_contact_to_profile;\n"
    sql = sql.replace(marker, candidate + marker, 1)
    sql = sql.replace("c.name='Bea Example' AND p.display_name='Ada Example'", "c.name='Bea Example' AND p.display_name='Bea Example'")
    sql = sql.replace("c.email='new@example.test' AND p.email='personal@example.test'", "c.email='new@example.test' AND p.email='new@example.test'")
    sql = sql.replace("('sync-duplicate','Duplicate',NULL,'Two',true)", "('sync-duplicate','Duplicate','','One',true)")
    sql = sql.replace("count(*)=2 FROM public.job_contacts WHERE job_id='c7000000-0000-4000-8000-000000000004'", "count(*)=1 FROM public.job_contacts WHERE job_id='c7000000-0000-4000-8000-000000000004'")
    extra = """
    INSERT INTO public.job_contact_template_slots(category,role_label,material,default_name,is_active)
      VALUES ('sync-duplicate','Duplicate',NULL,'Conflicting',true);
    DO $$ BEGIN
      BEGIN
        INSERT INTO public.jobs(id,name) VALUES ('c7000000-0000-4000-8000-000000000005','Must rollback');
        RAISE EXCEPTION 'Expected conflicting-template rejection';
      EXCEPTION WHEN SQLSTATE '22023' THEN
        IF SQLERRM <> 'Conflicting active job contact templates require review' THEN RAISE; END IF;
      END;
      PERFORM pg_temp.check_true(NOT EXISTS(SELECT 1 FROM public.jobs WHERE id='c7000000-0000-4000-8000-000000000005'),'conflict job atomic rollback');
      PERFORM pg_temp.check_true(NOT EXISTS(SELECT 1 FROM public.job_contacts WHERE job_id='c7000000-0000-4000-8000-000000000005'),'conflict contacts atomic rollback');
      BEGIN
        PERFORM public.seed_job_contact_slots('c7000000-0000-4000-8000-000000000099');
        RAISE EXCEPTION 'Expected missing job rejection';
      EXCEPTION WHEN foreign_key_violation THEN NULL;
      END;
    END $$;
    """
    sql = sql.replace('ROLLBACK;', extra + 'ROLLBACK;', 1)
output = query(sql)
assert 'PASS cleanup' in output
assert query(fingerprint) == before, 'Trigger definition/state fingerprint changed'
assert query(function_fingerprint) == before_functions, 'Function definition/ACL fingerprint changed'
print('PASS: 6 source-matching functions (5 direct + 1 transitive); 5 source trigger bindings; normalization, linking, finite bidirectional roundtrip, active-only slot seeding, sequential repeat and null/empty duplicate equivalence; rollback cleanup.')
if not args.candidate:
    print('BASELINE findings reproduced: first_name and work_email updates leave linked profile stale because UPDATE OF trigger checks the original SET columns. Structured contact name overrides profile display_name edits. Contact is_active does not reverse-sync. Duplicate template definitions create duplicate slots. These are activation review blockers/behavior gaps, not approved behavior. Source behavior unchanged.')
print('LIMITATIONS: privileged local function integration, not hosted/RLS acceptance; concurrent slot seeding not certified.')

if args.candidate:
    print('CANDIDATE PASS: normalized field updates synchronize; identical duplicate templates collapse; conflicts and missing jobs reject atomically. Existing structured name authority and profile-controlled active status are preserved. Functions/ACLs/triggers restore exactly.')
