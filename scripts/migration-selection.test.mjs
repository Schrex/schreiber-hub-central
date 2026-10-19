import { describe, it, expect } from 'vitest';
import { selectRestoreStages } from './migration-selection.mjs';
const base = '1; 0 1 TABLE DATA auth users owner\n2; 0 2 TABLE DATA auth identities owner\n3; 0 3 TABLE DATA public jobs owner';
describe('candidate restore TOC selection', () => {
 it('preserves business history and sequences without importing scheduler history', () => {
  const p=selectRestoreStages(base+'\n4; 0 4 TABLE DATA public pay_audit_log owner\n5; 0 5 TABLE DATA cron job_run_details owner\n6; 0 6 SEQUENCE SET public job_seq owner');
  expect(p.public_data).toHaveLength(3); expect(p.deferred).toHaveLength(1);
 });
 it('defers all triggers, grants and source mail executable objects', () => {
  const lines=['FUNCTION public email_queue_dispatch() owner','FUNCTION public email_queue_wake() owner','TRIGGER public jobs jobs_trigger owner','ACL public TABLE jobs owner','EVENT TRIGGER - hook owner'];
  const p=selectRestoreStages(base+'\n'+lines.map((x,i)=>`${i+4}; 0 0 ${x}`).join('\n'));
  expect(p.public_schema).toEqual([]);expect(p.deferred).toHaveLength(5);
 });
 it('keeps managed schemas, sessions, Vault and queues out of account load', () => {
  const p=selectRestoreStages(base+'\n4; 0 0 TABLE DATA auth sessions owner\n5; 0 0 TABLE DATA vault secrets owner\n6; 0 0 TABLE DATA pgmq q_auth_emails owner\n7; 0 0 TABLE DATA storage objects owner');
  expect(p.auth_accounts).toHaveLength(2);expect(p.deferred).toHaveLength(4);
 });
 it('retains public constraints and RLS for later staged schema review', () => {
  const p=selectRestoreStages(base+'\n4; 0 0 FK CONSTRAINT public jobs jobs_fk owner\n5; 0 0 ROW SECURITY public jobs owner');
  expect(p.public_schema).toHaveLength(2);
 });
 it('fails closed for duplicate or malformed entries and missing account data', () => {
  expect(()=>selectRestoreStages(base+'\n'+base.split('\n')[0])).toThrow();
  expect(()=>selectRestoreStages(base+'\nnot a TOC entry')).toThrow();
  expect(()=>selectRestoreStages(base.replace('auth users','auth sessions'))).toThrow();
 });
 it('defers unknown object kinds instead of selecting them', () => {
  expect(selectRestoreStages(base+'\n4; 0 0 NEW OBJECT public anything owner').deferred).toHaveLength(1);
 });
});
