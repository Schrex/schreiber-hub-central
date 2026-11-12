import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
export const project = 'schreiber-hub-preview';
export const backend = 'acgqjjbrnkmeazswdnzp';
export const shaPattern = /^[a-f0-9]{40}$/;
export const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function requireValue(condition, message) { if (!condition) throw new Error(message); }
// Daily Schedule forwarding (#98): the only Pages Function and routing file a release may
// carry. Changing either file changes its hash, and the guard then refuses the build until
// this approved list is changed in a reviewed PR.
export const forwarding = Object.freeze({
  routes: '2d0bd2ea48403c66ac8e690c0e1d506e6942944003f0ba7c29e633d0ee8491dc', // public/_routes.json
  functions: Object.freeze({ 'daily-schedule/[[path]].js': '143ff0ae57d7d9d91c331b5ff7c68c922b23f45ca33e7a50eed2644c566f813d' }),
});
// Recorded in build-info.json, so a live deployment that uses Functions can show it was built
// with exactly the approved forwarding.
export const forwardingId = digest(JSON.stringify(forwarding));
export function validateIdentity(info, revision, deployable = false) {
  requireValue(shaPattern.test(revision) && info.revision === revision && info.dirty === false &&
    info.project === backend && info.mode === 'independent' && info.deployable !== false &&
    (info.functions === undefined || info.functions === forwardingId) &&
    (!deployable || info.deployable === true), 'Build identity/backend is not approved.');
}
// A deployment may run Functions only when its own build identity names the approved forwarding.
export function validateFunctions(deployment, info) {
  requireValue(deployment.uses_functions !== true || info?.functions === forwardingId, 'Deployment uses unapproved Functions.');
}
// The approved Functions folder, file by file: anything else, a changed file or a link is refused.
export function functionsManifest(root) {
  const files = {};
  function walk(relative = '') {
    for (const name of readdirSync(path.join(root, relative)).sort()) {
      const key = relative ? `${relative}/${name}` : name;
      const stat = lstatSync(path.join(root, key));
      requireValue(!stat.isSymbolicLink(), 'Artifact links are forbidden.');
      if (stat.isDirectory()) {
        requireValue(Object.keys(forwarding.functions).some(file => file.startsWith(`${key}/`)), 'Only the approved forwarding function is permitted.');
        walk(key);
      } else {
        requireValue(stat.isFile() && Object.hasOwn(forwarding.functions, key), 'Only the approved forwarding function is permitted.');
        files[key] = digest(readFileSync(path.join(root, key)));
        requireValue(files[key] === forwarding.functions[key], 'Forwarding function differs from the approved file.');
      }
    }
  }
  walk();
  requireValue(JSON.stringify(Object.keys(files)) === JSON.stringify(Object.keys(forwarding.functions).sort()), 'Approved forwarding function is incomplete.');
  return files;
}
export function fileManifest(root) {
  const files = {};
  let total = 0;
  function walk(relative = '') {
    for (const name of readdirSync(path.join(root, relative)).sort()) {
      const key = relative ? `${relative}/${name}` : name;
      requireValue(/^[a-zA-Z0-9_/-][a-zA-Z0-9_. /-]*$/.test(key) && !name.startsWith('.') &&
        (name !== '_routes.json' || !relative) &&
        !['functions', '_worker.js', 'wrangler.toml', 'wrangler.json', 'wrangler.jsonc', 'node_modules'].includes(name), 'Only static frontend files are permitted.');
      const file = path.join(root, key); const stat = lstatSync(file);
      requireValue(!stat.isSymbolicLink(), 'Artifact links are forbidden.');
      if (stat.isDirectory()) walk(key);
      else {
        requireValue(stat.isFile() && stat.size <= 25 * 1024 * 1024, 'Invalid or oversized artifact file.');
        total += stat.size;
        requireValue(total <= 100 * 1024 * 1024 && Object.keys(files).length < 1000, 'Artifact exceeds release limits.');
        files[key] = digest(readFileSync(file));
        requireValue(key !== '_routes.json' || files[key] === forwarding.routes, 'Only the approved _routes.json is permitted.');
      }
    }
  }
  walk(); return files;
}
export function verifyPayload(root, expectedDigest, revision) {
  requireValue(/^[a-f0-9]{64}$/.test(expectedDigest), 'Full approved manifest SHA256 required.');
  const layout = readdirSync(root).sort().join(',');
  const forwarded = layout === 'frontend,functions,release.json';
  requireValue(lstatSync(root).isDirectory() && !lstatSync(root).isSymbolicLink() &&
    (forwarded || layout === 'frontend,release.json') &&
    (!forwarded || (lstatSync(path.join(root, 'functions')).isDirectory() && !lstatSync(path.join(root, 'functions')).isSymbolicLink())) &&
    lstatSync(path.join(root, 'frontend')).isDirectory() && !lstatSync(path.join(root, 'frontend')).isSymbolicLink() &&
    lstatSync(path.join(root, 'release.json')).isFile() && !lstatSync(path.join(root, 'release.json')).isSymbolicLink(), 'Unexpected artifact layout.');
  const raw = readFileSync(path.join(root, 'release.json'));
  requireValue(digest(raw) === expectedDigest, 'Approved artifact manifest digest mismatch.');
  const manifest = JSON.parse(raw);
  requireValue(manifest.schema === 1 && manifest.deployable === true && manifest.revision === revision && manifest.project === backend && manifest.dirty === false, 'Not a production candidate.');
  const files = fileManifest(path.join(root, 'frontend'));
  requireValue(JSON.stringify(files) === JSON.stringify(manifest.files), 'Artifact content differs from approved manifest.');
  for (const key of ['index.html', 'build-info.json', '_redirects', '_headers']) requireValue(files[key], `Missing ${key}.`);
  const info = JSON.parse(readFileSync(path.join(root, 'frontend/build-info.json')));
  validateIdentity(info, revision, true);
  // The forwarding function, its routing file and the identity marker come together or not at all.
  if (forwarded) requireValue(JSON.stringify(functionsManifest(path.join(root, 'functions'))) === JSON.stringify(manifest.functions) &&
    files['_routes.json'] === forwarding.routes && info.functions === forwardingId, 'Forwarding function, routing file and identity must match the approved set.');
  else requireValue(manifest.functions === undefined && !files['_routes.json'] && info.functions === undefined, 'Routing file or Functions identity without the approved function.');
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
  requireValue(idPattern.test(expectedId) && deployment.id === expectedId && deployment.environment === 'production' &&
    deployment.latest_stage?.name === 'deploy' && deployment.latest_stage.status === 'success', 'Expected successful production deployment not found.');
  return deploymentURL(deployment);
}
export function validateOperation(input) {
  requireValue(['plan', 'preflight', 'execute'].includes(input.mode) && ['deploy', 'recover'].includes(input.operation), 'Invalid operation/mode.');
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
