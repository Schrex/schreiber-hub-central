import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { root } from './local-backend.mjs';

const groups = {
  app: ['typecheck', 'test', 'build'],
  backend: ['local:audit-schema', 'test:local', 'test:local:permissions', 'test:local:hr', 'test:local:storage', 'test:local:roles'],
  lint: ['lint'],
  edge: ['typecheck:edge'],
  browser: ['test:browser'],
};
const group = process.argv[2] ?? 'all';
if (group !== 'all' && !Object.hasOwn(groups, group)) {
  console.error('Usage: node scripts/verify.mjs [all|app|backend|lint|edge|browser]');
  process.exit(2);
}
const results = [];
for (const task of group === 'all' ? Object.values(groups).flat() : groups[group]) {
  console.log(`\nRunning ${task}`);
  const result = spawnSync('bun', ['run', task], {
    cwd: root, stdio: 'inherit',
    // Verification builds must not accidentally embed the Cloud .env defaults.
    // API test scripts separately obtain their keys from the exact local backend.
    env: { ...process.env, VITE_SUPABASE_URL: 'http://127.0.0.1:55321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'local-verification-placeholder',
      VITE_SUPABASE_PROJECT_ID: 'schreiber-local', VITE_LOCAL_BACKEND: 'true' },
  });
  results.push({ task, passed: result.status === 0 });
  if (result.error) console.error(result.error.message);
}
console.log('\nVerification summary (local/test scope only):');
for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.task}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, '\n| Check | Result |\n| --- | --- |\n' +
    results.map(r => `| ${r.task} | ${r.passed ? 'PASS' : 'FAIL'} |`).join('\n') + '\n');
}
if (results.some(r => !r.passed)) process.exitCode = 1;
