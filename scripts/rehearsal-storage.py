#!/usr/bin/env python3
"""Fixed-target private Storage copy. No deletes, overwrites, public buckets or saved keys."""
from pathlib import Path
import base64, getpass, hashlib, json, os, re, sys, time
import urllib.request, urllib.error, urllib.parse
REF='acgqjjbrnkmeazswdnzp'
BASE=f'https://{REF}.supabase.co/storage/v1'
ARCHIVE=Path('/Users/sumanththota/Schrex/archive')
FILES=ARCHIVE/'storage-2026-10-19'
DB=ARCHIVE/'database-2026-10-19'
LIMIT=50*1024*1024
class Stop(Exception): pass
def require(value,message):
 if not value: raise Stop(message)
def sha(data): return hashlib.sha256(data).hexdigest()
def unescape(s):
 if s=='\\N':return None
 return re.sub(r'\\([0-7]{1,3}|x[0-9a-fA-F]{1,2}|.)',lambda m: chr(int(m[1],8)) if m[1][0] in '01234567' else chr(int(m[1][1:],16)) if m[1].startswith('x') else {'b':'\b','t':'\t','n':'\n','r':'\r','f':'\f','v':'\v'}.get(m[1],m[1]),s)
def storage_rows(sql):
 tables={}; current=None; cols=[]
 for line in sql.splitlines():
  if current:
   if line=='\\.':current=None;continue
   values=[unescape(x) for x in line.split('\t')]
   require(len(cols)==len(values),'Malformed storage capture')
   tables[current].append(dict(zip(cols,values)));continue
  m=re.match(r'^COPY storage\.(buckets|objects) \((.*)\) FROM stdin;$',line)
  if m:
   current=m[1];require(current not in tables,'Duplicate storage section')
   cols=m[2].split(', ');tables[current]=[]
 require(current is None and set(tables)=={'buckets','objects'},'Incomplete storage capture')
 return tables
def safe_path(bucket,name):
 require(re.fullmatch(r'[a-z0-9-]+',bucket),'Unexpected bucket')
 require(name and not name.startswith('/') and all(x not in ('','.','..') for x in name.split('/')),'Unsafe object path')
 p=FILES/'objects'/bucket/name
 require(p.resolve()==p and p.is_file(),'Missing file or symlink path')
 return p
def load_plan():
 reports=sorted((DB/'inspection').glob('destination-data-*.sql.comparison.json'))
 require(reports,'Database comparison missing')
 report=json.loads(reports[-1].read_text())
 require(report.get('passed') and report.get('destinationTables')==62,'Database comparison not passed')
 capture=DB/'inspection'/report['capture']
 require(sha(capture.read_bytes())==report['captureSha256'],'Comparison capture changed')
 tables=storage_rows((DB/'inspection/selected-data.sql').read_text())
 buckets={b['id']:b for b in tables['buckets'] if b['id']!='database_export_19_10_26'}
 manifest=json.loads((FILES/'manifest.json').read_text())
 entries={(f['bucket'],f['object_path']):f for f in manifest['files']}
 objects={(o['bucket_id'],o['name']):o for o in tables['objects']}
 require(len(buckets)==15 and len(entries)==23 and len(objects)==23 and entries.keys()==objects.keys(),'Unexpected inventory')
 for b in buckets.values():
  require(b['type']=='STANDARD' and b['allowed_mime_types'] is None,'Bucket settings need review')
 for key,f in entries.items():
  require(key[0] in buckets,'Unknown bucket')
  data=safe_path(*key).read_bytes();meta=json.loads(objects[key]['metadata'])
  require(len(data)==f['size']==meta['size'] and sha(data)==f['sha256'] and len(data)<=LIMIT,'Local file verification failed')
  require(isinstance(meta.get('mimetype'),str) and '\n' not in meta['mimetype'] and '\r' not in meta['mimetype'],'Invalid content type')
 return buckets,entries,objects
def validate_key(key):
 try: claims=json.loads(base64.urlsafe_b64decode(key.split('.')[1]+'==='))
 except Exception:raise Stop('Use the existing legacy service_role key, not the database password or anon key')
 require(claims.get('ref')==REF and claims.get('role')=='service_role','Key does not identify hub-rehearsal service_role')
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
class API:
 def __init__(self,key):
  self.key=key;self.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
 def call(self,method,path,body=None,headers=None,raw=False):
  h={'apikey':self.key,'Authorization':'Bearer '+self.key}
  if isinstance(body,(dict,list)):body=json.dumps(body).encode();h['Content-Type']='application/json'
  h.update(headers or {})
  try:
   with self.opener.open(urllib.request.Request(BASE+path,data=body,headers=h,method=method),timeout=120) as response:
    data=response.read()
  except urllib.error.HTTPError as e:raise Stop(f'Storage HTTP {e.code}; no automatic retry; remote state must be checked') from None
  except Exception:raise Stop('Storage connection failed; no automatic retry; remote state may be partial') from None
  return data if raw else json.loads(data)
