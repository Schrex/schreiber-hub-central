import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { backend, project, requireValue, validateOperation, verifyPayload, validateIdentity, validateDeployment } from './release-policy.mjs';
import { github, candidateSource } from './release-github.mjs';

export async function perform(input, deps) {
  validateOperation(input);
  const main = await deps.main();
  requireValue(input.workflowRevision === main, 'Use the current reviewed main workflow; stale dispatch refused.');
  requireValue(await deps.ancestor(input.revision, main), 'Selected source must belong to main history.');
  let artifactId = null;
  if (input.operation === 'deploy') {
    requireValue(input.revision === main, 'Forward release must be current main.');
    artifactId = await deps.candidate(input);
  }
  const receipt = { operation: input.operation, mode: input.mode, revision: input.revision, backend,
    expectedPrevious: input.previous, target: input.target || null, manifestSHA256: input.hash || null,
    artifactId, candidateRun: input.run || null, workflowRevision: input.workflowRevision,
    run: input.operationRun, recoveryReference: input.recoveryReference || null, outcome: 'planned' };
  deps.record(receipt);
  if (input.mode === 'plan') return receipt; // No Cloudflare credential or API required.
  const current = await deps.current(input.previous);
  if (input.operation === 'deploy') {
    validateIdentity(current.info, current.info.revision);
    requireValue(current.info.revision !== input.revision && await deps.ancestor(current.info.revision, input.revision), 'Duplicate/backward release refused; use recovery.');
  } else {
    const target = await deps.target(input.target);
    validateIdentity(target.info, input.revision);
    receipt.targetBuildInfo = target.info;
  }
  // Compare Cloudflare's persistent canonical deployment immediately before mutation.
  // No API CAS exists: out-of-band dashboard/CLI operators must pause during this lane.
  requireValue(await deps.main() === main, 'Main changed during preparation; dispatch again.');
  await deps.current(input.previous);
  receipt.previous = current.id;
  receipt.outcome = 'mutation-outcome-unknown';
  deps.record(receipt); // Preserve this even if the network response is lost.
  try {
    receipt.deployment = input.operation === 'deploy' ? await deps.upload(input) : await deps.rollback(input.target);
    receipt.outcome = 'applied-unverified'; deps.record(receipt);
    await deps.verify(input, receipt.deployment);
    receipt.outcome = 'verified'; deps.record(receipt);
    return receipt;
  } catch {
    deps.record(receipt);
    throw new Error('Release operation failed or is unverified. Inspect receipt/provider state before any retry; no automatic rollback was attempted.');
  }
}

