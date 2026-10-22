import { pathToFileURL } from 'node:url';

export const requiredJobs = ['app', 'backend', 'lint', 'edge', 'browser'].map(group => `Verify ${group}`);
export function validateRelease({ ref, sha, main, run, jobs, repository }) {
  if (ref !== 'refs/heads/main') throw new Error('Dispatch the reviewed workflow from main.');
  if (!/^[0-9a-f]{40}$/.test(sha ?? '') || sha !== main) throw new Error('Select the full current main commit; stale releases are refused.');
  if (!run || run.head_sha !== sha || run.head_branch !== 'main' || run.event !== 'push' ||
      run.path !== '.github/workflows/verify.yml' || run.repository?.full_name !== repository ||
      run.status !== 'completed' || run.conclusion !== 'success') throw new Error('Exact main commit needs a successful push Verification run.');
  for (const name of requiredJobs) {
    if (!jobs.some(job => job.name === name && job.status === 'completed' && job.conclusion === 'success')) {
      throw new Error(`Missing successful ${name}; skipped checks do not qualify.`);
    }
  }
}
async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const sha = process.env.RELEASE_SHA;
  const api = async route => {
    const response = await fetch(`https://api.github.com/repos/${repository}/${route}`, {
      headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`GitHub release evidence unavailable (${response.status}).`);
    return response.json();
  };
  if (!/^[0-9a-f]{40}$/.test(sha ?? '')) throw new Error('Full lowercase SHA required.');
  const branch = await api('branches/main');
  const runs = await api(`actions/workflows/verify.yml/runs?head_sha=${sha}&event=push&branch=main&per_page=100`);
  const run = runs.workflow_runs.sort((a, b) => b.run_number - a.run_number)[0];
  const jobs = run ? (await api(`actions/runs/${run.id}/jobs?filter=latest&per_page=100`)).jobs : [];
  validateRelease({ ref: process.env.GITHUB_REF, sha, main: branch.commit.sha, run, jobs, repository });
  console.log(`Exact source verified: ${sha}; evidence ${run.html_url}`);
  const { appendFileSync } = await import('node:fs');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `verification_url=${run.html_url}\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
