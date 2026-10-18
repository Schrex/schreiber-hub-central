import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from './local-backend.mjs';

const status = localStatus();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const employee = createClient(status.API_URL, status.ANON_KEY, options);
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
const created = [];
function ok(result) {
  assert.equal(result.error, null, result.error?.message);
  return result.data;
}
async function rejectInsert(row) {
  const id = randomUUID();
  created.push(id); // Clean up even if a regression inserts a row without returning it.
  const result = await employee.from('time_off_requests').insert({ ...row, id });
  assert.equal(result.error?.code, '42501', 'Expected an authorization rejection.');
  assert.deepEqual(ok(await service.from('time_off_requests').select('id').eq('id', id)), [], 'Rejected insert must not persist a row.');
}
try {
  const login = ok(await employee.auth.signInWithPassword({email:'employee@example.test', password:'LocalOnly-12345!'}));
  const base = {user_id:login.user.id, start_date:'2031-06-10', end_date:'2031-06-11', reason:'Local permission regression'};
  await rejectInsert({...base, status:'approved'});
  await rejectInsert({...base, decided_by:login.user.id});
  console.log('PASS: pre-approved requests and fabricated decision metadata are rejected without storing rows.');

  const id = randomUUID();
  created.push(id);
  const pending = ok(await employee.from('time_off_requests').insert({...base, id}).select().single());
  for (const patch of [{status:'approved'}, {status:'cancelled', reason:'Unauthorized rewrite'}]) {
    const result = await employee.from('time_off_requests').update(patch).eq('id', id).select('id');
    assert.equal(result.error?.code, '42501', 'Self-approval and cancellation tampering must fail authorization.');
    assert.deepEqual(ok(await service.from('time_off_requests').select().eq('id', id).single()), pending, 'Rejected update must leave the entire pending request unchanged.');
  }
  const cancelled = ok(await employee.from('time_off_requests').update({status:'cancelled'}).eq('id', id).select().single());
  assert.equal(cancelled.status, 'cancelled');
  const persisted = ok(await service.from('time_off_requests').select().eq('id', id).single());
  assert.deepEqual(persisted, cancelled);
  const { status: oldStatus, updated_at: oldUpdated, ...oldContent } = pending;
  const { status: newStatus, updated_at: newUpdated, ...newContent } = persisted;
  assert.deepEqual(newContent, oldContent, 'Cancellation may change only status and updated_at.');
  console.log('PASS: self-approval and tampering leave requests unchanged; legitimate cancellation persists only permitted changes.');
} finally {
  if (created.length) ok(await service.from('time_off_requests').delete().in('id', created));
  await employee.auth.signOut();
}
