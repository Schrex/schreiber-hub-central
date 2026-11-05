import { mkdir, readdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, '.local-backend/supabase');
await mkdir(target, { recursive: true });
// Only this generated migration directory is replaced; never remote state.
await rm(path.join(target, 'migrations'), { recursive: true, force: true });
await mkdir(path.join(target, 'migrations'));
const accountSeed = '20260419193344_9a141987-a2b1-4306-8565-9e7649fcb9cc.sql';
for (const name of (await readdir(path.join(root, 'supabase/migrations'))).sort()) {
  if (!name.endsWith('.sql')) continue;
  const source = await readFile(path.join(root, 'supabase/migrations', name), 'utf8');
  // Fail closed if future migrations introduce outbound execution.
  const executable = source.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  if (/net\.http_|cron\.schedule|vault\.(create_secret|update_secret)/i.test(executable)) {
    throw new Error(`Review outbound migration before local replay: ${name}`);
  }
  let localSource = source;
  if (name === '20260513013337_83ab9558-059d-4000-b19e-c30492c9f3d5.sql') {
    // This Cloud-owned realtime table cannot be altered by the local migration
    // role. Realtime is disabled in the local config; do not weaken ownership.
    localSource = '-- Local-only: realtime disabled; Cloud ownership migration omitted.\n';
  }
  await writeFile(path.join(target, 'migrations', name), name === accountSeed
    ? '-- Local-only: omit historical employee account/password seed.\n'
    : localSource);
}
// Explicit local-only candidate: excluded from the production migration directory.
// Promotion requires a separate reviewed release; never deploy this directory.
await copyFile(path.join(root, 'local/candidate-migrations/20261016210000_time_off_request_permissions.sql'),
  path.join(target, 'migrations/20261016210000_time_off_request_permissions.sql'));
await copyFile(path.join(root, 'local/candidate-migrations/20261022010000_employee_creation.sql'),
  path.join(target, 'migrations/20261022010000_employee_creation.sql'));
await copyFile(path.join(root, 'local/candidate-migrations/20261105190000_lookahead_grid.sql'),
  path.join(target, 'migrations/20261105190000_lookahead_grid.sql'));
await copyFile(path.join(root, 'local/config.toml'), path.join(target, 'config.toml'));
await copyFile(path.join(root, 'local/seed.sql'), path.join(target, 'seed.sql'));
await copyFile(path.join(root, 'local/hr-bootstrap.sql'),
  path.join(target, 'migrations/20260421010921_local_hr_baseline.sql'));
// Historical view uses this column five days before its IF NOT EXISTS migration.
// Keep production history intact; reproduce the prerequisite only in local replay.
await writeFile(path.join(target, 'migrations/20260421010922_local_replay_prerequisite.sql'),
  'ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS is_salaried boolean NOT NULL DEFAULT false;\n');
console.log('Prepared isolated schreiber-local backend on port 55321; no Edge Functions copied.');
