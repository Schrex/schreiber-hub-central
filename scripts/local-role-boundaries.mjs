// Local synthetic role boundaries. No hosted URL or real-data inputs.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from './local-backend.mjs';
const status = localStatus();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const client = key => createClient(status.API_URL, key, options);
const service = client(status.SERVICE_ROLE_KEY);
const employee = client(status.ANON_KEY);
const users = [], files = [];
const compId = randomUUID();
const bytes = new TextEncoder().encode('Synthetic role boundary file');
function ok(r) { assert.equal(r.error, null, r.error?.message); return r.data; }
try {
  const target = ok(await employee.auth.signInWithPassword({ email: 'employee@example.test', password: 'LocalOnly-12345!' })).user.id;
  ok(await service.from('employee_compensation_history').insert({ id: compId, user_id: target, year: new Date().getUTCFullYear(), base_salary: 50000, bonus: 0, benefits_value: 0 }));
  for (const role of ['foreman', 'office']) {
    const email = `boundary-${randomUUID()}@example.test`;
    const password = `Local-${randomUUID()}!`;
    const user = ok(await service.auth.admin.createUser({ email, password, email_confirm: true })).user;
    users.push(user.id);
    ok(await service.from('user_roles').insert({ user_id: user.id, role }));
    const actor = client(status.ANON_KEY);
    try {
      ok(await actor.auth.signInWithPassword({ email, password }));
      assert.deepEqual(ok(await actor.from('employee_compensation_history').select('id').eq('id', compId)), [], `${role} must not read another employee's compensation`);
      const promotion = await actor.from('user_roles').insert({ user_id: user.id, role: 'admin' });
      assert.equal(promotion.error?.code, '42501');
      assert.deepEqual(ok(await service.from('user_roles').select('id').eq('user_id', user.id).eq('role', 'admin')), []);
      for (const bucket of ['job-plans', 'job-photos']) {
        const path = `role-boundary-${randomUUID()}.txt`;
        files.push([bucket, path]);
        ok(await actor.storage.from(bucket).upload(path, bytes, { contentType: 'text/plain' }));
        assert.deepEqual(new Uint8Array(await ok(await employee.storage.from(bucket).download(path)).arrayBuffer()), bytes);
        ok(await actor.storage.from(bucket).remove([path]));
        assert.equal(ok(await service.storage.from(bucket).list('', { search: path })).some(x => x.name === path), false);
      }
      console.log(`PASS ${role}: job-file upload/delete, employee read, salary privacy and denied self-promotion.`);
    } finally { await actor.auth.signOut(); }
  }
} finally {
  for (const [bucket, path] of files) ok(await service.storage.from(bucket).remove([path]));
  ok(await service.from('employee_compensation_history').delete().eq('id', compId));
  ok(await service.from('pay_audit_log').delete().eq('record_id', compId));
  for (const id of users) {
    ok(await service.from('employee_contacts').delete().eq('converted_user_id', id));
    ok(await service.auth.admin.deleteUser(id));
  }
  await employee.auth.signOut();
}
