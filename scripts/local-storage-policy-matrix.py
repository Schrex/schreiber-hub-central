#!/usr/bin/env python3
"""Rollback-only synthetic RLS matrix on a temporary metadata table; no file API calls."""
from pathlib import Path
import re,subprocess

def query(sql):
 p=subprocess.run(['docker','exec','-i','supabase_db_schreiber-local','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres'],input=sql,text=True,capture_output=True)
 if p.returncode:raise RuntimeError(p.stderr)
 return p.stdout
policies=(Path(__file__).parent/'rehearsal/storage-policies.sql').read_text()
buckets=sorted(set(re.findall(r"bucket_id = '([^']+)'",policies)))
assert len(buckets)==15 and policies.count('CREATE POLICY ')==57
sql="""BEGIN; SELECT pg_advisory_xact_lock(19761019,99);
SET LOCAL statement_timeout='90s';
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT n.nspname,c.relname,t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('auth','public','pgmq') LOOP
 EXECUTE format('ALTER TABLE %I.%I DISABLE TRIGGER %I',r.nspname,r.relname,r.tgname);
 END LOOP;
END $$;
CREATE TEMP TABLE storage_probe(id int,name text,bucket_id text,metadata jsonb DEFAULT '{}');
ALTER TABLE storage_probe ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage_probe TO authenticated,anon;
"""+policies.replace('ON storage.objects','ON storage_probe')
roles=['employee','foreman','office','admin']
for i,role in enumerate(roles,1):
 uid=f'd9000000-0000-4000-8000-{i:012d}'
 sql+=f"INSERT INTO auth.users(id,email) VALUES('{uid}','storage-matrix-{i}@example.test'); INSERT INTO public.user_roles(user_id,role) VALUES('{uid}','{role}');\n"

def allowed(bucket,role,own,op):
 if role=='anon':return False
 elevated=role in ['foreman','office','admin']; office=role in ['office','admin']
 if op=='SELECT':
  if bucket in ['accident-photos','safety-violation-photos','onboarding-signed','shop-waivers']:return own or office
  if bucket in ['talk-audio','job-submittals']:return elevated
  return True
 if bucket in ['job-plans','job-photos','permits']:return elevated
 if bucket in ['handbook','job-contracts','job-estimates','job-submittals','swpppp-reports']:return office
 if bucket=='onboarding-templates':return role=='admin'
 if bucket=='talk-media':return role=='admin' and op in ['INSERT','UPDATE']
 if bucket=='talk-audio':return role in ['foreman','admin']
 if bucket=='accident-photos':return own if op=='INSERT' else office
 if bucket=='safety-violation-photos':return (own and elevated) if op=='INSERT' else office if op=='DELETE' else False
 if bucket in ['onboarding-signed','shop-waivers']:return own and op=='INSERT'
 raise AssertionError(bucket)
count=0
for i,role in enumerate(['anon']+roles):
 uid=f'd9000000-0000-4000-8000-{i:012d}'
 for bucket in buckets:
  for own in [True,False]:
   folder=uid if own else 'd9000000-0000-4000-8000-999999999999'
   path=folder+'/probe.txt'
   for op in ['SELECT','INSERT','UPDATE','DELETE']:
    expect=allowed(bucket,role,own,op);count+=1
    sql+=f"RESET ROLE; TRUNCATE storage_probe; INSERT INTO storage_probe VALUES(1,'{path}','{bucket}','{{}}'); SELECT set_config('request.jwt.claim.sub','{uid if role!='anon' else ''}',true); SET LOCAL ROLE {'anon' if role=='anon' else 'authenticated'};\n"
    stmt={'SELECT':'SELECT count(*) INTO n FROM storage_probe','INSERT':f"INSERT INTO storage_probe(id,name,bucket_id) VALUES(2,'{path}','{bucket}'); GET DIAGNOSTICS n=ROW_COUNT",'UPDATE':"UPDATE storage_probe SET metadata='{\"changed\":true}' WHERE id=1; GET DIAGNOSTICS n=ROW_COUNT",'DELETE':'DELETE FROM storage_probe WHERE id=1; GET DIAGNOSTICS n=ROW_COUNT'}[op]
    sql+=f"""DO $$ DECLARE n int:=0; denied boolean:=false; BEGIN
 BEGIN {stmt}; EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF {'denied OR n<>1' if expect else 'NOT denied AND n<>0'} THEN RAISE EXCEPTION 'Matrix mismatch: {role} {bucket} {own} {op}'; END IF;
END $$;
RESET ROLE;
"""
    if not expect and op!='SELECT':
     sql+="DO $$ BEGIN IF (SELECT count(*) FROM storage_probe)<>1 OR NOT EXISTS(SELECT 1 FROM storage_probe WHERE id=1 AND metadata='{}'::jsonb) THEN RAISE EXCEPTION 'Denied operation changed metadata'; END IF; END $$;\n"
sql+='ROLLBACK;'
query(sql)
print(f'PASS: {count} role/bucket/ownership/operation checks across 57 policies; rejected mutations preserve metadata. Transaction rolled back. Temporary metadata RLS only; Storage HTTP/byte authorization not certified.')
