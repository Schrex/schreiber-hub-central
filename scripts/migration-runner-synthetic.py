# Explicit synthetic-only integration test. Reads schema definitions, NEVER data SQL.
# Requires the existing local server and private schema captures. Does not reset staging.
from pathlib import Path
import subprocess, uuid
repo=Path(__file__).resolve().parent.parent
import json
parts=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {preflight,verificationSql} from './scripts/migration-runner.mjs'; console.log(JSON.stringify({guard:preflight,verify:verificationSql({'auth.users':1,'auth.identities':0,'public.jobs':1})}));"],cwd=repo))
r=Path('/Users/sumanththota/Schrex/archive/database-2026-10-19'); db='runner_synthetic_'+uuid.uuid4().hex[:10]
def run(args,sql=None,fail=False):
 p=subprocess.run(['docker','exec','-i','supabase_db_schreiber-local',*args],input=sql,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if (p.returncode!=0)!=fail:
  Path('/tmp/runner-synthetic-error.log').write_bytes(p.stderr); raise RuntimeError('Unexpected outcome; synthetic diagnostic in /tmp/runner-synthetic-error.log')
 return p.stdout.decode()
def query(sql,fail=False,role='postgres'):return run(['psql','-X','-U',role,'-d',db,'-At','-v','ON_ERROR_STOP=1','--single-transaction'],sql.encode(),fail)
run(['createdb','-U','postgres',db])
try:
 baseline='CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions; CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;\n'+sorted((r/'inspection').glob('destination-schema-*.sql'))[-1].read_text()
 query(baseline)
 query((repo/'scripts/rehearsal/block-email.sql').read_text())
 assert '403' in query("SET LOCAL ROLE supabase_auth_admin; SELECT rehearsal_guard.block_email('{}'::jsonb);",role="supabase_admin")
 query("SET LOCAL ROLE anon; SELECT rehearsal_guard.block_email('{}'::jsonb);",True)
 guard=parts['guard'].replace("current_database() <> 'postgres'",f"current_database() <> '{db}'")
 schema=(r/'candidate-import/public-pre.sql').read_text()+'\n'+(r/'candidate-import/public-post.sql').read_text()
 synthetic="INSERT INTO auth.users(id,email,encrypted_password) VALUES ('00000000-0000-4000-8000-000000000099','runner@example.test','synthetic-not-a-password-hash'); INSERT INTO public.jobs(name) VALUES ('Synthetic runner test');"
 body=guard+schema+synthetic+parts['verify']
 # Same single-transaction/error-stop flags as the runner. All row fixtures synthetic.
 query(body+'\nSELECT 1/0;',True)
 assert query("SELECT count(*) FROM auth.users;").strip()=='0'
 assert query("SELECT count(*) FROM pg_tables WHERE schemaname='public';").strip()=='0'
 query(body)
 query(guard,True) # Repeat import must refuse without clearing data.
 assert query("SELECT count(*) FROM auth.users;").strip()=='1'
 query('SET LOCAL ROLE authenticated; SELECT * FROM public.jobs;',True)
 print('PASS: mail blocker/Auth role, anon denial, full rollback on error, synthetic commit, nonempty rerun refusal, client table denial.')
finally:
 run(['dropdb','-U','postgres',db]); print('Removed disposable test database; no real rows loaded.')
