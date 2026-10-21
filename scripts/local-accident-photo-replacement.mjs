// Apply one candidate to the fixed disposable backend, run HTTP regressions,
// and remove it in finally. Never accepts a hosted URL or changes bucket flags.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { localStatus, root } from './local-backend.mjs';

localStatus(); // Fail closed unless CLI reports the exact synthetic loopback API.
const query = sql => execFileSync('docker', [
  'exec', '-i', 'supabase_db_schreiber-local', 'psql', '-X', '-qAt',
  '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', 'postgres',
], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const snapshot = () => query(`SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY policyname)::text, '[]')
  FROM pg_policies p WHERE schemaname='storage' AND tablename='objects';`);
const policy = 'Office admin replaces existing accident photos';
assert.equal(query(`SELECT count(*) FROM pg_policies WHERE schemaname='storage'
  AND tablename='objects' AND policyname='${policy}';`), '0',
  'Candidate is already installed; refuse to overwrite or remove existing policy.');
const before = snapshot();
const candidate = readFileSync(new URL('../local/candidate-migrations/20261021010000_accident_photo_replacement.sql', import.meta.url), 'utf8');
let installed = false;
try {
  query(`BEGIN; ${candidate}\nCOMMIT;`);
  installed = true;
  const result = spawnSync(process.execPath, ['scripts/local-storage-api-acceptance.mjs'], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'Candidate Storage HTTP regression failed.');
} finally {
  if (installed) query(`DROP POLICY "${policy}" ON storage.objects;`);
  assert.equal(snapshot(), before, 'Storage policy catalog differs after candidate cleanup.');
  console.log('PASS candidate cleanup: exact original Storage policy catalog restored.');
}
