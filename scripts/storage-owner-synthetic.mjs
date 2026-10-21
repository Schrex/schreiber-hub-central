// Synthetic loopback-only proof. No hosted credentials, accounts or files.
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { localStatus } from './local-backend.mjs';

const status = localStatus();
assert.equal(status.API_URL, 'http://127.0.0.1:55321');
assert.ok(status.JWT_SECRET);
const bucket = `owner-proof-${randomUUID()}`;
const owner = randomUUID();
const bytes = Buffer.from('Synthetic ownership migration proof only.\n');
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  role: 'service_role', sub: owner, iss: 'supabase', iat: now, exp: now + 120,
})}`;
const token = `${unsigned}.${createHmac('sha256', status.JWT_SECRET).update(unsigned).digest('base64url')}`;
async function api(method, path, body, bearer = status.SERVICE_ROLE_KEY) {
  const raw = Buffer.isBuffer(body);
  const response = await fetch(`${status.API_URL}/storage/v1${path}`, {
    method, redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { apikey: status.SERVICE_ROLE_KEY, Authorization: `Bearer ${bearer}`,
      'Content-Type': raw ? 'text/plain' : 'application/json', 'Cache-Control': 'max-age=123' },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Synthetic Storage request failed: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
function metadata() {
  // Random identifiers generated above are the only SQL interpolation inputs.
  return JSON.parse(execFileSync('docker', ['exec', 'supabase_db_schreiber-local',
    'psql', '-U', 'postgres', '-d', 'postgres', '-XAt', '-v', 'ON_ERROR_STOP=1', '-c',
    `SELECT json_build_object('id',o.id,'owner',o.owner,'owner_id',o.owner_id,'metadata',o.metadata,'public',b.public) FROM storage.objects o JOIN storage.buckets b ON b.id=o.bucket_id WHERE o.bucket_id='${bucket}' AND o.name='proof.txt'`,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
}
let created = false;
try {
  await api('POST', '/bucket', { id: bucket, name: bucket, public: false });
  created = true;
  await api('POST', `/object/${bucket}/proof.txt`, bytes);
  const before = metadata();
  assert.equal(before.owner, null);
  assert.equal(before.owner_id, null);
  await api('PUT', `/object/${bucket}/proof.txt`, bytes, token);
  const after = metadata();
  assert.equal(after.owner, owner);
  assert.equal(after.owner_id, owner);
  assert.equal(after.id, before.id);
  assert.equal(after.public, false);
  for (const field of ['size', 'mimetype', 'cacheControl']) {
    assert.equal(after.metadata[field], before.metadata[field]);
  }
  assert.deepEqual(await api('GET', `/object/${bucket}/proof.txt`), bytes);
  console.log('PASS: API update restores both owners, preserves object ID, bytes, content metadata and privacy.');
} finally {
  if (created) {
    await api('DELETE', `/object/${bucket}`, { prefixes: ['proof.txt'] });
    await api('DELETE', `/bucket/${bucket}`);
    console.log('Synthetic bucket and file removed.');
  }
}
