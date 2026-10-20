#!/usr/bin/env python3
"""Build an isolated rehearsal policy fix. No connections or saved credentials."""
import hashlib, os, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ARCHIVE=Path('/Users/sumanththota/Schrex/archive/database-2026-10-19')
CANDIDATE=ROOT/'local/candidate-migrations/20261019220000_attendance_policy_recursion.sql'
PIN='2b911cf268b0bd04f5d14305288f6beb9d3c49c2a80cee5a769afe08bbef7c9c'
PREFLIGHT="""
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='2min';
SET LOCAL search_path=public,pg_catalog;
SELECT pg_advisory_xact_lock(19761019,12);
DO $guard$
BEGIN
 IF current_user<>'postgres' OR current_database()<>'postgres' THEN RAISE EXCEPTION 'Unexpected role/database'; END IF;
 IF to_regprocedure('public.is_current_user_talk_attendee(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Helper already exists; reconcile before retry'; END IF;
 IF has_schema_privilege('anon','public','USAGE') OR has_schema_privilege('authenticated','public','USAGE') THEN RAISE EXCEPTION 'Client schema access already enabled'; END IF;
 IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace)<>70 OR EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace AND t.tgenabled<>'D') THEN RAISE EXCEPTION 'Expected 70 disabled business triggers'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal) THEN RAISE EXCEPTION 'Auth trigger already active'; END IF;
 IF (SELECT count(*) FROM pg_class WHERE oid IN ('public.toolbox_talk_sessions'::regclass,'public.toolbox_talk_attendees'::regclass) AND relowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND relrowsecurity AND NOT relforcerowsecurity)<>2 THEN RAISE EXCEPTION 'Unexpected table ownership/RLS'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.toolbox_talk_sessions'::regclass AND polname='Attendees view their session' AND polcmd='r' AND polpermissive AND polroles=ARRAY[(SELECT oid FROM pg_roles WHERE rolname='authenticated')] AND md5(pg_get_expr(polqual,polrelid))='f90525fb8badb5274be97c56eeee31b5') THEN RAISE EXCEPTION 'Source policy changed'; END IF;
END $guard$;
"""
POSTCHECK="""
DO $guard$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.is_current_user_talk_attendee(uuid)'::regprocedure AND prosecdef AND provolatile='s' AND proconfig=ARRAY['search_path=pg_catalog'] AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres')) THEN RAISE EXCEPTION 'Helper security mismatch'; END IF;
 IF has_function_privilege('anon','public.is_current_user_talk_attendee(uuid)','EXECUTE') OR NOT has_function_privilege('authenticated','public.is_current_user_talk_attendee(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Helper grants mismatch'; END IF;
 IF has_schema_privilege('authenticated','public','USAGE') OR has_schema_privilege('anon','public','USAGE') THEN RAISE EXCEPTION 'Client access unexpectedly enabled'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.toolbox_talk_sessions'::regclass AND polname='Attendees view their session' AND pg_get_expr(polqual,polrelid)='is_current_user_talk_attendee(id)') THEN RAISE EXCEPTION 'Policy postcheck failed'; END IF;
END $guard$;
SELECT 'PASS: attendance recursion candidate installed; client access and business triggers remain disabled' AS result;
"""
def build(candidate):
 if hashlib.sha256(candidate.encode()).hexdigest()!=PIN:raise ValueError('Reviewed candidate changed')
 return PREFLIGHT+candidate+POSTCHECK
if __name__=='__main__':
 os.umask(0o077)
 sql=build(CANDIDATE.read_text())
 out=ARCHIVE/f'attendance-run-{time.time_ns()}';out.mkdir(mode=0o700)
 (out/'install.sql').write_text(sql)
 print(out)