def route(bucket,name=''):
 return urllib.parse.quote(bucket,safe='')+('/'+urllib.parse.quote(name,safe='/') if name else '')
def inventory(api,bucket):
 found=set();pending=[''];visited=set()
 while pending:
  prefix=pending.pop();require(prefix not in visited,'Repeated folder');visited.add(prefix)
  offset=0
  while True:
   items=api.call('POST','/object/list/'+route(bucket),{'prefix':prefix,'limit':100,'offset':offset,'sortBy':{'column':'name','order':'asc'}})
   require(isinstance(items,list),'Invalid listing')
   for item in items:
    name=item['name'];require(name and '/' not in name and name not in ('.','..'),'Unexpected remote path')
    name=prefix+name
    if item.get('id') is None:pending.append(name+'/')
    else:require(name not in found,'Duplicate object');found.add(name)
   if len(items)<100:break
   offset+=100;require(offset<10000,'Listing exceeded expected size')
 return found
def run(api,buckets,entries,objects,save):
 remote=api.call('GET','/bucket?limit=100&offset=0')
 require(isinstance(remote,list) and len(remote)<100,'Unexpected bucket listing')
 existing={b['id']:b for b in remote}
 require(set(existing)<=set(buckets),'Unexpected destination buckets; refusing changes')
 known={}
 for b in existing:
  require(existing[b].get('public') is False,'Destination bucket is public; stop')
  known[b]=inventory(api,b)
  require(known[b]<={name for bucket,name in entries if bucket==b},'Unexpected destination objects; refusing changes')
 # Verify existing bytes before any mutation, allowing safe resume without overwrite.
 for (bucket,name),f in entries.items():
  if name in known.get(bucket,set()):
   require(sha(api.call('GET','/object/'+route(bucket,name),raw=True))==f['sha256'],'Existing object differs; refusing overwrite')
 for bucket,b in buckets.items():
  if bucket not in existing:
   effective=min(int(b['file_size_limit']),LIMIT) if b['file_size_limit'] else LIMIT
   api.call('POST','/bucket',{'id':bucket,'name':b['name'],'public':False,'file_size_limit':effective})
 for index,((bucket,name),f) in enumerate(entries.items(),1):
  meta=json.loads(objects[(bucket,name)]['metadata'])
  if name not in known.get(bucket,set()):
   data=safe_path(bucket,name).read_bytes();require(sha(data)==f['sha256'],'Local file changed')
   api.call('POST','/object/'+route(bucket,name),data,{'Content-Type':meta['mimetype'],'Cache-Control':meta.get('cacheControl','max-age=3600'),'x-upsert':'false'})
  downloaded=api.call('GET','/object/'+route(bucket,name),raw=True)
  require(len(downloaded)==f['size'] and sha(downloaded)==f['sha256'],'Uploaded file verification failed')
  save(index);print(f'Verified file {index}/23',flush=True)
 final=api.call('GET','/bucket?limit=100&offset=0')
 require({b['id'] for b in final}==set(buckets) and all(b.get('public') is False for b in final),'Final private bucket check failed')
 for bucket in buckets:require(inventory(api,bucket)=={n for b,n in entries if b==bucket},'Final inventory differs')
def main():
 require(len(sys.argv)==1 and sys.stdin.isatty() and sys.stdout.isatty(),'Run in your own Terminal without arguments')
 os.umask(0o077)
 buckets,entries,objects=load_plan()
 print('Verified local files and database reconciliation. Target: hub-rehearsal only.')
 print('Keep signup, Email provider and Data API disabled; do not deploy workers or change policies.')
 print('Creates 15 PRIVATE buckets and copies 23 files. No overwrites/deletes. Ownership metadata remains a separate follow-up.')
 require(input('Type COPY REHEARSAL FILES: ')=='COPY REHEARSAL FILES','Cancelled')
 key=getpass.getpass('hub-rehearsal legacy service_role key (hidden): ');validate_key(key)
 folder=FILES/f'restore-{time.time_ns()}';folder.mkdir(mode=0o700)
 report={'target':REF,'complete':False,'verified_files':0,'ownership_reconciled':False,'bucket_policy':'all private; size limits capped at 50 MiB'}
 def save(count):
  report['verified_files']=count
  (folder/'report.json').write_text(json.dumps(report,indent=2))
 save(0)
 run(API(key),buckets,entries,objects,save)
 report['complete']=True;save(23)
 print('PASS: 23 file checksums and 15 private bucket inventories verified. Keep access disabled; ownership/policies remain pending.')
if __name__=='__main__':
 try:main()
 except Stop as e:print('STOP:',str(e),file=sys.stderr);sys.exit(1)
 except (Exception,KeyboardInterrupt):print('Stopped. No automatic retry; private run evidence may describe partial progress. Do not share keys or raw API responses.',file=sys.stderr);sys.exit(1)
