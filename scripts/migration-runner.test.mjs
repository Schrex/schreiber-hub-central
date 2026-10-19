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

import { orderAuthAccounts } from './migration-runner.mjs';
export const syntheticAccounts = 'COPY auth.identities (id, provider_id, user_id, provider, identity_data) FROM stdin;\n00000000-0000-4000-8000-000000000098\tsynthetic-provider\t00000000-0000-4000-8000-000000000099\temail\t{}\n\\.\nCOPY auth.users (id, email, encrypted_password) FROM stdin;\n00000000-0000-4000-8000-000000000099\trunner@example.test\tsynthetic-not-a-password-hash\n\\.\n';
describe('Auth account dependency order', () => {
 it('moves complete COPY blocks without changing a single payload byte', () => {
  const ordered=orderAuthAccounts(syntheticAccounts);
  expect(ordered.indexOf('COPY auth.users')).toBe(0);
  expect(dataCounts(ordered)).toEqual(dataCounts(syntheticAccounts));
  const blocks=syntheticAccounts.match(/^COPY[\s\S]*?^\\\.\n/gm);
  expect(ordered).toBe(blocks[1]+blocks[0]);
  expect(orderAuthAccounts(ordered)).toBe(ordered);
 });
 it('rejects missing or truncated accounts', () => {
  expect(()=>orderAuthAccounts('COPY auth.users (id) FROM stdin;\nx\n')).toThrow();
 });
});
