// Synthetic-only checks of the local job file policies; never uses hosted settings.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from './local-backend.mjs';
const status = localStatus();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const client = key => createClient(status.API_URL, key, options);
const service = client(status.SERVICE_ROLE_KEY);
const anonymous = client(status.ANON_KEY);
const employee = client(status.ANON_KEY);
const admin = client(status.ANON_KEY);
const cleanup = [];
const bytes = new TextEncoder().encode('Synthetic job-file permission check.');
function ok(result) { assert.equal(result.error, null, result.error?.message); return result.data; }
async function content(api, bucket, path) {
  return new Uint8Array(await ok(await api.storage.from(bucket).download(path)).arrayBuffer());
}
try {
  ok(await employee.auth.signInWithPassword({ email: 'employee@example.test', password: 'LocalOnly-12345!' }));
  ok(await admin.auth.signInWithPassword({ email: 'admin@example.test', password: 'LocalOnly-12345!' }));
  for (const bucket of ['job-plans', 'job-photos']) {
    const path = `permission-proof-${randomUUID()}.txt`;
    const deniedPath = `permission-denied-${randomUUID()}.txt`;
    cleanup.push([bucket, path, deniedPath]);
    ok(await admin.storage.from(bucket).upload(path, bytes, { contentType: 'text/plain' }));
    assert.deepEqual(await content(employee, bucket, path), bytes, 'Signed-in employee can read job files.');
    const hidden = await anonymous.storage.from(bucket).download(path);
    assert.ok(hidden.error, 'Anonymous download must fail.');
    assert.ok(['400', '403', '404'].includes(String(hidden.error.statusCode)), 'Expected an access/not-found response.');
    const denied = await employee.storage.from(bucket).upload(deniedPath, bytes);
    assert.equal(String(denied.error?.statusCode), '403', 'Employee upload must be rejected by RLS.');
    const listing = ok(await service.storage.from(bucket).list('', { search: deniedPath }));
    assert.equal(listing.some(item => item.name === deniedPath), false, 'Rejected upload left no object.');
    const modified = await employee.storage.from(bucket).update(path, new TextEncoder().encode('Forbidden replacement'));
    assert.ok(modified.error, 'Employee update must fail.');
    assert.deepEqual(await content(service, bucket, path), bytes, 'Rejected update preserves bytes.');
    // DELETE can legitimately return an empty successful result when RLS hides the row.
    await employee.storage.from(bucket).remove([path]);
    assert.deepEqual(await content(service, bucket, path), bytes, 'Employee cannot delete the file.');
    ok(await admin.storage.from(bucket).remove([path]));
    assert.equal(ok(await service.storage.from(bucket).list('', { search: path })).some(item => item.name === path), false);
    console.log(`PASS ${bucket}: employee read, denied employee writes/deletion, anonymous isolation, admin upload/delete.`);
  }
} finally {
  for (const [bucket, ...paths] of cleanup) ok(await service.storage.from(bucket).remove(paths));
  await employee.auth.signOut();
  await admin.auth.signOut();
}
