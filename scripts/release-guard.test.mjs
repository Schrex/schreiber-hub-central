import { describe, it, expect } from 'vitest';
import { validateRelease, requiredJobs } from './release-guard.mjs';
const sha = 'a'.repeat(40);
const fixture = () => ({ ref: 'refs/heads/main', sha, main: sha, repository: 'Schrex/schreiber-hub-central', run: { head_sha: sha, head_branch: 'main', event: 'push', path: '.github/workflows/verify.yml', repository: { full_name: 'Schrex/schreiber-hub-central' }, status: 'completed', conclusion: 'success' }, jobs: requiredJobs.map(name => ({ name, status: 'completed', conclusion: 'success' })) });
describe('release trust boundary', () => {
  it('accepts exact verified main source', () => expect(() => validateRelease(fixture())).not.toThrow());
  it.each([{ ref: 'refs/heads/develop' }, { sha: 'main' }, { sha: 'a'.repeat(7) }, { main: 'b'.repeat(40) }, { run: undefined }, { jobs: [] }])('rejects invalid source/evidence %j', patch => expect(() => validateRelease({ ...fixture(), ...patch })).toThrow());
  it.each([{ event: 'pull_request' }, { head_sha: 'b'.repeat(40) }, { head_branch: 'develop' }, { path: 'other.yml' }, { repository: { full_name: 'attacker/fork' } }, { status: 'in_progress' }, { conclusion: 'failure' }])('rejects untrusted runs %j', patch => {
    const data = fixture(); Object.assign(data.run, patch); expect(() => validateRelease(data)).toThrow();
  });
  it.each(['skipped', 'cancelled', 'failure', 'neutral'])('rejects a %s matrix job', conclusion => {
    const data = fixture(); data.jobs[4].conclusion = conclusion; expect(() => validateRelease(data)).toThrow();
  });
});
