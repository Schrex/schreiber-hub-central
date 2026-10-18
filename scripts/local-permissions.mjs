import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from './local-backend.mjs';

const status = localStatus();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const employee = createClient(status.API_URL, status.ANON_KEY, options);
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
const created = [];
const failures = [];
try {
  const login = await employee.auth.signInWithPassword({email:'employee@example.test', password:'LocalOnly-12345!'});
  assert.equal(login.error, null, login.error?.message);
  const base = {user_id:login.data.user.id, start_date:'2031-06-10', end_date:'2031-06-11', reason:'Local permission regression'};
  const forged = await employee.from('time_off_requests').insert({...base, status:'approved'}).select('id').single();
  if (forged.data) created.push(forged.data.id);
  if (!forged.error) failures.push('Employee can create their own request already approved.');
  else console.log('PASS: employee cannot create an already-approved request.');

  const pending = await employee.from('time_off_requests').insert(base).select('id').single();
  assert.equal(pending.error, null, pending.error?.message);
  created.push(pending.data.id);
  const escalation = await employee.from('time_off_requests').update({status:'approved'}).eq('id', pending.data.id).select('id');
  if (escalation.data?.length) failures.push('Employee can approve their own pending request.');
  else assert.equal(escalation.error?.code, '42501', 'Self-approval must fail with an authorization error.');
  const tampered = await employee.from('time_off_requests').update({status:'cancelled', reason:'Unauthorized rewrite'}).eq('id', pending.data.id).select('id');
  if (tampered.data?.length) failures.push('Cancellation permits changing request content.');
  else assert.equal(tampered.error?.code, '42501', 'Content tampering must fail with an authorization error.');
  const cancelled = await employee.from('time_off_requests').update({status:'cancelled'}).eq('id', pending.data.id).select('status').single();
  if (cancelled.error || cancelled.data?.status !== 'cancelled') failures.push('Employee cannot cancel their own pending request as the UI promises.');
  else console.log('PASS: employee can cancel their own pending request.');
  const fabricated = await employee.from('time_off_requests').insert({...base, decided_by:login.data.user.id}).select('id').single();
  if (fabricated.data) created.push(fabricated.data.id);
  if (!fabricated.error) failures.push('Employee can fabricate decision metadata on insert.');
  else assert.equal(fabricated.error.code, '42501');
  if (!failures.length) console.log('PASS: self-approval, decision metadata fabrication and cancellation content tampering are blocked.');
} finally {
  if (created.length) {
    const cleanup = await service.from('time_off_requests').delete().in('id', created);
    assert.equal(cleanup.error, null, cleanup.error?.message);
  }
  await employee.auth.signOut();
}
for (const failure of failures) console.error(`FAIL: ${failure}`);
if (failures.length) process.exitCode = 1;
