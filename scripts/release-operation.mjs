import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { backend, project, requireValue, validateOperation, verifyPayload, validateIdentity, validateDeployment, validateFunctions, validateSequence } from './release-policy.mjs';
import { github, candidateSource } from './release-github.mjs';
import { buildReader } from './release-http.mjs';

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
    run: input.operationRun, actor: input.actor, recoveryReference: input.recoveryReference || null, outcome: 'planned' };
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
  if (input.mode === 'preflight') {
    // Real provider reads, but never reserve a ledger entry or mutate Cloudflare.
    await deps.checkLedger(input);
    if (input.operation === 'deploy') await deps.verify({ ...input, revision: current.info.revision }, current.id);
    requireValue(await deps.main() === main, 'Main changed during preflight.');
    await deps.current(input.previous);
    receipt.outcome = 'preflight-passed';
    receipt.ledgerWriteVerified = false;
    receipt.currentBuildInfo = current.info;
    deps.record(receipt);
    return receipt;
  }
  // Compare Cloudflare's persistent canonical deployment immediately before mutation.
  // No API CAS exists: out-of-band dashboard/CLI operators must pause during this lane.
  requireValue(await deps.main() === main, 'Main changed during preparation; dispatch again.');
  await deps.current(input.previous);
  receipt.ledger = await deps.reserve(input);
  receipt.outcome = 'reserved'; deps.record(receipt);
  requireValue(await deps.main() === main, 'Main changed after ledger reservation.');
  await deps.current(input.previous);
  receipt.previous = current.id;
  receipt.outcome = 'mutation-outcome-unknown';
  deps.record(receipt); // Preserve this even if the network response is lost.
  try {
    receipt.deployment = input.operation === 'deploy' ? await deps.upload(input) : await deps.rollback(input.target);
    receipt.outcome = 'applied-unverified'; deps.record(receipt);
    await deps.verify(input, receipt.deployment);
    receipt.outcome = 'verified'; deps.record(receipt);
    await deps.status(receipt.ledger, 'success', receipt.deployment);
    return receipt;
  } catch {
    if (receipt.outcome === 'verified') {
      receipt.ledgerStatus = 'update-failed'; deps.record(receipt);
      throw new Error('Frontend verified, but ledger status publication failed. Inspect receipt; do not repeat the mutation.');
    }
    await deps.status(receipt.ledger, 'error', receipt.deployment).catch(() => {});
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
    recoveryReference: env.RECOVERY_REFERENCE, workflowRevision: env.GITHUB_WORKFLOW_SHA, operationRun: env.GITHUB_RUN_ID, actor: env.GITHUB_ACTOR, runNumber: env.GITHUB_RUN_NUMBER };
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
  const readInfo = buildReader(env);
  const current = async (expected, readIdentity = input.operation === 'deploy') => {
    const state = await cf();
    // The project may use Functions only through the approved forwarding (#98): the canonical
    // deployment's own build identity is checked below whenever it is read.
    requireValue(state.name === project && state.production_branch === 'main' && !state.source &&
      state.domains?.includes('app.schreiberexcavating.com'), 'Unexpected Pages project/branch/domain or Git integration.');
    const deployment = state.canonical_deployment;
    const origin = validateDeployment(deployment, expected);
    const info = readIdentity ? await readInfo(origin) : undefined;
    if (readIdentity) validateFunctions(deployment, info);
    return { id: deployment.id, info };
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
    checkLedger: async value => {
      const entries = [];
      for (let page = 1; page <= 10; page++) {
        const batch = await github(`deployments?environment=production-frontend&task=schreiber-frontend&per_page=100&page=${page}`);
        entries.push(...batch);
        if (batch.length < 100) break;
        requireValue(page < 10, 'Release ledger exceeds review limit; migrate it explicitly.');
      }
      validateSequence(value.runNumber, entries);
    },
    reserve: async value => {
      await deps.checkLedger(value);
      const deployment = await github('deployments', {
        ref: value.workflowRevision, task: 'schreiber-frontend', environment: 'production-frontend',
        auto_merge: false, required_contexts: [], production_environment: true,
        description: `Manual frontend ${value.operation}`,
        payload: { schema: 'schreiber-frontend-v1', runNumber: value.runNumber, run: value.operationRun,
          operation: value.operation, revision: value.revision, previous: value.previous, target: value.target || null, hash: value.hash || null },
      });
      requireValue(Number.isSafeInteger(deployment.id), 'Release ledger reservation not confirmed.');
      await github(`deployments/${deployment.id}/statuses`, { state: 'in_progress', auto_inactive: false,
        log_url: `https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` });
      return deployment.id;
    },
    status: async (id, state, deployment) => github(`deployments/${id}/statuses`, { state, auto_inactive: false,
      description: deployment ? `Cloudflare ${deployment}; inspect receipt for verification outcome` : 'Outcome unknown; inspect provider before retry',
      log_url: `https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` }),
    record: value => writeFileSync(path.join(recordDir, 'receipt.json'), JSON.stringify(value, null, 2) + '\n'),
    current,
    target: async id => {
      const deployment = await cf(`/deployments/${id}`);
      const origin = validateDeployment(deployment, id);
      const info = await readInfo(origin);
      validateFunctions(deployment, info);
      return { info };
    },
    upload: async value => {
      const cwd = mkdtempSync(path.join(tmpdir(), 'schreiber-upload-'));
      const marker = `release:${env.GITHUB_RUN_ID}:${value.hash}`;
      // Wrangler compiles ./functions from its working directory. Only the verified artifact's
      // approved forwarding function is copied there; never the checkout's functions/ folder.
      if (existsSync(path.join(payload, 'functions'))) cpSync(path.join(payload, 'functions'), path.join(cwd, 'functions'), { recursive: true });
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
