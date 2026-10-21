#!/usr/bin/env python3
"""Build fixed-target permissions preparation; does not enable login or Data API."""
from pathlib import Path
import hashlib, os, time
ROOT=Path(__file__).resolve().parents[1]
ARCHIVE=Path('/Users/sumanththota/Schrex/archive/database-2026-10-19')
DRAFT=ARCHIVE/'behavior-review/combined-authenticated-grants-review.sql'
PIN='838741a6ae62662ee92ceb03f32aa17aff34b687750faca28df4e3f7992036eb'
FUNCTIONS=['has_role(uuid, public.app_role)','list_employee_directory()','get_attendee_by_token(text)','get_employee_contact_sensitive(uuid)','is_current_user_talk_attendee(uuid)']
def permissions(text):
 if hashlib.sha256(text.encode()).hexdigest()!=PIN:raise ValueError('Reviewed draft changed')
 statements=[line[3:] for line in text.splitlines() if line.startswith('-- GRANT ')]
 if len(statements)!=123:raise ValueError('Unexpected grant count')
 revoke="""
REVOKE ALL ON SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC,anon,authenticated;
DO $columns$ DECLARE r record; BEGIN
 FOR r IN SELECT c.relname,a.attname FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','v','p') AND a.attnum>0 AND NOT a.attisdropped LOOP
 EXECUTE format('REVOKE ALL (%I) ON TABLE public.%I FROM PUBLIC,anon,authenticated',r.attname,r.relname);
 END LOOP;
END $columns$;
"""
 return revoke+'\n'.join(statements)+'\nGRANT EXECUTE ON FUNCTION public.is_current_user_talk_attendee(uuid) TO authenticated;\n'
PREFLIGHT="""
SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='2min';
SET LOCAL search_path=public,pg_catalog;
SELECT pg_advisory_xact_lock(19761019,13);
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_database()<>'postgres' THEN RAISE EXCEPTION 'Wrong database role'; END IF;
 IF has_schema_privilege('anon','public','USAGE') OR has_schema_privilege('authenticated','public','USAGE') THEN RAISE EXCEPTION 'Permissions already enabled; reconcile before retry'; END IF;
 IF (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relrowsecurity AND relowner=(SELECT oid FROM pg_roles WHERE rolname='postgres'))<>60 THEN RAISE EXCEPTION 'Table ownership/RLS mismatch'; END IF;
 IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace)<>70 OR EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace AND t.tgenabled<>'D') THEN RAISE EXCEPTION 'Expected 70 disabled triggers'; END IF;
 IF EXISTS(SELECT 1 FROM auth.sessions) OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal) THEN RAISE EXCEPTION 'Auth state not isolated'; END IF;
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname IN ('pg_cron','pg_net','pgmq')) OR EXISTS(SELECT 1 FROM storage.buckets WHERE public) OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage') THEN RAISE EXCEPTION 'Rehearsal isolation mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.toolbox_talk_sessions'::regclass AND polname='Attendees view their session' AND pg_get_expr(polqual,polrelid)='is_current_user_talk_attendee(id)') THEN RAISE EXCEPTION 'Attendance candidate missing'; END IF;
 IF (SELECT count(*) FROM (VALUES ('public.has_role(uuid, public.app_role)','dae5cfc5a8d92461a428f6702e4e65af','search_path=public'),('public.list_employee_directory()','3632c662ef1d9b83bbb9103336eb522c','search_path=public'),('public.get_attendee_by_token(text)','253b136532bb25becc6f4fc592c2ad98','search_path=public'),('public.get_employee_contact_sensitive(uuid)','cdc55ab238909836700d83caa5c7c922','search_path=public'),('public.is_current_user_talk_attendee(uuid)','9c7401ac62e72592c6e341d32a9f4a48','search_path=pg_catalog')) AS e(signature,fingerprint,config) JOIN pg_proc p ON p.oid=to_regprocedure(e.signature) WHERE md5(p.prosrc)=e.fingerprint AND p.prosecdef AND p.proconfig=ARRAY[e.config] AND p.proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres'))<>5 THEN RAISE EXCEPTION 'Reviewed function definitions changed'; END IF;
END $guard$;
"""
def postcheck():
 allowed=','.join("'public."+f+"'::regprocedure" for f in FUNCTIONS)
 return """
DO $guard$ DECLARE r record; BEGIN
 IF has_schema_privilege('anon','public','USAGE') OR has_schema_privilege('authenticated','public','CREATE') THEN RAISE EXCEPTION 'Schema access mismatch'; END IF;
 IF NOT has_schema_privilege('authenticated','public','USAGE') THEN RAISE EXCEPTION 'Missing schema usage'; END IF;
 FOR r IN SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','v','p') LOOP
 IF has_table_privilege('authenticated',r.oid,'TRUNCATE') OR has_table_privilege('authenticated',r.oid,'TRIGGER') OR has_table_privilege('authenticated',r.oid,'REFERENCES') OR has_table_privilege('authenticated',r.oid,'MAINTAIN') THEN RAISE EXCEPTION 'Management privilege present'; END IF;
 END LOOP;
 IF has_column_privilege('authenticated','public.employee_contacts','ssn','SELECT') OR has_column_privilege('authenticated','public.toolbox_talk_attendees','access_token','SELECT') THEN RAISE EXCEPTION 'Sensitive column exposed'; END IF;
 FOR r IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace LOOP
 IF has_function_privilege('anon',r.oid,'EXECUTE') THEN RAISE EXCEPTION 'Anonymous function access'; END IF;
 IF has_function_privilege('authenticated',r.oid,'EXECUTE') IS DISTINCT FROM (r.oid IN ("""+allowed+""")) THEN RAISE EXCEPTION 'Function allowlist mismatch'; END IF;
 END LOOP;
END $guard$;
SELECT 'PASS: reviewed grants installed; keep login/Data API/workers OFF and business triggers disabled' AS result;
"""
if __name__=='__main__':
 os.umask(0o077)
 sql=PREFLIGHT+permissions(DRAFT.read_text())+postcheck()
 out=ARCHIVE/f'grants-run-{time.time_ns()}';out.mkdir(mode=0o700)
 (out/'install.sql').write_text(sql)
 print(out)