async function main() {
  const env = process.env;
  requireValue(env.GITHUB_REF === 'refs/heads/main', 'Manual operations run only from main.');
  const input = { operation: env.RELEASE_OPERATION, mode: env.RELEASE_MODE, revision: env.RELEASE_SHA,
    previous: env.EXPECTED_DEPLOYMENT, target: env.RECOVERY_DEPLOYMENT, run: env.CANDIDATE_RUN,
    hash: env.ARTIFACT_SHA256, enabled: env.PRODUCTION_FRONTEND_ENABLED, confirmation: env.RELEASE_CONFIRMATION,
    recoveryReference: env.RECOVERY_REFERENCE, workflowRevision: env.GITHUB_WORKFLOW_SHA, operationRun: env.GITHUB_RUN_ID };
  const payload = path.resolve(env.RELEASE_PAYLOAD ?? 'dist/release-payload');
  const recordDir = path.resolve('dist/release-operation');
  mkdirSync(recordDir, { recursive: true });
  const cf = async (suffix = '', method = 'GET') => {
    requireValue(/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID ?? '') && env.CLOUDFLARE_API_TOKEN, 'Explicit Cloudflare account/token required.');
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${project}${suffix}`, {
      method, redirect: 'error', headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` }, signal: AbortSignal.timeout(30000),
    });
    requireValue(response.ok, `Cloudflare request failed (${response.status}); inspect provider state before retry.`);
    const body = await response.json(); requireValue(body.success, 'Cloudflare operation not confirmed.'); return body.result;
  };
  const readInfo = async origin => {
    const response = await fetch(`${origin}/build-info.json`, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) });
    requireValue(response.ok, 'Build identity unavailable.'); return response.json();
  };
  const current = async (expected, readIdentity = input.operation === 'deploy') => {
    const state = await cf();
    requireValue(state.name === project && state.production_branch === 'main' && !state.source && state.uses_functions !== true &&
      state.domains?.includes('app.schreiberexcavating.com'), 'Unexpected Pages project/branch/domain or Git integration.');
    const deployment = state.canonical_deployment;
    const origin = validateDeployment(deployment, expected);
    return { id: deployment.id, info: readIdentity ? await readInfo(origin) : undefined };
  };
  const deps = {
    main: async () => (await github('branches/main')).commit.sha,
    ancestor: async (before, after) => {
      try { execFileSync('git', ['merge-base', '--is-ancestor', before, after], { stdio: 'ignore' }); return true; } catch { return false; }
    },
    candidate: async value => {
      const artifact = await candidateSource(value.revision, value.run);
      const manifest = verifyPayload(payload, value.hash, value.revision);
      requireValue(manifest.run === value.run && manifest.workflowRevision === value.revision &&
        new RegExp(`^https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/[0-9]+$`).test(manifest.verification), 'Candidate provenance mismatch.');
      return artifact.id;
    },
    record: value => writeFileSync(path.join(recordDir, 'receipt.json'), JSON.stringify(value, null, 2) + '\n'),
    current,
    target: async id => {
      const deployment = await cf(`/deployments/${id}`);
      const origin = validateDeployment(deployment, id);
      return { info: await readInfo(origin) };
    },
    upload: async value => {
      const cwd = mkdtempSync(path.join(tmpdir(), 'schreiber-upload-'));
      const marker = `release:${env.GITHUB_RUN_ID}:${value.hash}`;
      // Execute only the separately locked tool, never artifact code or app dependencies.
      execFileSync(process.execPath, [path.resolve('tooling/release/node_modules/wrangler/bin/wrangler.js'),
        'pages', 'deploy', path.join(payload, 'frontend'), '--project-name', project, '--branch', 'main',
        '--commit-hash', value.revision, '--commit-message', marker, '--commit-dirty=false'], {
        cwd, timeout: 300000, stdio: 'pipe',
        env: { PATH: env.PATH, HOME: cwd, CI: 'true', WRANGLER_SEND_METRICS: 'false',
          CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN },
      });
      const state = await cf(); const deployed = state.canonical_deployment;
      validateDeployment(deployed, deployed.id);
      requireValue(deployed.id !== value.previous && deployed.deployment_trigger?.metadata?.commit_hash === value.revision &&
        deployed.deployment_trigger?.metadata?.commit_message === marker, 'Uploaded deployment identity not confirmed.');
      return deployed.id;
    },
    rollback: async id => {
      const deployed = await cf(`/deployments/${id}/rollback`, 'POST');
      requireValue(deployed.id === id, 'Recovery response identity mismatch.'); return id;
    },
    verify: async (value, id) => {
      // Bounded observation retries only. Never retry a mutation or roll back automatically.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const state = await current(id, true); validateIdentity(state.info, value.revision);
          validateIdentity(await readInfo('https://app.schreiberexcavating.com'), value.revision);
          for (const route of ['/', '/reset-password']) {
            const response = await fetch(`https://app.schreiberexcavating.com${route}`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
            requireValue(response.ok && response.headers.get('content-type')?.includes('text/html'), 'Availability check failed.');
          }
          return;
        } catch { if (attempt === 2) throw new Error('Live verification failed.'); await new Promise(resolve => setTimeout(resolve, 5000)); }
      }
    },
  };
  const receipt = await perform(input, deps);
  console.log(`Frontend ${receipt.operation}: ${receipt.outcome}. See receipt.json. Availability is not feature acceptance.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
