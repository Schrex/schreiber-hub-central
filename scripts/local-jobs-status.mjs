// Local synthetic jobs status lifecycle checks (candidate migration
// 20261026010000_jobs_status_lifecycle.sql). No hosted URL or real-data inputs.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from './local-backend.mjs';
const status = localStatus(); // Fixed loopback only; never env/hosted keys.
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const client = key => createClient(status.API_URL, key, options);
const service = client(status.SERVICE_ROLE_KEY);
const office = client(status.ANON_KEY);
const employee = client(status.ANON_KEY);
const sql = (input) => execFileSync('docker', ['exec', '-i', 'supabase_db_schreiber-local', 'psql', '-X', '-qAt',
  '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', 'postgres'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const ok = (r) => { assert.equal(r.error, null, r.error?.message); return r.data; };
const prefix = `jobs-status-${randomUUID()}`;
const jobIds = [];
let officeId;
const nyDate = (offsetDays) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
};
const fields = 'id,status,completed_at,completed_by,hold_reason';
const insertAs = async (actor, row) => {
  const job = ok(await actor.from('jobs').insert({ name: `${prefix} ${jobIds.length}`, ...row }).select(fields).single());
  jobIds.push(job.id);
  return job;
};
const update = async (actor, id, patch) => actor.from('jobs').update(patch).eq('id', id).select(fields).single();

try {
  const email = `${prefix}-office@example.test`;
  const password = `Local-${randomUUID()}!`;
  officeId = ok(await service.auth.admin.createUser({ email, password, email_confirm: true })).user.id;
  ok(await service.from('user_roles').delete().eq('user_id', officeId));
  ok(await service.from('user_roles').insert({ user_id: officeId, role: 'office' }));
  ok(await office.auth.signInWithPassword({ email, password }));
  const employeeId = ok(await employee.auth.signInWithPassword({ email: 'employee@example.test', password: 'LocalOnly-12345!' })).user.id;

  // Entering complete by update: forged completed_by overwritten; completed_at defaults to now.
  const active = await insertAs(office, { status: 'active' });
  assert.equal(active.completed_at, null);
  const before = Date.now();
  const completed = ok(await update(office, active.id, { status: 'complete', completed_by: employeeId }));
  assert.equal(completed.completed_by, officeId, 'forged completed_by must be replaced by the signed-in user');
  assert.ok(Math.abs(new Date(completed.completed_at).getTime() - before) < 60000, 'completed_at defaults to now');
  console.log('PASS: forged completed_by overwritten; completed_at defaults to now.');

  // Insert with status complete is filled in; client completed_at (backdated) kept.
  const backdated = `${nyDate(-30)}T12:00:00-05:00`;
  const inserted = await insertAs(office, { status: 'complete', completed_at: backdated, completed_by: employeeId });
  assert.equal(inserted.completed_by, officeId);
  assert.equal(new Date(inserted.completed_at).getTime(), new Date(backdated).getTime());
  const insertedDefault = await insertAs(office, { status: 'complete' });
  assert.equal(insertedDefault.completed_by, officeId);
  assert.ok(insertedDefault.completed_at);
  console.log('PASS: insert as complete fills completion fields and keeps a backdated completed_at.');

  // Future New York date rejected on entry, on insert and while staying complete.
  const future = `${nyDate(2)}T12:00:00-05:00`;
  const futureEntry = await update(office, (await insertAs(office, {})).id, { status: 'complete', completed_at: future });
  assert.match(futureEntry.error?.message ?? '', /future/i);
  const futureInsert = await office.from('jobs').insert({ name: `${prefix} future`, status: 'complete', completed_at: future }).select('id');
  assert.match(futureInsert.error?.message ?? '', /future/i);
  const futureCorrection = await update(office, inserted.id, { completed_at: future });
  assert.match(futureCorrection.error?.message ?? '', /future/i);
  console.log('PASS: future completed_at rejected (entry, insert, correction).');

  // Staying complete: completed_by pinned, completed_at correctable.
  const corrected = `${nyDate(-10)}T09:00:00-05:00`;
  const service2 = ok(await update(service, inserted.id, { completed_at: corrected, completed_by: employeeId, notes: 'x' }));
  assert.equal(service2.completed_by, officeId, 'completed_by pinned while staying complete');
  assert.equal(new Date(service2.completed_at).getTime(), new Date(corrected).getTime());
  console.log('PASS: staying complete pins completed_by and allows correcting completed_at.');

  // Leaving complete clears completion fields; on_hold reason kept, cleared on leaving.
  const held = ok(await update(office, inserted.id, { status: 'on_hold', hold_reason: 'Waiting on permit' }));
  assert.deepEqual([held.completed_at, held.completed_by, held.hold_reason], [null, null, 'Waiting on permit']);
  const forgedHold = ok(await update(office, held.id, { status: 'on_hold', completed_at: backdated, completed_by: officeId }));
  assert.deepEqual([forgedHold.completed_at, forgedHold.completed_by], [null, null]);
  const resumed = ok(await update(office, held.id, { status: 'active' }));
  assert.equal(resumed.hold_reason, null);
  const activeReason = ok(await update(office, held.id, { hold_reason: 'stale' }));
  assert.equal(activeReason.hold_reason, null);
  const completedFromHold = ok(await update(office, (await insertAs(office, { status: 'on_hold', hold_reason: 'r' })).id, { status: 'complete' }));
  assert.equal(completedFromHold.hold_reason, null);
  console.log('PASS: leaving complete / on_hold clears the matching fields.');

  // Contradictory rows violate the check constraints when the trigger is bypassed.
  const bypass = (cols, vals) => sql(`SET session_replication_role = replica;
INSERT INTO public.jobs (name, status, ${cols}) VALUES ('${prefix} bad', ${vals});`);
  assert.throws(() => bypass('completed_at', `'active', now()`), /jobs_completion_matches_status/);
  assert.throws(() => bypass('completed_by', `'on_hold', '${officeId}'`), /jobs_completion_matches_status/);
  assert.throws(() => bypass('hold_reason', `'active', 'reason'`), /jobs_hold_reason_matches_status/);
  assert.throws(() => bypass('hold_reason', `'complete', 'reason'`), /jobs_hold_reason_matches_status/);
  console.log('PASS: contradictory rows violate the check constraints.');

  // Employee update denied by RLS.
  const target = jobIds[0];
  const denied = await employee.from('jobs').update({ status: 'active' }).eq('id', target).select('id');
  assert.ok(denied.error || denied.data.length === 0, 'employee update must be denied');
  assert.equal(ok(await service.from('jobs').select('status').eq('id', target).single()).status, 'complete');
  console.log('PASS: employee update denied.');

  // Service-role writes store a null completed_by.
  const serviceInsert = await insertAs(service, { status: 'complete', completed_by: officeId });
  assert.equal(serviceInsert.completed_by, null);
  assert.ok(serviceInsert.completed_at);
  const serviceUpdate = ok(await update(service, (await insertAs(service, {})).id, { status: 'complete', completed_by: officeId }));
  assert.equal(serviceUpdate.completed_by, null);
  console.log('PASS: service-role writes store a null completed_by.');
} finally {
  for (const id of jobIds) ok(await service.from('jobs').delete().eq('id', id));
  ok(await service.from('jobs').delete().like('name', `${prefix}%`));
  await office.auth.signOut();
  await employee.auth.signOut();
  if (officeId) {
    ok(await service.from('employee_contacts').delete().eq('converted_user_id', officeId));
    ok(await service.auth.admin.deleteUser(officeId));
  }
}
console.log('Jobs status lifecycle checks passed (synthetic local REST + SQL; no hosted execution).');
