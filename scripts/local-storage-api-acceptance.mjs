// HTTP acceptance against the fixed synthetic local backend. No hosted inputs.
// Does not change policies or bucket flags; target-only talk-media narrowing is omitted.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from './local-backend.mjs';
const status = localStatus();
const client = key => createClient(status.API_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
const service = client(status.SERVICE_ROLE_KEY);
const users = [], actors = [], files = [];
const bytes = new TextEncoder().encode('Synthetic Storage HTTP acceptance original.');
const changed = new TextEncoder().encode('Synthetic Storage HTTP acceptance replacement.');
function ok(r) { assert.equal(r.error, null, r.error?.message); return r.data; }
async function content(api, bucket, path) { return new Uint8Array(await ok(await api.storage.from(bucket).download(path)).arrayBuffer()); }
async function exists(bucket, path) {
  const split = path.lastIndexOf('/');
  return ok(await service.storage.from(bucket).list(path.slice(0, split), { search: path.slice(split + 1) })).some(x => x.name === path.slice(split + 1));
}
function permission(bucket, role, own) {
  if (role === 'anon') return [false, false, false, false];
  const elevated = ['foreman', 'office', 'admin'].includes(role), office = ['office', 'admin'].includes(role), admin = role === 'admin';
  if (['job-plans', 'job-photos', 'permits'].includes(bucket)) return [true, elevated, elevated, elevated];
  if (['handbook', 'job-contracts', 'job-estimates', 'swpppp-reports'].includes(bucket)) return [true, office, office, office];
  if (bucket === 'job-submittals') return [elevated, office, office, office];
  if (bucket === 'onboarding-templates') return [true, admin, admin, admin];
  if (bucket === 'talk-audio') { const writer = ['foreman', 'admin'].includes(role); return [elevated, writer, writer, writer]; }
  if (['onboarding-signed', 'shop-waivers'].includes(bucket)) return [own || office, own, false, false];
  if (bucket === 'accident-photos') return [own || office, own, office, office];
  if (bucket === 'safety-violation-photos') return [own || office, own && elevated, false, office];
  throw Error(`Unreviewed bucket ${bucket}`);
}
let cases = 0;
const failures = [];
try {
  const buckets = ok(await service.storage.listBuckets());
  assert.equal(buckets.length, 15);
  assert.equal(buckets.find(b => b.id === 'talk-media').public, true, 'This harness expects the documented local talk-media mismatch.');
  for (const bucket of buckets.filter(b => b.id !== 'talk-media')) assert.equal(bucket.public, false);
  for (const role of ['employee', 'foreman', 'office', 'admin']) {
    const email = `storage-acceptance-${randomUUID()}@example.test`, password = `Local-${randomUUID()}!`;
    const user = ok(await service.auth.admin.createUser({ email, password, email_confirm: true })).user;
    users.push(user.id);
    // New-user bootstrap creates employee. Replace only this synthetic user's roles.
    ok(await service.from('user_roles').delete().eq('user_id', user.id));
    ok(await service.from('user_roles').insert({ user_id: user.id, role }));
    const api = client(status.ANON_KEY);
    ok(await api.auth.signInWithPassword({ email, password }));
    actors.push({ role, id: user.id, api });
  }
  actors.push({ role: 'anon', id: randomUUID(), api: client(status.ANON_KEY) });
  for (const { id: bucket } of buckets.filter(b => b.id !== 'talk-media')) {
    for (const { role, id, api } of actors) for (const own of [true, false]) {
      const folder = own ? id : randomUUID();
      const path = `${folder}/http-acceptance-${randomUUID()}.txt`, uploadPath = `${folder}/http-insert-${randomUUID()}.txt`;
      files.push([bucket, path], [bucket, uploadPath]);
      const [read, insert, update, remove] = permission(bucket, role, own);
      ok(await service.storage.from(bucket).upload(path, bytes, { contentType: 'text/plain' }));
      const downloaded = await api.storage.from(bucket).download(path);
      if (read) assert.deepEqual(new Uint8Array(await ok(downloaded).arrayBuffer()), bytes);
      else { assert.ok(downloaded.error); assert.ok(['400','403','404'].includes(String(downloaded.error.statusCode))); }
      cases++;
      const inserted = await api.storage.from(bucket).upload(uploadPath, bytes, { contentType: 'text/plain' });
      if (insert) { ok(inserted); assert.deepEqual(await content(service, bucket, uploadPath), bytes); }
      else { assert.equal(String(inserted.error?.statusCode), '403'); assert.equal(await exists(bucket, uploadPath), false); }
      cases++;
      const updated = await api.storage.from(bucket).update(path, changed, { contentType: 'text/plain' });
      if (update && updated.error) failures.push(`${bucket}/${role}/${own ? 'own' : 'other'}: UPDATE expected allowed, HTTP ${updated.error.statusCode}`);
      if (!update) assert.ok(updated.error, `${bucket}/${role}: update should fail`);
      if (updated.error) assert.ok(['400','403','404'].includes(String(updated.error.statusCode)), 'Unexpected update failure status');
      assert.deepEqual(await content(service, bucket, path), !updated.error ? changed : bytes, 'Denied updates preserve bytes');
      cases++;
      if (bucket === 'accident-photos') {
        // Replacement authorization also needs INSERT permission in Storage's
        // upsert probe. An existing object must never let an ordinary reporter
        // bypass the separate office/admin UPDATE policy.
        const replacement = await api.storage.from(bucket).upload(path, changed, { contentType: 'text/plain', upsert: true });
        if (update && replacement.error) failures.push(`${bucket}/${role}/${own ? 'own' : 'other'}: UPSERT existing expected allowed, HTTP ${replacement.error.statusCode}`);
        if (!update) assert.ok(replacement.error, `${role}: existing-object upsert should fail`);
        if (replacement.error) assert.equal(String(replacement.error.statusCode), '403');
        assert.deepEqual(await content(service, bucket, path), update && !replacement.error ? changed : !updated.error ? changed : bytes);
        cases++;
        // A missing path does not qualify for the existing-object exception,
        // even when the caller sets upsert. Own-path creation stays permitted.
        const absentPath = `${folder}/http-upsert-new-${randomUUID()}.txt`;
        files.push([bucket, absentPath]);
        const created = await api.storage.from(bucket).upload(absentPath, bytes, { contentType: 'text/plain', upsert: true });
        if (insert) { ok(created); assert.deepEqual(await content(service, bucket, absentPath), bytes); }
        else { assert.equal(String(created.error?.statusCode), '403'); assert.equal(await exists(bucket, absentPath), false); }
        cases++;
        // Existing UPDATE policies also govern moves. Keep their established
        // office/admin boundary, including moves to another reporter's folder.
        const moveSource = `${folder}/http-move-source-${randomUUID()}.txt`;
        const moveTarget = `${randomUUID()}/http-move-target-${randomUUID()}.txt`;
        files.push([bucket, moveSource], [bucket, moveTarget]);
        ok(await service.storage.from(bucket).upload(moveSource, bytes, { contentType: 'text/plain' }));
        const moved = await api.storage.from(bucket).move(moveSource, moveTarget);
        if (update) {
          ok(moved);
          assert.equal(await exists(bucket, moveSource), false);
          assert.deepEqual(await content(service, bucket, moveTarget), bytes);
        } else {
          assert.ok(moved.error);
          assert.ok(['400', '403', '404'].includes(String(moved.error.statusCode)));
          assert.deepEqual(await content(service, bucket, moveSource), bytes);
          assert.equal(await exists(bucket, moveTarget), false);
        }
        cases++;
      }
      const deleted = await api.storage.from(bucket).remove([path]);
      if (deleted.error) assert.ok(['400','403','404'].includes(String(deleted.error.statusCode)), 'Unexpected delete failure status');
      if (remove) { ok(deleted); assert.equal(await exists(bucket, path), false); }
      else assert.deepEqual(await content(service, bucket, path), !updated.error ? changed : bytes, 'Denied deletes preserve bytes');
      cases++;
    }
    console.log(`${failures.some(x => x.startsWith(bucket + '/')) ? 'GAP' : 'PASS'} ${bucket}: ${bucket === 'accident-photos' ? 70 : 40} HTTP checks, all five roles and own/other paths.`);
  }
  for (const failure of failures) console.log(`GAP ${failure}`);
  if (failures.length) process.exitCode = 2;
  console.log(`RESULT ${cases - failures.length}/${cases} HTTP cases passed. OMITTED talk-media: local public bucket/source public read differs from reviewed private target.`);
} finally {
  // Cleanup is service-side because some intended policies disallow user deletion.
  const errors = [];
  for (const bucket of new Set(files.map(x => x[0]))) {
    const result = await service.storage.from(bucket).remove(files.filter(x => x[0] === bucket).map(x => x[1]));
    if (result.error) errors.push(`Object cleanup ${bucket}: ${result.error.message}`);
  }
  for (const { api } of actors) await api.auth.signOut();
  for (const id of users) {
    const contacts = await service.from('employee_contacts').delete().eq('converted_user_id', id);
    if (contacts.error) errors.push(`Contact cleanup: ${contacts.error.message}`);
    const removed = await service.auth.admin.deleteUser(id);
    if (removed.error) errors.push(`User cleanup: ${removed.error.message}`);
  }
  assert.deepEqual(errors, [], 'Synthetic fixture cleanup failed');
  for (const [bucket, path] of files) assert.equal(await exists(bucket, path), false, 'Object remained after cleanup');
  console.log('PASS cleanup: all tracked synthetic objects removed; temporary users/contacts deleted. Policies and bucket flags untouched.');
}
