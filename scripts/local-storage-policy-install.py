#!/usr/bin/env python3
"""Rollback-only installer-core check on the local managed Storage table."""
from pathlib import Path
import importlib.util,subprocess
ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('policies',ROOT/'rehearsal-storage-policies-runner.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def q(sql):
 p=subprocess.run(['docker','exec','-i','supabase_db_schreiber-local','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres'],input=sql,text=True,capture_output=True)
 if p.returncode:raise RuntimeError(p.stderr)
 return p.stdout.strip()
fingerprint="SELECT md5((SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY policyname)::text,'') FROM pg_policies p WHERE schemaname='storage')||(SELECT jsonb_agg(jsonb_build_array(id,public) ORDER BY id)::text FROM storage.buckets));"
before=q(fingerprint)
s=(ROOT/'rehearsal/storage-policies.sql').read_text()
setup="""BEGIN; SELECT pg_advisory_xact_lock(19761019,99);
DO $$ DECLARE r record; BEGIN FOR r IN SELECT * FROM pg_policies WHERE schemaname='storage' LOOP EXECUTE format('DROP POLICY %I ON storage.%I',r.policyname,r.tablename); END LOOP; END $$;
UPDATE storage.buckets SET public=false;
SET LOCAL ROLE postgres;
"""
print(q(setup+m.core(s)+'ROLLBACK;'))
try:
 q(setup+m.core(s)+m.core(s)+'ROLLBACK;');raise AssertionError('Repeat accepted')
except RuntimeError as e:assert 'Storage policies already present' in str(e),str(e)
try:
 m.core(s+'\n');raise AssertionError('Tamper accepted')
except ValueError:pass
assert q(fingerprint)==before
print('PASS installer core/postcheck as local postgres, repeated install and tamper rejected, original policies/bucket flags restored. Hosted authority and environment guards require operator run.')
