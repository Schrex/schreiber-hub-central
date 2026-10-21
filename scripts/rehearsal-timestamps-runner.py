#!/usr/bin/env python3
"""Prepare only the 48 reviewed timestamp triggers; no connection or credentials."""
from pathlib import Path
import hashlib
import os
import re
import time

ARCHIVE = Path('/Users/sumanththota/Schrex/archive/database-2026-10-19')
PIN = '995142ef62107a6a32d73cc6e723d56704d1e51c338ff1afc948627b276086e8'
BODY = '\nBEGIN\n  NEW.updated_at = now();\n  RETURN NEW;\nEND;\n'

def core(source):
    if hashlib.sha256(source.encode()).hexdigest() != PIN:
        raise ValueError('Reviewed trigger artifact changed')
    pairs = re.findall(r'^CREATE TRIGGER (\w+) BEFORE UPDATE ON public\.(\w+) FOR EACH ROW EXECUTE FUNCTION public\.update_updated_at_column\(\);$', source, re.M)
    if len(pairs) != 48 or len(set(pairs)) != 48:
        raise ValueError('Unexpected timestamp trigger inventory')
    values = ','.join("('%s','%s')" % (table, trigger) for trigger, table in pairs)
    guard = """
DO $guard$ BEGIN
 IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal)<>70 OR EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal AND t.tgenabled<>'D') THEN RAISE EXCEPTION 'Expected 70 disabled triggers; reconcile before retry'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.update_updated_at_column()'::regprocedure AND md5(prosrc)='%s' AND NOT prosecdef AND proconfig=ARRAY['search_path=public'] AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND prorettype='trigger'::regtype AND prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')) THEN RAISE EXCEPTION 'Timestamp function changed'; END IF;
 IF (SELECT count(*) FROM (VALUES %s) e(tbl,trg) JOIN pg_class c ON c.relname=e.tbl AND c.relnamespace='public'::regnamespace JOIN pg_trigger t ON t.tgrelid=c.oid AND t.tgname=e.trg WHERE t.tgfoid='public.update_updated_at_column()'::regprocedure AND t.tgtype=19 AND t.tgnargs=0 AND t.tgqual IS NULL AND t.tgattr::text='' AND NOT t.tgisinternal AND c.relrowsecurity AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname='postgres'))<>48 THEN RAISE EXCEPTION 'Timestamp trigger definitions changed'; END IF;
END $guard$;
""" % (hashlib.md5(BODY.encode()).hexdigest(), values)
    activation = '\n'.join(f'ALTER TABLE public.{table} ENABLE TRIGGER {trigger};' for trigger, table in pairs)
    post = """
DO $guard$ BEGIN
 IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal AND t.tgenabled='O' AND t.tgfoid='public.update_updated_at_column()'::regprocedure)<>48 OR (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal AND t.tgenabled='D')<>22 THEN RAISE EXCEPTION 'Timestamp activation mismatch'; END IF;
END $guard$;
SELECT 'PASS: 48 timestamp triggers active; 22 other business triggers remain disabled' AS result;
"""
    return guard + activation + post

ISOLATION = """
SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='2min';
SELECT pg_advisory_xact_lock(19761019,14);
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_database()<>'postgres' THEN RAISE EXCEPTION 'Wrong database role'; END IF;
 IF EXISTS(SELECT 1 FROM auth.sessions) OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal) THEN RAISE EXCEPTION 'Auth isolation mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname IN ('pg_cron','pg_net','pgmq')) OR EXISTS(SELECT 1 FROM storage.buckets WHERE public) OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage') THEN RAISE EXCEPTION 'Isolation mismatch'; END IF;
 IF has_schema_privilege('anon','public','USAGE') OR has_schema_privilege('authenticated','public','CREATE') OR NOT has_schema_privilege('authenticated','public','USAGE') THEN RAISE EXCEPTION 'Reviewed grants missing or changed'; END IF;
END $guard$;
"""

if __name__ == '__main__':
    os.umask(0o077)
    sql = ISOLATION + core((ARCHIVE/'behavior-review/public-triggers-disabled.sql').read_text())
    out = ARCHIVE/f'timestamps-run-{time.time_ns()}'
    out.mkdir(mode=0o700)
    (out/'install.sql').write_text(sql)
    print(out)
