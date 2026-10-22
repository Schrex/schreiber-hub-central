import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { requireValue, validateCandidateRun, shaPattern } from './release-policy.mjs';
export async function github(route) {
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/${route}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(30000),
  });
  requireValue(response.ok, `GitHub evidence request failed (${response.status}).`); return response.json();
}
export async function candidateSource(revision, runId) {
  requireValue(shaPattern.test(revision) && /^[1-9][0-9]*$/.test(runId), 'Exact candidate revision/run required.');
  const run = await github(`actions/runs/${runId}`);
  validateCandidateRun(run, process.env.GITHUB_REPOSITORY, revision);
  const list = await github(`actions/runs/${runId}/artifacts?per_page=100`);
  const artifacts = list.artifacts.filter(a => a.name === `production-candidate-${runId}-${revision}` && !a.expired);
  requireValue(artifacts.length === 1, 'Exactly one retained production candidate artifact is required.');
  return artifacts[0];
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  candidateSource(process.env.RELEASE_SHA, process.env.CANDIDATE_RUN).then(artifact => {
    appendFileSync(process.env.GITHUB_OUTPUT, `artifact_id=${artifact.id}\n`);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
