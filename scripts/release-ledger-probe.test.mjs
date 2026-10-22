import { it, expect, vi } from 'vitest';
import { probeLedger } from './release-ledger-probe.mjs';
const revision = 'a'.repeat(40);
const env = { GITHUB_REF: 'refs/heads/main', GITHUB_WORKFLOW_SHA: revision, GITHUB_RUN_ID: '123', GITHUB_REPOSITORY: 'test/repo' };
it('writes only a separate non-production ledger and deactivates its own record', async () => {
  const api = vi.fn(async route => route === 'branches/main' ? { commit: { sha: revision } } : { id: 42 });
  expect((await probeLedger(env, api)).outcome).toBe('ledger-write-verified');
  expect(api.mock.calls[1]).toEqual(['deployments', expect.objectContaining({
    environment: 'release-ledger-readiness', task: 'schreiber-ledger-probe',
    production_environment: false, transient_environment: true, auto_merge: false, required_contexts: [],
    payload: { schema: 'schreiber-ledger-probe-v1', run: '123' },
  })]);
  expect(api.mock.calls.slice(2).map(([route, body]) => [route, body.state, body.auto_inactive])).toEqual([
    ['deployments/42/statuses', 'in_progress', false], ['deployments/42/statuses', 'inactive', false],
  ]);
});
it('refuses stale workflows before metadata mutation', async () => {
  const api = vi.fn(async () => ({ commit: { sha: 'b'.repeat(40) } }));
  await expect(probeLedger(env, api)).rejects.toThrow('current main'); expect(api).toHaveBeenCalledTimes(1);
});
it('preserves created record identity when status publication fails', async () => {
  const records = [];
  const api = vi.fn(async route => {
    if (route === 'branches/main') return { commit: { sha: revision } };
    if (route === 'deployments') return { id: 42 };
    throw new Error('Denied');
  });
  await expect(probeLedger(env, api, r => records.push(structuredClone(r)))).rejects.toThrow('Denied');
  expect(records.at(-1)).toMatchObject({ outcome: 'record-created', deploymentId: 42, productionMutation: false });
});
