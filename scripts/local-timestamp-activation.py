#!/usr/bin/env python3
"""Synthetic, rollback-only timestamp activation checks in fixed local Docker DB."""
from pathlib import Path
import importlib.util
import subprocess

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('timestamps', ROOT/'rehearsal-timestamps-runner.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def query(sql):
    p = subprocess.run(['docker','exec','-i','supabase_db_schreiber-local','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres'],input=sql,text=True,capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr)
    return p.stdout.strip()

fingerprint = "SELECT md5(string_agg(oid||':'||tgenabled::text,',' ORDER BY oid)) FROM pg_trigger;"
source = (module.ARCHIVE/'behavior-review/public-triggers-disabled.sql').read_text()
try:
    module.core(source+'\n')
    raise AssertionError('Tamper accepted')
except ValueError:
    pass
before = query(fingerprint)
setup = """
BEGIN;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT c.relname,t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal LOOP
 EXECUTE format('DROP TRIGGER %I ON public.%I',r.tgname,r.relname);
 END LOOP;
END $$;
"""
probe = """
CREATE TEMP TABLE timestamp_probe(id integer PRIMARY KEY, marker text, updated_at timestamptz);
CREATE TRIGGER stamp BEFORE UPDATE ON timestamp_probe FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO timestamp_probe VALUES(1,'original','2000-01-01 UTC');
ALTER TABLE timestamp_probe DISABLE TRIGGER stamp;
UPDATE timestamp_probe SET marker='disabled';
DO $$ BEGIN IF (SELECT updated_at FROM timestamp_probe)<>'2000-01-01 UTC'::timestamptz THEN RAISE EXCEPTION 'Disabled trigger fired'; END IF; END $$;
ALTER TABLE timestamp_probe ENABLE TRIGGER stamp;
GRANT SELECT,UPDATE ON timestamp_probe TO authenticated;
SET LOCAL ROLE authenticated;
UPDATE timestamp_probe SET marker='enabled';
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM timestamp_probe WHERE id=1 AND marker='enabled' AND updated_at=now()) THEN RAISE EXCEPTION 'Timestamp or payload mismatch'; END IF; END $$;
RESET ROLE;
ROLLBACK;
"""
print(query(setup+source+module.core(source)+probe))
try:
    query(setup+source+module.core(source)+module.core(source)+'ROLLBACK;')
    raise AssertionError('Repeat activation accepted')
except RuntimeError as error:
    assert 'Expected 70 disabled triggers' in str(error), str(error)
assert query(fingerprint)==before, 'Trigger states not restored'
print('PASS: exact 48-trigger core activation and postcheck; authenticated timestamp behavior; tamper rejected; transaction rolled back and trigger fingerprint unchanged.')
print('Hosted isolation preflight is not simulated here; it remains mandatory in the operator runner.')
