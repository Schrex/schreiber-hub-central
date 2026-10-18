import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from './local-backend.mjs';

const status = localStatus();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const client = () => createClient(status.API_URL, status.ANON_KEY, options);
const employee = client();
const other = client();
const admin = client();
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
function ok(result) {
  assert.equal(result.error, null, result.error?.message);
  return result.data;
}
let requestId;
const forgedId = randomUUID();
const invalidId = randomUUID();
try {
  const first = ok(await employee.auth.signInWithPassword({ email: 'employee@example.test', password: 'LocalOnly-12345!' }));
  ok(await other.auth.signInWithPassword({ email: 'other@example.test', password: 'LocalOnly-12345!' }));
  const manager = ok(await admin.auth.signInWithPassword({ email: 'admin@example.test', password: 'LocalOnly-12345!' }));
  console.log('PASS: synthetic employee, second employee, and admin can sign in.');

  const request = ok(await employee.from('time_off_requests').insert({
    user_id: first.user.id, requester_name: 'Local Employee', type: 'vacation',
    start_date: '2030-06-10', end_date: '2030-06-11', reason: 'Local isolation smoke test',
  }).select().single());
  requestId = request.id;
  assert.equal(request.status, 'pending');
  console.log('PASS: employee creates a pending time-off request.');

  assert.equal(ok(await other.from('time_off_requests').select('id').eq('id', requestId)).length, 0);
  const forged = await other.from('time_off_requests').insert({
    id: forgedId, user_id: first.user.id, start_date: '2030-07-10', end_date: '2030-07-11',
  });
  assert.equal(forged.error?.code, '42501', 'Forged ownership must fail authorization.');
  assert.deepEqual(ok(await service.from('time_off_requests').select('id').eq('id', forgedId)), []);
  console.log('PASS: another employee cannot read or forge the request.');

  const invalid = await employee.from('time_off_requests').insert({
    id: invalidId, user_id: first.user.id, start_date: '2030-07-11', end_date: '2030-07-10',
  });
  assert.equal(invalid.error?.code, '23514', 'Expected a check-constraint violation.');
  assert.match(invalid.error?.message ?? '', /check constraint "time_off_dates_valid"/);
  assert.deepEqual(ok(await service.from('time_off_requests').select('id').eq('id', invalidId)), []);
  console.log('PASS: database rejects reversed dates.');

  ok(await admin.from('time_off_requests').update({
    status: 'approved', decided_by: manager.user.id, decided_at: new Date().toISOString(),
  }).eq('id', requestId).select().single());
  assert.equal(ok(await employee.from('time_off_requests').select('status').eq('id', requestId).single()).status, 'approved');
  console.log('PASS: admin approves; employee reads approved status.');
  console.log('Database/API workflow passed. Email delivery and browser behavior are not covered.');
} finally {
  ok(await service.from('time_off_requests').delete().in('id', [requestId, forgedId, invalidId].filter(Boolean)));
  await Promise.all([employee.auth.signOut(), other.auth.signOut(), admin.auth.signOut()]);
}
