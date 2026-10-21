#!/usr/bin/env python3
"""Prepare private, disabled trigger definitions and separate ACL review material."""
import hashlib, json, os, re
from pathlib import Path
ROOT=Path('/Users/sumanththota/Schrex/archive/database-2026-10-19')
def prepare(source):
 triggers=re.findall(r'^CREATE TRIGGER [^;]+;',source,re.M)
 chosen=[]; deferred=[]
 for sql in triggers:
  match=re.fullmatch(r'CREATE TRIGGER (\w+) .*? ON (\w+\.\w+) .*? EXECUTE FUNCTION (\w+\.\w+)\([^;]*\);',sql,re.S)
  if not match:raise ValueError('Unrecognized trigger definition')
  name,table,function=match.groups()
  if table.startswith('public.') or (table=='auth.users' and function=='public.handle_new_user'):
   chosen.append((name,table,sql))
  else:deferred.append((name,table))
 if not chosen or len({(n,t) for n,t,_ in chosen})!=len(chosen):raise ValueError('Missing or duplicate triggers')
 acl=re.findall(r'^(?:GRANT|REVOKE|ALTER DEFAULT PRIVILEGES) [^;]+;',source,re.M)
 public_acl=[x for x in acl if 'public.' in x or 'SCHEMA public' in x]
 # Transaction rollback on any duplicate/missing function; never replace an existing trigger.
 sql='-- REVIEW CANDIDATE ONLY. No hosted runner. Apply only within a reviewed transaction.\n'
 for name,table,definition in chosen:
  sql+=definition+'\nALTER TABLE '+table+' DISABLE TRIGGER '+name+';\n'
 return sql, public_acl, {'disabled_triggers':len(chosen),'deferred_managed_or_queue_triggers':len(deferred),'public_acl_statements_for_review':len(public_acl)}
def main():
 os.umask(0o077)
 source=(ROOT/'inspection/schema-with-acl.sql').read_text()
 sql,acl,report=prepare(source)
 out=ROOT/'behavior-review';out.mkdir(mode=0o700,exist_ok=False)
 (out/'disabled-triggers.sql').write_text(sql)
 public=[];auth=[]
 for definition,table,name in re.findall(r'(CREATE TRIGGER [^;]+;)\nALTER TABLE (\w+\.\w+) DISABLE TRIGGER (\w+);',sql):
  if table.startswith('public.'):
   public.append(definition+'\nALTER TABLE '+table+' DISABLE TRIGGER '+name+';')
  else:
   auth.append('-- '+definition)
 (out/'public-triggers-disabled.sql').write_text('-- REVIEW ONLY: transaction required; no privileges or activation.\n'+'\n'.join(public)+'\n')
 (out/'auth-trigger-review.sql').write_text('-- NOT EXECUTABLE. Creating this trigger activates it immediately.\n-- Hosted postgres can CREATE but cannot DISABLE on the managed Auth table.\n'+'\n'.join(auth)+'\n')
 # Comments only: cannot accidentally execute the broad source privileges.
 (out/'public-grants-review.sql').write_text('\n'.join('-- '+line for statement in acl for line in statement.splitlines())+'\n')
 report['source_sha256']=hashlib.sha256(source.encode()).hexdigest()
 report['trigger_candidate_sha256']=hashlib.sha256(sql.encode()).hexdigest()
 report['applied']=False
 (out/'report.json').write_text(json.dumps(report,indent=2))
 print({k:v for k,v in report.items() if not k.endswith('sha256')})
if __name__=='__main__':main()
