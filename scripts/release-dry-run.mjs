// Deliberately no credential input and no network/upload code.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (revision !== process.env.RELEASE_SHA || execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) {
  throw new Error('A clean checkout of the selected commit is required.');
}
const project = 'acgqjjbrnkmeazswdnzp';
const key = ['synthetic', Buffer.from(JSON.stringify({ role: 'anon', ref: project })).toString('base64url'), 'synthetic'].join('.');
execFileSync(process.execPath, ['scripts/independent-build.mjs'], {
  input: JSON.stringify({ project, url: `https://${project}.supabase.co`, key }), stdio: ['pipe', 'inherit', 'inherit'],
});
const infoPath = 'dist/independent/build-info.json';
const info = JSON.parse(readFileSync(infoPath));
if (info.revision !== revision || info.dirty || info.project !== project || info.mode !== 'independent') throw new Error('Build identity mismatch.');
writeFileSync(infoPath, JSON.stringify({ ...info, deployable: false, purpose: 'release-dry-run', credential: 'synthetic-invalid-signature' }, null, 2));
mkdirSync('dist/release-dry-run', { recursive: true });
execFileSync('tar', ['-czf', 'dist/release-dry-run/frontend-NOT-FOR-DEPLOYMENT.tar.gz', '-C', 'dist/independent', '.']);
const sha256 = createHash('sha256').update(readFileSync('dist/release-dry-run/frontend-NOT-FOR-DEPLOYMENT.tar.gz')).digest('hex');
writeFileSync('dist/release-dry-run/release.json', JSON.stringify({ revision, dirty: false, project, mode: 'independent', deployable: false, sha256, workflowRevision: process.env.GITHUB_WORKFLOW_SHA ?? null, run: process.env.GITHUB_RUN_ID ?? null, verification: process.env.VERIFICATION_URL ?? null }, null, 2));
console.log(`Build-only artifact SHA256: ${sha256}. Not deployable; no hosted requests made.`);
