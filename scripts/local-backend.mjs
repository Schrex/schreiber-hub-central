import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export function localStatus() {
  // Never accept a URL supplied by an .env file or CLI caller.
  const output = execFileSync('npx', ['--yes', 'supabase@2.121.0', 'status',
    '--workdir', '.local-backend', '--output', 'json'], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  const status = JSON.parse(output);
  if (status.API_URL !== 'http://127.0.0.1:55321') {
    throw new Error('Refusing unexpected backend: expected isolated loopback API on port 55321.');
  }
  if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error('Local keys unavailable.');
  return status;
}
