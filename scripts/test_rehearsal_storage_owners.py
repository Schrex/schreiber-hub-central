import base64, importlib.util, json, tempfile, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('owners',Path(__file__).with_name('rehearsal-storage-owners.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Checks(unittest.TestCase):
 def test_signature_and_subject(self):
  owner='11111111-1111-4111-8111-111111111111'
  key=m.token('synthetic-secret',owner)
  m.signing_secret(key,'synthetic-secret')
  with self.assertRaises(m.s.Stop):m.signing_secret(key,'wrong-secret')
  claims=json.loads(base64.urlsafe_b64decode(key.split('.')[1]+'==='))
  self.assertEqual(claims['sub'],owner)
  self.assertEqual(claims['exp']-claims['iat'],300)
 def test_refuses_public_bucket_before_writes(self):
  class API:
   def call(self,*args,**kwargs):
    assert args[0]=='GET'
    return [{'id':'test','public':True}]
  with self.assertRaises(m.s.Stop):m.correct(API(),'unused',{'test':{}},{},{},[],lambda *x:None)
 def test_changed_bytes_and_ambiguous_write(self):
  with tempfile.TemporaryDirectory() as temp:
   old=m.s.FILES;m.s.FILES=Path(temp).resolve()
   try:
    path=m.s.FILES/'objects/test';path.mkdir(parents=True);(path/'file').write_bytes(b'synthetic')
    class API:
     writes=0;changed=True
     def call(self,method,path,*args,**kwargs):
      if path.startswith('/bucket'):return [{'id':'test','public':False}]
      if path.startswith('/object/list'):return [{'name':'file','id':'id'}]
      if method=='GET':return b'changed' if self.changed else b'synthetic'
      self.writes+=1
      raise m.s.Stop('ambiguous failure')
    api=API();key=('test','file');entries={key:{'sha256':m.s.sha(b'synthetic'),'size':9}}
    objects={key:{'owner_id':'11111111-1111-4111-8111-111111111111','metadata':'{"mimetype":"text/plain"}'}}
    args=(api,'synthetic',{'test':{}},entries,objects,[key],lambda *x:None)
    with self.assertRaises(m.s.Stop):m.correct(*args)
    self.assertEqual(api.writes,0)
    api.changed=False
    with self.assertRaises(m.s.Stop):m.correct(*args)
    self.assertEqual(api.writes,1)
   finally:m.s.FILES=old
if __name__=='__main__':unittest.main()
