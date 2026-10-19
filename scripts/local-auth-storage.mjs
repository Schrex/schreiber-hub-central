import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from './local-backend.mjs';

// The shared guard rejects every API origin except the disposable loopback stack.
const status = localStatus();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const client = () => createClient(status.API_URL, status.ANON_KEY, options);
const signup = client(), other = client(), admin = client(), anonymous = client();
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
const email = `migration-check-${randomUUID()}@example.test`;
const password = `Synthetic-${randomUUID()}!`;
const bucket = 'safety-violation-photos';
let userId, contactId;
const paths = [];
const ok = result => {
  assert.equal(result.error, null, result.error?.message);
  return result.data;
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  const created = ok(await signup.auth.signUp({ email, password,
    options: { data: { display_name: 'Synthetic migration check', role: 'admin' } } }));
  userId = created.user?.id;
  assert.ok(userId, 'Public signup should create a synthetic user.');
  const profile = ok(await service.from('profiles').select('user_id,contact_id').eq('user_id', userId).single());
  contactId = profile.contact_id;
  assert.ok(contactId);
  assert.equal(ok(await service.from('employee_contacts').select('converted_user_id').eq('id', contactId).single()).converted_user_id, userId);
  assert.deepEqual(ok(await service.from('user_roles').select('role').eq('user_id', userId)), [{ role: 'employee' }], 'Forged signup metadata must not grant admin.');
  ok(await signup.auth.signOut());
  assert.equal(ok(await signup.auth.signInWithPassword({ email, password })).user.id, userId);
  assert.equal((await signup.from('user_roles').insert({ user_id: userId, role: 'admin' })).error?.code, '42501');
  assert.deepEqual(ok(await service.from('user_roles').select('role').eq('user_id', userId)), [{ role: 'employee' }]);
  console.log('PASS: signup links Auth/profile/contact, defaults to employee despite forged metadata, and password login retains UUID; self-promotion is denied.');

  ok(await other.auth.signInWithPassword({ email: 'other@example.test', password: 'LocalOnly-12345!' }));
  ok(await admin.auth.signInWithPassword({ email: 'admin@example.test', password: 'LocalOnly-12345!' }));
  const path = `${userId}/synthetic-${randomUUID()}.txt`;
  const bytes = Buffer.from('Synthetic private migration file; no employee data.\n');
  paths.push(path);
  ok(await service.storage.from(bucket).upload(path, bytes, { contentType: 'text/plain' }));
  for (const reader of [signup, admin]) {
    const blob = ok(await reader.storage.from(bucket).download(path));
    assert.equal(digest(Buffer.from(await blob.arrayBuffer())), digest(bytes));
    const signed = ok(await reader.storage.from(bucket).createSignedUrl(path, 60));
    assert.equal(new URL(signed.signedUrl).origin, status.API_URL);
    const response = await fetch(signed.signedUrl);
    assert.equal(response.status, 200);
    assert.equal(digest(Buffer.from(await response.arrayBuffer())), digest(bytes));
  }
  for (const denied of [other, anonymous]) {
    assert.ok((await denied.storage.from(bucket).download(path)).error, 'Unauthorized private download must fail.');
    assert.ok((await denied.storage.from(bucket).createSignedUrl(path, 60)).error, 'Unauthorized signing must fail.');
  }
  const uploadPath = `${userId}/denied-${randomUUID()}.txt`;
  paths.push(uploadPath);
  assert.ok((await signup.storage.from(bucket).upload(uploadPath, bytes)).error, 'Employee cannot upload foreman-only violation file.');
  assert.ok((await service.storage.from(bucket).download(uploadPath)).error, 'Rejected upload must not persist bytes.');
  console.log('PASS: owner/admin file bytes match; other employee/anonymous downloads and signing denied; employee upload denied without persisted bytes.');
} finally {
  const failures = [];
  const clean = async action => { try { ok(await action()); } catch (error) { failures.push(error); } };
  if (paths.length) await clean(() => service.storage.from(bucket).remove(paths));
  if (userId) await clean(() => service.auth.admin.deleteUser(userId));
  // Signup trigger creates a contact; identify by unique synthetic email if an earlier assertion failed.
  await clean(() => service.from('employee_contacts').delete().eq('email', email));
  await Promise.all([signup, other, admin].map(c => c.auth.signOut()));
  if (failures.length) throw new AggregateError(failures, 'Synthetic test cleanup failed.');
}
