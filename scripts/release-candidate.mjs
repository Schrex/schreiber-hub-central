import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, appendFileSync } from 'node:fs';
import { backend, digest, fileManifest, forwardingId, functionsManifest, requireValue, verifyPayload } from './release-policy.mjs';
import { validateDestination } from './independent-build.mjs';
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
requireValue(revision === process.env.GITHUB_WORKFLOW_SHA && revision === process.env.RELEASE_SHA && !execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), 'Clean selected source required.');
const config = { project: backend, url: `https://${backend}.supabase.co`, key: process.env.PRODUCTION_SUPABASE_ANON_KEY };
validateDestination(config); // No source .env fallback; no privileged client credentials.
requireValue(config.key.split('.')[2] !== 'synthetic', 'A synthetic key is not a production candidate.');
execFileSync(process.execPath, ['scripts/independent-build.mjs'], { input: JSON.stringify(config), stdio: ['pipe', 'inherit', 'inherit'] });
const infoPath = 'dist/independent/build-info.json';
const info = JSON.parse(readFileSync(infoPath));
requireValue(info.revision === revision && !info.dirty && info.project === backend, 'Build identity mismatch.');
// The approved Daily Schedule forwarding function (#98) travels in the artifact beside the
// static files; build-info names it so the live deployment can be checked later.
writeFileSync(infoPath, JSON.stringify({ ...info, deployable: true, functions: forwardingId }, null, 2) + '\n');
rmSync('dist/release-candidate', { recursive: true, force: true });
mkdirSync('dist/release-candidate', { recursive: true });
cpSync('dist/independent', 'dist/release-candidate/frontend', { recursive: true });
cpSync('functions', 'dist/release-candidate/functions', { recursive: true });
const manifest = JSON.stringify({ schema: 1, deployable: true, revision, project: backend, dirty: false,
  run: process.env.GITHUB_RUN_ID, workflowRevision: process.env.GITHUB_WORKFLOW_SHA,
  verification: process.env.VERIFICATION_URL, files: fileManifest('dist/release-candidate/frontend'),
  functions: functionsManifest('dist/release-candidate/functions') }, null, 2) + '\n';
writeFileSync('dist/release-candidate/release.json', manifest);
verifyPayload('dist/release-candidate', digest(manifest), revision); // Same check the upload runs.
const summary = `Candidate ${revision}\nApproved manifest SHA256: ${digest(manifest)}\nNo deployment performed.\n`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
