import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
export const project = 'schreiber-hub-preview';
export const backend = 'acgqjjbrnkmeazswdnzp';
export const shaPattern = /^[a-f0-9]{40}$/;
export const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function requireValue(condition, message) { if (!condition) throw new Error(message); }
export function validateIdentity(info, revision, deployable = false) {
  requireValue(shaPattern.test(revision) && info.revision === revision && info.dirty === false &&
    info.project === backend && info.mode === 'independent' && info.deployable !== false &&
    (!deployable || info.deployable === true), 'Build identity/backend is not approved.');
}
export function fileManifest(root) {
  const files = {};
  let total = 0;
  function walk(relative = '') {
    for (const name of readdirSync(path.join(root, relative)).sort()) {
      const key = relative ? `${relative}/${name}` : name;
      requireValue(/^[a-zA-Z0-9_/-][a-zA-Z0-9_. /-]*$/.test(key) && !name.startsWith('.') &&
        !['functions', '_worker.js', '_routes.json', 'wrangler.toml', 'wrangler.json', 'wrangler.jsonc', 'node_modules'].includes(name), 'Only static frontend files are permitted.');
      const file = path.join(root, key); const stat = lstatSync(file);
      requireValue(!stat.isSymbolicLink(), 'Artifact links are forbidden.');
      if (stat.isDirectory()) walk(key);
      else {
        requireValue(stat.isFile() && stat.size <= 25 * 1024 * 1024, 'Invalid or oversized artifact file.');
        total += stat.size;
        requireValue(total <= 100 * 1024 * 1024 && Object.keys(files).length < 1000, 'Artifact exceeds release limits.');
        files[key] = digest(readFileSync(file));
      }
    }
  }
  walk(); return files;
}
export function verifyPayload(root, expectedDigest, revision) {
  requireValue(/^[a-f0-9]{64}$/.test(expectedDigest), 'Full approved manifest SHA256 required.');
  requireValue(lstatSync(root).isDirectory() && !lstatSync(root).isSymbolicLink() &&
    readdirSync(root).sort().join(',') === 'frontend,release.json' &&
    lstatSync(path.join(root, 'frontend')).isDirectory() && !lstatSync(path.join(root, 'frontend')).isSymbolicLink() &&
    lstatSync(path.join(root, 'release.json')).isFile() && !lstatSync(path.join(root, 'release.json')).isSymbolicLink(), 'Unexpected artifact layout.');
  const raw = readFileSync(path.join(root, 'release.json'));
  requireValue(digest(raw) === expectedDigest, 'Approved artifact manifest digest mismatch.');
  const manifest = JSON.parse(raw);
  requireValue(manifest.schema === 1 && manifest.deployable === true && manifest.revision === revision && manifest.project === backend && manifest.dirty === false, 'Not a production candidate.');
  const files = fileManifest(path.join(root, 'frontend'));
  requireValue(JSON.stringify(files) === JSON.stringify(manifest.files), 'Artifact content differs from approved manifest.');
  for (const key of ['index.html', 'build-info.json', '_redirects', '_headers']) requireValue(files[key], `Missing ${key}.`);
  validateIdentity(JSON.parse(readFileSync(path.join(root, 'frontend/build-info.json'))), revision, true);
  return manifest;
}
export function validateCandidateRun(run, repository, revision) {
  requireValue(run.repository?.full_name === repository && run.head_sha === revision && run.head_branch === 'main' &&
    run.event === 'workflow_dispatch' && run.path === '.github/workflows/release-candidate.yml' &&
    run.status === 'completed' && run.conclusion === 'success', 'Candidate must come from a successful trusted main build.');
}
export function deploymentURL(deployment) {
  const url = new URL(deployment.url);
  requireValue(url.protocol === 'https:' && /^[a-z0-9-]+\.schreiber-hub-preview\.pages\.dev$/.test(url.hostname) &&
    !url.username && !url.password && !url.port && url.pathname === '/' && !url.search && !url.hash, 'Unrecognized immutable deployment URL.');
  return url.origin;
}
export function validateDeployment(deployment, expectedId) {
  requireValue(idPattern.test(expectedId) && deployment.id === expectedId && deployment.environment === 'production' && deployment.uses_functions !== true &&
    deployment.latest_stage?.name === 'deploy' && deployment.latest_stage.status === 'success', 'Expected successful production deployment not found.');
  return deploymentURL(deployment);
}
export function validateOperation(input) {
  requireValue(['plan', 'execute'].includes(input.mode) && ['deploy', 'recover'].includes(input.operation), 'Invalid operation/mode.');
  requireValue(shaPattern.test(input.revision) && idPattern.test(input.previous), 'Exact revision and current deployment ID required.');
  if (input.operation === 'recover') requireValue(idPattern.test(input.target) && input.target !== input.previous, 'Select a different recovery deployment.');
  else requireValue(/^[1-9][0-9]*$/.test(input.run ?? '') && /^[a-f0-9]{64}$/.test(input.hash ?? ''), 'Approved candidate run and manifest digest required.');
  if (input.mode === 'execute') requireValue(input.enabled === 'true' && input.confirmation === `${input.operation.toUpperCase()} ${input.revision}` && /^https:\/\/\S+$/.test(input.recoveryReference ?? ''), 'Execution needs activation, exact confirmation and a durable recovery reference.');
}

export function validateSequence(runNumber, entries) {
  requireValue(/^[1-9][0-9]*$/.test(runNumber ?? ''), 'Operation sequence required.');
  for (const entry of entries) {
    const data = typeof entry.payload === 'string' ? JSON.parse(entry.payload) : entry.payload;
    requireValue(data?.schema === 'schreiber-frontend-v1' && /^[1-9][0-9]*$/.test(data.runNumber ?? '') &&
      BigInt(runNumber) > BigInt(data.runNumber), 'Older/repeated operation refused by persistent release ledger. Dispatch a new reviewed operation.');
  }
}
