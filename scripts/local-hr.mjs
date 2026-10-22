import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from './local-backend.mjs';

const status = localStatus();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const employee = createClient(status.API_URL, status.ANON_KEY, options);
const other = createClient(status.API_URL, status.ANON_KEY, options);
const admin = createClient(status.API_URL, status.ANON_KEY, options);
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
const cleanup = [];
function ok(result) {
  assert.equal(result.error, null, result.error?.message);
  return result.data;
}
async function insert(client, table, row) {
  const id = randomUUID();
  cleanup.unshift([table, id]);
  const result = await client.from(table).insert({ ...row, id }).select().single();
  return result;
}
try {
  const identity = ok(await employee.auth.signInWithPassword({ email: 'employee@example.test', password: 'LocalOnly-12345!' }));
  ok(await other.auth.signInWithPassword({ email: 'other@example.test', password: 'LocalOnly-12345!' }));
  ok(await admin.auth.signInWithPassword({ email: 'admin@example.test', password: 'LocalOnly-12345!' }));
  const benefitType = ok(await insert(admin, 'benefit_types', { name: `Synthetic benefit ${randomUUID()}`, default_annual_value: 1200 }));
  const row = { user_id: identity.user.id, benefit_type_id: benefitType.id, annual_value: 1200 };
  const benefit = ok(await insert(admin, 'employee_benefits', row));
  assert.equal(ok(await employee.from('employee_benefits').select('annual_value').eq('id', benefit.id).single()).annual_value, 1200);
  assert.equal(ok(await other.from('employee_benefits').select('id').eq('id', benefit.id)).length, 0);
  const unauthorized = await insert(employee, 'employee_benefits', row);
  assert.equal(unauthorized.error?.code, '42501', 'Employee benefit writes must be rejected by authorization.');
  assert.deepEqual(ok(await service.from('employee_benefits').select('id').eq('id', cleanup[0][1])), []);
  const negative = await insert(admin, 'employee_benefits', { ...row, annual_value: -1 });
  assert.equal(negative.error?.code, 'P0001');
  assert.equal(negative.error?.message, 'annual_value cannot be negative');
  assert.deepEqual(ok(await service.from('employee_benefits').select('id').eq('id', cleanup[0][1])), []);
  console.log('PASS: admin manages benefits; employees read only their own; negative values rejected.');

  const comp = ok(await insert(admin, 'employee_compensation_history', {
    user_id: identity.user.id, year: new Date().getUTCFullYear(),
    base_salary: 50000, bonus: 2000, benefits_value: 1200,
  }));
  assert.equal(comp.total_compensation, 53200);
  assert.equal(ok(await employee.from('employee_compensation_history').select('total_compensation').eq('id', comp.id).single()).total_compensation, 53200);
  assert.equal(ok(await other.from('employee_compensation_history').select('id').eq('id', comp.id)).length, 0);
  const unauthorizedUpdate = await employee.from('employee_compensation_history').update({base_salary:999999}).eq('id', comp.id).select('id');
  assert.equal(unauthorizedUpdate.error, null, 'RLS should filter this update without an API error.');
  assert.deepEqual(unauthorizedUpdate.data, [], 'Employee must update zero rows.');
  assert.deepEqual(ok(await service.from('employee_compensation_history').select().eq('id', comp.id).single()), comp, 'Denied update must leave the entire compensation record unchanged.');
  const updated = ok(await admin.from('employee_compensation_history').update({bonus:3000}).eq('id', comp.id).select().single());
  assert.equal(updated.total_compensation, 54200);
  const audit = ok(await admin.from('pay_audit_log').select('action').eq('record_id', comp.id));
  assert.ok(audit.some(r => r.action === 'INSERT') && audit.some(r => r.action === 'UPDATE'));
  console.log('PASS: compensation calculated on insert/update; cross-user reads and employee edits blocked; audit entries recorded.');
} finally {
  for (const [table, id] of cleanup) ok(await service.from(table).delete().eq('id', id));
  await Promise.all([employee.auth.signOut(), other.auth.signOut(), admin.auth.signOut()]);
}
console.log('HR Auth/API tests passed. Full HR browser workflow and production ACL parity remain unverified.');
