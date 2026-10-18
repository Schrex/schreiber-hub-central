import { spawn } from 'node:child_process';
import { localStatus, root } from './local-backend.mjs';

const status = localStatus();
console.log('Local frontend → http://127.0.0.1:55321 (synthetic data; outbound functions unavailable).');
const port = process.argv.includes('--browser-test') ? '8082' : '8080';
const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', port, '--strictPort'], {
  cwd: root, stdio: 'inherit',
  env: {
    ...process.env,
    VITE_SUPABASE_URL: status.API_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
    VITE_SUPABASE_PROJECT_ID: 'schreiber-local',
    VITE_LOCAL_BACKEND: 'true',
  },
});
child.on('exit', (code) => { process.exitCode = code ?? 1; });
