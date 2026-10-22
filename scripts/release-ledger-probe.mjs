import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { github } from './release-github.mjs';
import { requireValue } from './release-policy.mjs';

// This writes diagnostic GitHub metadata. It never represents a live deployment
// and does not share the production ledger's environment, task or sequence schema.
export async function probeLedger(env, api = github, record = () => {}) {
  requireValue(env.GITHUB_REF === 'refs/heads/main', 'Ledger probe requires main.');
  const main = (await api('branches/main')).commit.sha;
  requireValue(main === env.GITHUB_WORKFLOW_SHA, 'Use the current main workflow.');
  const receipt = { revision: main, run: env.GITHUB_RUN_ID, outcome: 'pending', productionMutation: false };
  record(receipt);
  const entry = await api('deployments', {
    ref: main, task: 'schreiber-ledger-probe', environment: 'release-ledger-readiness',
    auto_merge: false, required_contexts: [], production_environment: false, transient_environment: true,
    description: 'Actions token permission probe; no application deployment',
    payload: { schema: 'schreiber-ledger-probe-v1', run: env.GITHUB_RUN_ID },
  });
  requireValue(Number.isSafeInteger(entry.id), 'Diagnostic deployment record was not confirmed.');
  receipt.deploymentId = entry.id; receipt.outcome = 'record-created'; record(receipt);
  for (const state of ['in_progress', 'inactive']) {
    await api(`deployments/${entry.id}/statuses`, { state, auto_inactive: false,
      description: 'Permission probe only; no application deployment',
      log_url: `https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` });
  }
  receipt.outcome = 'ledger-write-verified'; record(receipt);
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync('dist/release-ledger-probe', { recursive: true });
  probeLedger(process.env, github, receipt => writeFileSync('dist/release-ledger-probe/receipt.json', JSON.stringify(receipt, null, 2) + '\n'))
    .then(() => console.log('Actions ledger writes verified; no application deployed.'))
    .catch(() => { console.error('Ledger probe incomplete; inspect retained receipt and diagnostic record.'); process.exitCode = 1; });
}
