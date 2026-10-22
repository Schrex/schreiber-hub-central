// Synthetic loopback-only proof of destination's private talk-media delta.
// Restores the original local public flag and exact Storage policy catalog.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from './local-backend.mjs';
const status = localStatus();
assert.equal(status.API_URL, 'http://127.0.0.1:55321');
const query = sql => execFileSync('docker', ['exec', '-i', 'supabase_db_schreiber-local', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', 'postgres'], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const snapshot = () => query(`SELECT jsonb_build_object('policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_policies p WHERE schemaname='storage' AND tablename='objects'),'buckets',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM storage.buckets b))::text;`);
const before = snapshot();
assert.equal(query("SELECT public FROM storage.buckets WHERE id='talk-media'"), 't');
assert.equal(query("SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public read talk-media' AND roles='{public}' AND cmd='SELECT' AND qual=$q$(bucket_id = 'talk-media'::text)$q$"), '1');
assert.equal(query("SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Signed-in read talk-media'"), '0');
const client = key => createClient(status.API_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
const service = client(status.SERVICE_ROLE_KEY), users = [], actors = [], files = [];
const original = new TextEncoder().encode('Fabricated private safety media.'), changed = new TextEncoder().encode('Fabricated replacement safety media.');
const ok = result => { assert.equal(result.error, null, result.error?.message); return result.data; };
const denied = result => { assert.ok(result.error, 'Expected permission denial'); assert.ok(['400', '403', '404'].includes(String(result.error.statusCode)), 'Unexpected failure status'); };
const bytes = async (api, path) => new Uint8Array(await ok(await api.storage.from('talk-media').download(path)).arrayBuffer());
const exists = async path => ok(await service.storage.from('talk-media').list(path.split('/')[0], { search: path.split('/')[1] })).some(x => x.name === path.split('/')[1]);
let installed = false, checks = 0;
try {
  query(`BEGIN; UPDATE storage.buckets SET public=false WHERE id='talk-media'; ALTER POLICY "Public read talk-media" ON storage.objects TO authenticated; ALTER POLICY "Public read talk-media" ON storage.objects RENAME TO "Signed-in read talk-media"; COMMIT;`);
  installed = true;
  for (const role of ['employee', 'foreman', 'office', 'admin']) {
    const email = `private-media-${randomUUID()}@example.test`, password = `Local-${randomUUID()}!`;
    const user = ok(await service.auth.admin.createUser({ email, password, email_confirm: true })).user;
    users.push(user.id);
    ok(await service.from('user_roles').delete().eq('user_id', user.id));
    ok(await service.from('user_roles').insert({ user_id: user.id, role }));
    const api = client(status.ANON_KEY);
    ok(await api.auth.signInWithPassword({ email, password }));
    actors.push({ role, id: user.id, api });
  }
  actors.push({ role: 'anon', id: randomUUID(), api: client(status.ANON_KEY) });
  for (const { role, id, api } of actors) for (const own of [true, false]) {
    const folder = own ? id : randomUUID(), path = `${folder}/media-${randomUUID()}.txt`, newPath = `${folder}/new-${randomUUID()}.txt`;
    files.push(path, newPath);
    ok(await service.storage.from('talk-media').upload(path, original, { contentType: 'text/plain' }));
    const read = await api.storage.from('talk-media').download(path);
    if (role === 'anon') denied(read); else assert.deepEqual(new Uint8Array(await ok(read).arrayBuffer()), original);
    checks++;
    const signed = await api.storage.from('talk-media').createSignedUrl(path, 60);
    if (role === 'anon') denied(signed);
    else {
      const url = new URL(ok(signed).signedUrl);
      assert.equal(url.origin, status.API_URL);
      const response = await fetch(url);
      assert.equal(response.status, 200);
      assert.deepEqual(new Uint8Array(await response.arrayBuffer()), original);
    }
    checks++;
    const publicResponse = await fetch(`${status.API_URL}/storage/v1/object/public/talk-media/${path}`);
    assert.ok([400, 403, 404].includes(publicResponse.status), 'Private media accessible through public URL');
    checks++;
    const insert = await api.storage.from('talk-media').upload(newPath, original, { contentType: 'text/plain' });
    if (role === 'admin') { ok(insert); assert.deepEqual(await bytes(service, newPath), original); }
    else { assert.equal(String(insert.error?.statusCode), '403'); assert.equal(await exists(newPath), false); }
    checks++;
    const update = await api.storage.from('talk-media').update(path, changed, { contentType: 'text/plain' });
    if (role === 'admin') ok(update); else denied(update);
    assert.deepEqual(await bytes(service, path), role === 'admin' ? changed : original);
    checks++;
    // No destination DELETE policy exists, including for admin.
    const deletion = await api.storage.from('talk-media').remove([path]);
    if (deletion.error) denied(deletion);
    assert.deepEqual(await bytes(service, path), role === 'admin' ? changed : original);
    checks++;
  }
  console.log(`PASS ${checks}/60 private talk-media HTTP checks: four signed-in roles plus anon, own/other paths, download/sign/public denial/create/replace/delete denial.`);
} finally {
  try {
    if (files.length) ok(await service.storage.from('talk-media').remove(files));
    for (const { api } of actors) await api.auth.signOut();
    for (const id of users) {
      ok(await service.from('employee_contacts').delete().eq('converted_user_id', id));
      ok(await service.auth.admin.deleteUser(id));
    }
    for (const path of files) assert.equal(await exists(path), false);
    console.log('PASS synthetic private-media cleanup.');
  } finally {
    if (installed) query(`BEGIN; ALTER POLICY "Signed-in read talk-media" ON storage.objects RENAME TO "Public read talk-media"; ALTER POLICY "Public read talk-media" ON storage.objects TO public; UPDATE storage.buckets SET public=true WHERE id='talk-media'; COMMIT;`);
    assert.equal(snapshot(), before, 'Original Storage catalog or bucket metadata not restored');
    console.log('PASS exact original Storage policy catalog and all bucket metadata restored. Hosted HTTP remains unverified.');
  }
}
