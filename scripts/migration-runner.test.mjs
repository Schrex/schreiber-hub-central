import { describe, it, expect } from 'vitest';
import { dataCounts, verifyParts, verificationSql, preflight } from './migration-runner.mjs';
describe('inert baseline runner guards', () => {
 it('rejects missing or altered artifacts', () => {
  expect(() => verifyParts({})).toThrow('mismatch');
  expect(() => verifyParts({'public-pre.sql':'SELECT 1;'})).toThrow('mismatch');
 });
 it('counts COPY payload without interpreting its contents as SQL', () => {
  expect(dataCounts('COPY public.jobs (name) FROM stdin;\nDROP TABLE jobs;\n\\.\n')).toEqual({'public.jobs':1});
 });
 it('rejects duplicate, unclosed or out-of-scope COPY', () => {
  for (const sql of ['COPY auth.users (id) FROM stdin;\nx\n', 'COPY vault.secrets (id) FROM stdin;', 'COPY auth.users (id) FROM stdin;\n\\.\nCOPY auth.users (id) FROM stdin;\n\\.']) expect(() => dataCounts(sql)).toThrow();
 });
 it('rejects SQL identifier injection and invalid counts', () => {
  expect(() => verificationSql({'public.jobs;DROP SCHEMA auth':1})).toThrow();
  expect(() => verificationSql({'public.jobs':-1})).toThrow();
 });
 it('keeps clients closed and fails on nonempty or active destinations', () => {
  const sql=verificationSql({'public.jobs':1});
  expect(sql).toContain('REVOKE ALL ON ALL FUNCTIONS');
  expect(sql).not.toMatch(/GRANT|DISABLE TRIGGER|session_replication_role/);
  expect(preflight).toContain('Destination is not empty');
  expect(preflight).toContain('Unexpected scheduler/network/queue');
  expect(preflight).toContain('Unexpected account mutation trigger');
 });
});
