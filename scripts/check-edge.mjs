import { spawnSync } from 'node:child_process';
import { root } from './local-backend.mjs';

// Entry points changed by the foundation cleanup; imports are checked transitively.
// Static checks only: do not serve handlers or load production credentials.
const functions = [
  "create-employee",
  "process-email-queue",
  "handle-email-unsubscribe",
  "handle-email-suppression",
  "complete-safety-talk",
  "decide-truck-request",
  "inbound-swpppp-email",
  "request-safety-inspection",
  "request-truck",
  "send-transactional-email",
  "speak-toolbox-talk",
  "submit-accident-report",
  "submit-safety-violation",
  "transcribe-toolbox-talk"
];
const result = spawnSync('npx', ['--yes', 'deno@2.5.6', 'check', '--no-lock',
  '--node-modules-dir=none', ...functions.map(name => `supabase/functions/${name}/index.ts`)],
  { cwd: root, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
