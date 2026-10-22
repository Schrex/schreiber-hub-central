#!/usr/bin/env python3
"""Restore original ownership through Storage API; secrets stay in process memory."""
import base64, getpass, hashlib, hmac, importlib.util, json, os, sys, time, uuid
from pathlib import Path
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('storage_copy', Path(__file__).with_name('rehearsal-storage.py'))
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)

def signing_secret(key, secret):
 s.validate_key(key)
 parts=key.split('.')
 s.require(len(parts)==3,'Invalid key')
 header=json.loads(base64.urlsafe_b64decode(parts[0]+'==='))
 s.require(header.get('alg')=='HS256','Legacy HS256 key required; no key rotation is performed')
 expected=base64.urlsafe_b64encode(hmac.new(secret.encode(),'.'.join(parts[:2]).encode(),hashlib.sha256).digest()).decode().rstrip('=')
 s.require(hmac.compare_digest(expected,parts[2]),'Signing secret does not match the rehearsal key')

def token(secret, owner):
 s.require(str(uuid.UUID(owner))==owner,'Unexpected source owner')
 def enc(value):return base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).decode().rstrip('=')
 now=int(time.time())
 value=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'iss':'supabase','ref':s.REF,'role':'service_role','sub':owner,'iat':now,'exp':now+300})
 return value+'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),value.encode(),hashlib.sha256).digest()).decode().rstrip('=')

def plan():
 buckets,entries,objects=s.load_plan()
 selected=[]
 for key,obj in objects.items():
  s.require(obj['owner']==obj['owner_id'],'Source owner fields differ; manual review required')
  s.require(json.loads(obj['user_metadata'] or '{}') in ({},None),'Nonempty custom metadata needs review')
  if obj['owner_id']:
   s.require(str(uuid.UUID(obj['owner_id']))==obj['owner_id'],'Invalid source owner')
   selected.append(key)
 s.require(len(selected)==13,'Unexpected ownership correction count')
 return buckets,entries,objects,selected

def correct(api,secret,buckets,entries,objects,selected,save):
 # Existing copy helper verifies every byte and exact inventory without writes when complete.
 remote=api.call('GET','/bucket?limit=100&offset=0')
 s.require({b['id'] for b in remote}==set(buckets) and all(b.get('public') is False for b in remote),'Private bucket inventory differs')
 for bucket in buckets:
  s.require(s.inventory(api,bucket)=={name for b,name in entries if b==bucket},'File inventory differs')
 for key,f in entries.items():
  s.require(s.sha(api.call('GET','/object/'+s.route(*key),raw=True))==f['sha256'],'Existing bytes differ; refusing update')
 for index,key in enumerate(selected,1):
  obj=objects[key]; f=entries[key]; data=s.safe_path(*key).read_bytes(); meta=json.loads(obj['metadata'])
  s.require(s.sha(data)==f['sha256'],'Local bytes changed')
  # Repeat the read immediately before each identical-byte update.
  s.require(s.sha(api.call('GET','/object/'+s.route(*key),raw=True))==f['sha256'],'Remote bytes changed')
  save(index-1,True)
  api.call('PUT','/object/'+s.route(*key),data,{'Content-Type':meta['mimetype'],'Cache-Control':meta.get('cacheControl','max-age=3600'),'Authorization':'Bearer '+token(secret,obj['owner_id'])})
  result=api.call('GET','/object/'+s.route(*key),raw=True)
  s.require(len(result)==f['size'] and s.sha(result)==f['sha256'],'Updated bytes differ; stop')
  save(index,False)
  print(f'Updated and byte-verified ownership request {index}/13',flush=True)

def main():
 s.require(len(sys.argv)==1 or sys.argv[1:]==['--apply'],'Only --apply is accepted')
 buckets,entries,objects,selected=plan()
 print('Plan verified: 13 ownership updates; 23 files checked locally. Fixed target: hub-rehearsal.')
 if len(sys.argv)==1:
  print('No network calls or changes. --apply requires private credentials and isolation confirmation.');return
 s.require(sys.stdin.isatty() and sys.stdout.isatty(),'Use your own interactive Terminal')
 s.require(not list(s.FILES.glob('ownership-*')),'An ownership run exists. Reconcile it read-only before any retry; do not delete evidence')
 print('Keep signup, Email and Data API OFF, all buckets private, no policies/workers/client access.')
 print('Updates the same bytes using original owner IDs. Final read-only ownership comparison is still required.')
 s.require(input('Type RESTORE REHEARSAL OWNERS: ')=='RESTORE REHEARSAL OWNERS','Cancelled')
 key=getpass.getpass('Rehearsal legacy service_role key (hidden): ')
 secret=getpass.getpass('Rehearsal legacy JWT signing secret (hidden): ')
 signing_secret(key,secret)
 os.umask(0o077)
 folder=s.FILES/f'ownership-{time.time_ns()}';folder.mkdir(mode=0o700)
 report={'target':s.REF,'requests_byte_verified':0,'request_in_flight':False,'api_updates_complete':False,'ownership_reconciled':False}
 def save(count,pending):
  report.update(requests_byte_verified=count,request_in_flight=pending)
  (folder/'report.json').write_text(json.dumps(report,indent=2))
 save(0,False)
 correct(s.API(key),secret,buckets,entries,objects,selected,save)
 report['api_updates_complete']=True;save(13,False)
 print('API updates and byte checks complete. Keep access OFF. Run the independent read-only metadata comparison next.')

if __name__=='__main__':
 try:main()
 except s.Stop as e:print('STOP:',str(e),file=sys.stderr);sys.exit(1)
 except (Exception,KeyboardInterrupt):print('Stopped. No automatic retry. Reconcile private evidence before continuing; do not share credentials.',file=sys.stderr);sys.exit(1)
