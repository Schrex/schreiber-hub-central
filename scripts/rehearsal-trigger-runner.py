#!/usr/bin/env python3
"""Prepare a pinned, disabled-only trigger transaction. No network or credentials."""
from pathlib import Path
import hashlib, os, time
ROOT=Path('/Users/sumanththota/Schrex/archive/database-2026-10-19')
PINS={'public-triggers-disabled.sql':'995142ef62107a6a32d73cc6e723d56704d1e51c338ff1afc948627b276086e8','trigger-function-check.sql':'76575b3a0c7adb2ea497e78f4599e5fb80ca3caf0ebc162169cfb9eee976a5de'}
def build(parts):
 for name,digest in PINS.items():
  if hashlib.sha256(parts[name].encode()).hexdigest()!=digest:raise ValueError('Reviewed file changed')
 query=parts['trigger-function-check.sql'].strip().removesuffix(';')
 guard="""
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '2min';
SELECT pg_advisory_xact_lock(19761019, 11);
DO $guard$
DECLARE result json;
BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'Wrong database role'; END IF;
 IF EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND (c.relnamespace='public'::regnamespace OR c.oid='auth.users'::regclass)) THEN RAISE EXCEPTION 'Triggers already exist; reconcile before retry'; END IF;
 IF EXISTS (SELECT 1 FROM pg_extension WHERE extname IN ('pg_cron','pg_net','pgmq')) THEN RAISE EXCEPTION 'Outbound extensions present'; END IF;
 IF (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND relrowsecurity)<>60 THEN RAISE EXCEPTION 'Unexpected business tables'; END IF;
 IF EXISTS (SELECT 1 FROM storage.buckets WHERE public) THEN RAISE EXCEPTION 'Public bucket present'; END IF;
 IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage') THEN RAISE EXCEPTION 'Storage policies present'; END IF;
"""
 guard+='SELECT q.json_build_object INTO result FROM ('+query+') q;\n'
 guard+="IF (result->>'expected')::int<>20 OR (result->>'matching')::int<>20 OR (result->>'missing')::int<>0 THEN RAISE EXCEPTION 'Function comparison failed'; END IF;\nEND $guard$;\n"
 post="""
DO $guard$
BEGIN
 IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace)<>70 OR EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace AND t.tgenabled<>'D') THEN RAISE EXCEPTION 'Disabled trigger postcheck failed'; END IF;
END $guard$;
SELECT 'PASS: 70 business triggers installed disabled; no activation' AS result;
"""
 return guard+parts['public-triggers-disabled.sql']+post
if __name__=='__main__':
 os.umask(0o077)
 parts={name:(ROOT/'behavior-review'/name).read_text() for name in PINS}
 sql=build(parts)
 out=ROOT/f'trigger-run-{time.time_ns()}';out.mkdir(mode=0o700)
 (out/'install.sql').write_text(sql)
 print(out)
