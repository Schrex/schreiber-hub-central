import importlib.util, unittest, tempfile, json
from pathlib import Path
spec=importlib.util.spec_from_file_location('storage',Path(__file__).with_name('rehearsal-storage.py'));s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
class Fake:
 def __init__(self):self.buckets={};self.files={};self.writes=0;self.fail=False
 def call(self,method,path,body=None,headers=None,raw=False):
  if method=='GET' and path.startswith('/bucket?'):return list(self.buckets.values())
  if path.startswith('/object/list/'):
   bucket=path.split('/')[-1];return [{'id':'id','name':name} for b,name in self.files if b==bucket]
  if method=='GET':return self.files[tuple(path.removeprefix('/object/').split('/',1))]
  self.writes+=1
  if self.fail:raise s.Stop('simulated ambiguous upload')
  if path=='/bucket':self.buckets[body['id']]=body;return {}
  assert headers['x-upsert']=='false'
  key=tuple(path.removeprefix('/object/').split('/',1));assert key not in self.files
  self.files[key]=body;return {}
class Checks(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.old=s.FILES;s.FILES=Path(self.tmp.name).resolve()
  p=s.FILES/'objects'/'test';p.mkdir(parents=True);(p/'sample.txt').write_bytes(b'synthetic')
  self.b={'test':{'name':'test','file_size_limit':None}}
  self.e={('test','sample.txt'):{'sha256':s.sha(b'synthetic'),'size':9}}
  self.o={('test','sample.txt'):{'metadata':json.dumps({'mimetype':'text/plain'})}}
 def tearDown(self):s.FILES=self.old;self.tmp.cleanup()
 def test_upload_verify_resume(self):
  api=Fake();s.run(api,self.b,self.e,self.o,lambda _:None);self.assertEqual(api.writes,2)
  s.run(api,self.b,self.e,self.o,lambda _:None);self.assertEqual(api.writes,2)
 def test_refuse_public(self):
  api=Fake();api.buckets={'test':{'id':'test','public':True}}
  with self.assertRaises(s.Stop):s.run(api,self.b,self.e,self.o,lambda _:None)
  self.assertEqual(api.writes,0)
 def test_refuse_different_existing_file(self):
  api=Fake();api.buckets={'test':{'id':'test','public':False}};api.files={('test','sample.txt'):b'changed'}
  with self.assertRaises(s.Stop):s.run(api,self.b,self.e,self.o,lambda _:None)
  self.assertEqual(api.writes,0)
 def test_no_retry_on_failure(self):
  api=Fake();api.fail=True
  with self.assertRaises(s.Stop):s.run(api,self.b,self.e,self.o,lambda _:None)
  self.assertEqual(api.writes,1)
 def test_bad_paths_and_keys(self):
  for name in ['../secret','/secret','a//b']:
   with self.assertRaises(s.Stop):s.safe_path('test',name)
  with self.assertRaises(s.Stop):s.validate_key('not-a-key')
if __name__=='__main__':unittest.main()
