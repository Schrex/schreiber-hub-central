#!/usr/bin/env python3
"""Install reviewed private Storage policies, without enabling login or Data API."""
from pathlib import Path
import hashlib,os,re,time
ROOT=Path(__file__).resolve().parents[1]
ARCHIVE=Path('/Users/sumanththota/Schrex/archive/database-2026-10-19')
PIN='0c86ab70e98f8e44d3d12ddf00c41b1615d76a030011cc9d58b28e57476414b3'

def core(source):
 if hashlib.sha256(source.encode()).hexdigest()!=PIN:raise ValueError('Reviewed policy draft changed')
 names=re.findall(r'^CREATE POLICY "([^"]+)"',source,re.M)
 if len(set(names))!=57:raise ValueError('Unexpected policy inventory')
 names_sql=','.join("'"+n.replace("'","''")+"'" for n in names)
 guard="""
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage') THEN RAISE EXCEPTION 'Storage policies already present; reconcile before retry'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) THEN RAISE EXCEPTION 'Storage RLS absent'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.has_role(uuid,public.app_role)'::regprocedure AND md5(prosrc)='dae5cfc5a8d92461a428f6702e4e65af' AND prosecdef AND proconfig=ARRAY['search_path=public'] AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres')) THEN RAISE EXCEPTION 'Role helper changed'; END IF;
 IF NOT has_function_privilege('authenticated','public.has_role(uuid,public.app_role)','EXECUTE') THEN RAISE EXCEPTION 'Role helper permission missing'; END IF;
END $$;
"""
 post=f"""
DO $$ BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='storage')<>57 OR (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND roles=ARRAY['authenticated']::name[] AND permissive='PERMISSIVE' AND policyname IN ({names_sql}))<>57 THEN RAISE EXCEPTION 'Policy inventory mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE public) THEN RAISE EXCEPTION 'Public bucket present'; END IF;
END $$;
SELECT 'PASS: 57 authenticated Storage policies installed; all buckets private; keep login/API/email/workers OFF' AS result;
"""
 return guard+source+post

ISOLATION="""
SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='2min';
SELECT pg_advisory_xact_lock(19761019,19);
DO $$ BEGIN
 IF current_user<>'postgres' OR current_database()<>'postgres' THEN RAISE EXCEPTION 'Wrong database role'; END IF;
 IF EXISTS(SELECT 1 FROM auth.sessions) OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal) OR EXISTS(SELECT 1 FROM pg_extension WHERE extname IN ('pg_cron','pg_net','pgmq')) THEN RAISE EXCEPTION 'Isolation mismatch'; END IF;
 IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace AND t.tgenabled='O')<>70 THEN RAISE EXCEPTION 'Business trigger state mismatch'; END IF;
 IF (SELECT count(*) FROM storage.buckets)<>15 OR EXISTS(SELECT 1 FROM storage.buckets WHERE public) THEN RAISE EXCEPTION 'Private bucket inventory mismatch'; END IF;
END $$;
"""
if __name__=='__main__':
 os.umask(0o077)
 sql=ISOLATION+core((ROOT/'scripts/rehearsal/storage-policies.sql').read_text())
 out=ARCHIVE/f'storage-policies-run-{time.time_ns()}';out.mkdir(mode=0o700)
 (out/'install.sql').write_text(sql);print(out)
