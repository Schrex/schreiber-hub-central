import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { perform } from './release-operation.mjs';
import { backend, digest, fileManifest, verifyPayload, validateCandidateRun, validateDeployment, validateIdentity, validateSequence } from './release-policy.mjs';
const revision = 'a'.repeat(40), older = 'b'.repeat(40);
const previous = '11111111-1111-1111-1111-111111111111', target = '22222222-2222-2222-2222-222222222222';
const identity = sha => ({ revision: sha, dirty: false, project: backend, mode: 'independent' });
function setup(operation = 'deploy', mode = 'execute') {
  const input = { operation, mode, revision, previous, target, run: '123', hash: 'c'.repeat(64), enabled: 'true',
    confirmation: `${operation.toUpperCase()} ${revision}`, recoveryReference: 'https://example.test/recovery', workflowRevision: revision };
  const receipts = [];
  const deps = { main: vi.fn(async () => revision), ancestor: vi.fn(async () => true), candidate: vi.fn(async () => {}),
    current: vi.fn(async () => ({ id: previous, info: identity(older) })), target: vi.fn(async () => ({ info: identity(revision) })),
    checkLedger: vi.fn(async () => {}), reserve: vi.fn(async () => 42), status: vi.fn(async () => {}),
    upload: vi.fn(async () => target), rollback: vi.fn(async () => target), verify: vi.fn(async () => {}),
    record: value => receipts.push(structuredClone(value)) };
  return { input, deps, receipts };
}
describe('manual release state machine (no network)', () => {
  it.each(['deploy', 'recover'])('plans %s without contacting Cloudflare', async operation => {
    const { input, deps } = setup(operation, 'plan'); input.enabled = ''; input.confirmation = '';
    expect((await perform(input, deps)).outcome).toBe('planned');
    for (const method of ['current', 'target', 'upload', 'rollback', 'verify', 'checkLedger', 'reserve', 'status']) expect(deps[method]).not.toHaveBeenCalled();
  });
  it.each(['deploy', 'recover'])('preflights %s with provider reads but no mutations', async operation => {
    const { input, deps } = setup(operation, 'preflight'); input.enabled = ''; input.confirmation = '';
    const receipt = await perform(input, deps);
    expect(receipt.outcome).toBe('preflight-passed');
    expect(receipt.ledgerWriteVerified).toBe(false);
    expect(deps.current).toHaveBeenCalled(); expect(deps.checkLedger).toHaveBeenCalled();
    if (operation === 'deploy') expect(deps.verify).toHaveBeenCalledWith(expect.objectContaining({ revision: older }), previous);
    else expect(deps.target).toHaveBeenCalledWith(target);
    for (const method of ['upload', 'rollback', 'reserve', 'status']) expect(deps[method]).not.toHaveBeenCalled();
  });
  it('preflight fails on provider authentication failure without mutating', async () => {
    const { input, deps } = setup('deploy', 'preflight'); deps.current.mockRejectedValue(new Error('Access denied'));
    await expect(perform(input, deps)).rejects.toThrow('Access denied');
    expect(deps.reserve).not.toHaveBeenCalled(); expect(deps.upload).not.toHaveBeenCalled();
  });
  it.each(['ledger', 'main', 'deployment', 'target', 'identity'])('preflight fails closed on %s failure', async failure => {
    const { input, deps } = setup(['target', 'identity'].includes(failure) ? 'recover' : 'deploy', 'preflight');
    if (failure === 'ledger') deps.checkLedger.mockRejectedValue(new Error('Ledger read denied'));
    if (failure === 'main') deps.main.mockResolvedValueOnce(revision).mockResolvedValueOnce(older);
    if (failure === 'deployment') deps.current.mockResolvedValueOnce({ id: previous, info: identity(older) }).mockRejectedValueOnce(new Error('Deployment changed'));
    if (failure === 'target') deps.target.mockRejectedValue(new Error('Target unavailable'));
    if (failure === 'identity') deps.target.mockResolvedValue({ info: { ...identity(revision), project: 'wrong' } });
    await expect(perform(input, deps)).rejects.toThrow();
    for (const method of ['upload', 'rollback', 'reserve', 'status']) expect(deps[method]).not.toHaveBeenCalled();
  });
  it.each(['enabled', 'confirmation', 'recoveryReference'])('requires execution %s', async field => {
    const { input, deps } = setup(); input[field] = '';
    await expect(perform(input, deps)).rejects.toThrow(); expect(deps.upload).not.toHaveBeenCalled();
  });
  it('refuses mutation if ledger reservation fails', async () => {
    const { input, deps } = setup(); deps.reserve.mockRejectedValue(new Error('Ledger unavailable'));
    await expect(perform(input, deps)).rejects.toThrow('Ledger unavailable'); expect(deps.upload).not.toHaveBeenCalled();
  });
  it('rejects old queued and repeated runs even after rollback restored the original deployment ID', () => {
    const entries = [{ payload: { schema: 'schreiber-frontend-v1', runNumber: '12' } }];
    for (const number of ['10', '12']) expect(() => validateSequence(number, entries)).toThrow('Older');
    expect(() => validateSequence('13', entries)).not.toThrow();
    expect(() => validateSequence('13', [{ payload: {} }])).toThrow();
  });
  it('uploads exactly once and verifies before reporting success', async () => {
    const { input, deps, receipts } = setup(); expect((await perform(input, deps)).outcome).toBe('verified');
    expect(deps.upload).toHaveBeenCalledTimes(1); expect(deps.current).toHaveBeenCalledTimes(3);
    expect(receipts.map(r => r.outcome)).toEqual(['planned', 'reserved', 'mutation-outcome-unknown', 'applied-unverified', 'verified']);
  });
  it('rejects stale dispatch workflow before credential operations', async () => {
    const { input, deps } = setup(); input.workflowRevision = older;
    await expect(perform(input, deps)).rejects.toThrow('stale'); expect(deps.current).not.toHaveBeenCalled();
  });
  it('rejects stale selected source', async () => {
    const { input, deps } = setup(); input.revision = older; input.confirmation = `DEPLOY ${older}`;
    await expect(perform(input, deps)).rejects.toThrow('current main'); expect(deps.upload).not.toHaveBeenCalled();
  });
  it('rejects sources outside main history', async () => {
    const { input, deps } = setup('recover'); deps.ancestor.mockResolvedValue(false);
    await expect(perform(input, deps)).rejects.toThrow('history'); expect(deps.rollback).not.toHaveBeenCalled();
  });
  it('rejects duplicate releases', async () => {
    const { input, deps } = setup(); deps.current.mockResolvedValue({ id: previous, info: identity(revision) });
    await expect(perform(input, deps)).rejects.toThrow('Duplicate'); expect(deps.upload).not.toHaveBeenCalled();
  });
  it('refuses an operation when provider state changed during preparation', async () => {
    const { input, deps } = setup(); deps.current.mockResolvedValueOnce({ id: previous, info: identity(older) }).mockRejectedValueOnce(new Error('Deployment changed'));
    await expect(perform(input, deps)).rejects.toThrow('changed'); expect(deps.upload).not.toHaveBeenCalled();
  });
  it('refuses a newly changed main tip', async () => {
    const { input, deps } = setup(); deps.main.mockResolvedValueOnce(revision).mockResolvedValueOnce(older);
    await expect(perform(input, deps)).rejects.toThrow('Main changed'); expect(deps.upload).not.toHaveBeenCalled();
  });
  it('does not retry a lost upload response', async () => {
    const { input, deps, receipts } = setup(); deps.upload.mockRejectedValue(new Error('timeout'));
    await expect(perform(input, deps)).rejects.toThrow('Inspect receipt');
    expect(deps.upload).toHaveBeenCalledTimes(1); expect(deps.rollback).not.toHaveBeenCalled(); expect(receipts.at(-1).outcome).toBe('mutation-outcome-unknown');
  });
  it('preserves verified frontend outcome when ledger status publication fails', async () => {
    const { input, deps, receipts } = setup(); deps.status.mockRejectedValue(new Error('API unavailable'));
    await expect(perform(input, deps)).rejects.toThrow('Frontend verified');
    expect(receipts.at(-1).outcome).toBe('verified'); expect(receipts.at(-1).ledgerStatus).toBe('update-failed');
    expect(deps.upload).toHaveBeenCalledTimes(1); expect(deps.rollback).not.toHaveBeenCalled();
  });
  it('does not automatically roll back after a smoke failure', async () => {
    const { input, deps, receipts } = setup(); deps.verify.mockRejectedValue(new Error('unavailable'));
    await expect(perform(input, deps)).rejects.toThrow(); expect(deps.rollback).not.toHaveBeenCalled(); expect(receipts.at(-1).outcome).toBe('applied-unverified');
  });
  it('recovers when current frontend identity cannot be served', async () => {
    const { input, deps } = setup('recover'); deps.current.mockResolvedValue({ id: previous });
    expect((await perform(input, deps)).outcome).toBe('verified'); expect(deps.rollback).toHaveBeenCalledExactlyOnceWith(target); expect(deps.upload).not.toHaveBeenCalled();
  });
  it('refuses wrong-backend recovery targets', async () => {
    const { input, deps } = setup('recover'); deps.target.mockResolvedValue({ info: { ...identity(revision), project: 'wrong' } });
    await expect(perform(input, deps)).rejects.toThrow('identity'); expect(deps.rollback).not.toHaveBeenCalled();
  });
});
describe('artifact and provider trust', () => {
  const run = { repository: { full_name: 'Schrex/schreiber-hub-central' }, head_sha: revision, head_branch: 'main', event: 'workflow_dispatch', path: '.github/workflows/release-candidate.yml', status: 'completed', conclusion: 'success' };
  it.each([{ event: 'pull_request' }, { head_branch: 'develop' }, { conclusion: 'failure' }, { path: '.github/workflows/release-build.yml' }, { repository: { full_name: 'fork/repo' } }])('rejects untrusted candidate %j', patch => {
    expect(() => validateCandidateRun({ ...run, ...patch }, 'Schrex/schreiber-hub-central', revision)).toThrow();
  });
  it('rejects preview and mismatched provider deployments', () => {
    const deployment = { id: target, environment: 'production', latest_stage: { name: 'deploy', status: 'success' }, url: 'https://abcdef12.schreiber-hub-preview.pages.dev' };
    expect(validateDeployment(deployment, target)).toContain('pages.dev');
    for (const patch of [{ environment: 'preview' }, { id: previous }, { url: 'https://evil.test' }, { url: 'https://user:pass@abcdef12.schreiber-hub-preview.pages.dev' }, { latest_stage: { name: 'deploy', status: 'failure' } }]) expect(() => validateDeployment({ ...deployment, ...patch }, target)).toThrow();
  });
  it('allows historical identity for native recovery but rejects dry-run identity', () => {
    expect(() => validateIdentity(identity(revision), revision)).not.toThrow();
    expect(() => validateIdentity({ ...identity(revision), deployable: false }, revision)).toThrow();
  });
  it('checks the approved digest and all files, rejecting extra code, tampering and links', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'release-test-')); const frontend = path.join(root, 'frontend'); mkdirSync(frontend);
    try {
      for (const name of ['index.html', '_headers', '_redirects']) writeFileSync(path.join(frontend, name), 'synthetic');
      writeFileSync(path.join(frontend, 'build-info.json'), JSON.stringify({ ...identity(revision), deployable: true }));
      const raw = JSON.stringify({ schema: 1, deployable: true, revision, project: backend, dirty: false, files: fileManifest(frontend) });
      writeFileSync(path.join(root, 'release.json'), raw);
      expect(verifyPayload(root, digest(raw), revision).revision).toBe(revision);
      expect(() => verifyPayload(root, 'd'.repeat(64), revision)).toThrow('digest');
      writeFileSync(path.join(frontend, 'index.html'), 'tampered'); expect(() => verifyPayload(root, digest(raw), revision)).toThrow('differs');
      writeFileSync(path.join(frontend, '_worker.js'), 'evil'); expect(() => fileManifest(frontend)).toThrow('static'); rmSync(path.join(frontend, '_worker.js'));
      symlinkSync('/etc/passwd', path.join(frontend, 'linked')); expect(() => fileManifest(frontend)).toThrow('links');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
