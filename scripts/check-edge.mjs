import { spawnSync } from 'node:child_process';
import { root } from './local-backend.mjs';

// Entry points changed by foundation cleanup and migration preparation.
// Imports are checked transitively.
// Static checks only: do not serve handlers or load production credentials.
const functions = [
  "complete-safety-talk",
  "decide-truck-request",
  "extract-foreman-brief",
  "extract-scope-from-contract",
  "generate-toolbox-talk",
  "handle-email-suppression",
  "handle-email-unsubscribe",
  "inbound-swpppp-email",
  "notify-talk-attendees",
  "process-email-queue",
  "request-safety-inspection",
  "request-truck",
  "send-transactional-email",
  "speak-toolbox-talk",
  "submit-accident-report",
  "submit-safety-violation",
  "suggest-safety-topic",
  "transcribe-toolbox-talk"
];
const result = spawnSync('npx', ['--yes', 'deno@2.5.6', 'check', '--no-lock',
  '--node-modules-dir=none', ...functions.map(name => `supabase/functions/${name}/index.ts`)],
  { cwd: root, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
