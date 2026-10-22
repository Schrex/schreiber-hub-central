import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createEmployeeHandler } from '../supabase/functions/create-employee/handler.ts';
import { localStatus } from './local-backend.mjs';
const status = localStatus(); // Fixed loopback only; never env/hosted keys.
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const handler = createEmployeeHandler(createClient, { url: status.API_URL, anonKey: status.ANON_KEY, serviceKey: status.SERVICE_ROLE_KEY });
const sql = (input) => execFileSync('docker', ['exec','-i','supabase_db_schreiber-local','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres'], { input, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
const ok = (r) => { assert.equal(r.error, null, r.error?.message); return r.data; };
const prefix = `onboard-${randomUUID()}`;
const contactIds = new Set(); const userIds = new Set();
const details = (tag, extra = {}) => ({ name: `Synthetic ${tag}`, first_name: 'Synthetic', last_name: tag, email: `${prefix}-${tag}@example.test`, ...extra });
async function call(token, body, expected = 200, currentHandler = handler) {
  const response = await currentHandler(new Request('http://127.0.0.1/create-employee', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  const result = await response.json();
  if (result.contactId) contactIds.add(result.contactId);
  if (result.userId) userIds.add(result.userId);
  assert.ok((Array.isArray(expected) ? expected : [expected]).includes(response.status), `${response.status}: ${JSON.stringify(result)}`);
  return result;
}
const signIn = async (email) => {
  const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
  return ok(await client.auth.signInWithPassword({ email, password: 'LocalOnly-12345!' })).session.access_token;
};
let positionId;
const triggerState = sql("SELECT tgenabled FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='on_auth_user_created'").trim();
assert.ok(['O','D'].includes(triggerState), 'Fault probes require the expected ordinary or disabled local signup trigger');
const contactSelect = sql("SELECT has_table_privilege('service_role','public.employee_contacts','SELECT')").trim();
try {
  sql('SET ROLE postgres;\n' + readFileSync(new URL('../local/candidate-migrations/20261022010000_employee_creation.sql', import.meta.url), 'utf8'));
  const admin = await signIn('admin@example.test');
  const employee = await signIn('employee@example.test');
  await call('invalid', details('invalid'), 401);
  await call(employee, details('denied'), 403);
  // Reproduce hosted SELECT denial, then verify the new RPC path without widening ACLs.
  sql('REVOKE SELECT ON public.employee_contacts FROM service_role');
  assert.equal((await service.from('employee_contacts').select('id').limit(1)).error?.code, '42501');
  const contact = await call(admin, details('contact'));
  assert.equal(contact.userId, null);
  await call(admin, details('contact'), 400);
  console.log('PASS: contact creation works despite reproduced service-role SELECT denial; duplicate rejected.');
  sql('GRANT SELECT ON public.employee_contacts TO service_role');
  positionId = ok(await service.from('positions').insert({ title: prefix, min_pay_rate: 10, max_pay_rate: 50 }).select('id').single()).id;
  for (const enabled of [true, false]) {
    sql(`ALTER TABLE auth.users ${enabled ? 'ENABLE' : 'DISABLE'} TRIGGER on_auth_user_created`);
    for (const role of ['employee','foreman','office','admin']) {
      const tag = `${enabled}-${role}`;
      const body = details(tag, { createLogin: true, loginEmail: `${prefix}-login-${tag}@example.test`, password: 'LocalOnly-12345!', role, positionId, payRate: 25 });
      const result = await call(admin, body);
      const profile = ok(await service.from('profiles').select('*').eq('user_id', result.userId).single());
      assert.equal(profile.contact_id, result.contactId);
      assert.equal(profile.email, body.email);
      assert.equal(ok(await service.from('employee_contacts').select('converted_user_id').eq('id', result.contactId).single()).converted_user_id, result.userId);
      assert.deepEqual(ok(await service.from('user_roles').select('role').eq('user_id', result.userId)), [{ role }]);
      assert.equal(ok(await service.from('employee_positions').select('pay_rate').eq('user_id', result.userId).single()).pay_rate, 25);
      const token = await signIn(body.loginEmail);
      if (['foreman','office'].includes(role)) {
        await call(token, details(`${tag}-contact`));
        await call(token, details(`${tag}-denied-login`, { createLogin: true, loginEmail: 'denied@example.test', password: 'LocalOnly-12345!' }), 403);
        await call(token, details(`${tag}-denied-position`, { positionId, payRate: 20 }), 403);
      }
    }
  }
  console.log('PASS: login, explicit profile/role/contact linkage and position with signup trigger enabled AND disabled; office/foreman authorization.');
  await call(admin, details('bad-role', { role: 'superuser' }), 400);
  await call(admin, details('bad-position', { createLogin: true, loginEmail: 'bad-position@example.test', password: 'LocalOnly-12345!', positionId: randomUUID(), payRate: 1 }), 400);
  const failed = details('fail', { createLogin: true, loginEmail: `${prefix}-fail-login@example.test`, password: 'LocalOnly-12345!', positionId, payRate: 20, effectiveDate: 'not-a-date' });
  await call(admin, failed, 500);
  assert.equal(ok(await service.from('employee_contacts').select('id').ilike('email', failed.loginEmail)).length, 0);
  assert.equal(ok(await service.auth.admin.listUsers({ perPage: 1000 })).users.filter(u => u.email === failed.loginEmail).length, 0);
  // Auth rejects a duplicate independently of directory checks (injected between prepare/Auth).
  const raceFactory = (...args) => {
    const client = createClient(...args);
    if (args[1] === status.SERVICE_ROLE_KEY) client.auth.admin.createUser = async () => ({ data: { user: null }, error: new Error('Email already registered') });
    return client;
  };
  await call(admin, details('auth-error', { createLogin: true, loginEmail: `${prefix}-auth-error@example.test`, password: 'LocalOnly-12345!' }), 500,
    createEmployeeHandler(raceFactory, { url: status.API_URL, anonKey: status.ANON_KEY, serviceKey: status.SERVICE_ROLE_KEY }));
  assert.equal(ok(await service.from('employee_contacts').select('id').eq('email', `${prefix}-auth-error@example.test`)).length, 0);
  console.log('PASS: invalid role/position rejected; final transaction failure and Auth rejection compensated without orphaned contact/login.');
  await call(admin, details('existing-auth', { email: 'admin@example.test' }), 400);
  await call(admin, details('bad-boolean', { createLogin: 'false' }), 400);
  const concurrent = await Promise.all([call(admin, details('concurrent'), [200,400]), call(admin, details('concurrent'), [200,400])]);
  // Either request may win; inspect persisted state rather than assuming scheduling.
  const concurrentRows = ok(await service.from('employee_contacts').select('id').eq('email', `${prefix}-concurrent@example.test`));
  assert.equal(concurrentRows.length, 1); contactIds.add(concurrentRows[0].id);
  assert.equal(concurrent.filter(r => r.success).length, 1);
  assert.equal(concurrent.filter(r => r.error).length, 1);
  const cleanupFactory = (...args) => {
    const client = createClient(...args);
    if (args[1] === status.SERVICE_ROLE_KEY) client.auth.admin.deleteUser = async () => ({ data: { user: null }, error: new Error('Synthetic deletion failure') });
    return client;
  };
  const pending = await call(admin, details('cleanup-error', { createLogin: true, loginEmail: `${prefix}-cleanup-error@example.test`, password: 'LocalOnly-12345!', positionId, payRate: 20, effectiveDate: 'not-a-date' }), 500,
    createEmployeeHandler(cleanupFactory, { url: status.API_URL, anonKey: status.ANON_KEY, serviceKey: status.SERVICE_ROLE_KEY }));
  assert.equal(pending.cleanupRequired, true);
  assert.ok(pending.contactId && pending.userId);
  assert.match(pending.error, /Do not retry/);
  console.log('PASS: concurrent duplicate suppression and explicit cleanup-failure references.');
  // Lost response after a committed reservation retains a deterministic reference.
  const uncertainFactory = (...args) => {
    const client = createClient(...args);
    if (args[1] === status.SERVICE_ROLE_KEY) {
      const rpc = client.rpc.bind(client);
      client.rpc = async (name, params) => {
        const result = await rpc(name, params);
        if (name === 'prepare_employee_creation' && !result.error) return { data: null, error: { code: '', message: 'Synthetic lost response' } };
        return result;
      };
    }
    return client;
  };
  const uncertain = await call(admin, details('uncertain'), 503, createEmployeeHandler(uncertainFactory, { url: status.API_URL, anonKey: status.ANON_KEY, serviceKey: status.SERVICE_ROLE_KEY }));
  assert.equal(uncertain.cleanupRequired, true);
  assert.equal(ok(await service.from('employee_contacts').select('id').eq('id', uncertain.contactId)).length, 1);
  // A lost Auth response must not delete the contact and leave an untracked login.
  const uncertainAuthFactory = (...args) => {
    const client = createClient(...args);
    if (args[1] === status.SERVICE_ROLE_KEY) {
      const create = client.auth.admin.createUser.bind(client.auth.admin);
      client.auth.admin.createUser = async (params) => {
        const result = await create(params); assert.equal(result.error, null);
        userIds.add(result.data.user.id);
        return { data: { user: null }, error: new Error('Synthetic lost Auth response') };
      };
    }
    return client;
  };
  const unknownUser = await call(admin, details('uncertain-auth', { createLogin: true, loginEmail: `${prefix}-uncertain-auth@example.test`, password: 'LocalOnly-12345!' }), 500,
    createEmployeeHandler(uncertainAuthFactory, { url: status.API_URL, anonKey: status.ANON_KEY, serviceKey: status.SERVICE_ROLE_KEY }));
  assert.equal(unknownUser.cleanupRequired, true);
  assert.equal(unknownUser.userId, null);
  console.log('PASS: lost reservation/Auth responses preserve review references and block unsafe cleanup.');
  // anon/authenticated cannot bypass the handler through privileged RPCs.
  for (const token of [status.ANON_KEY, admin, employee]) {
    const unprivileged = createClient(status.API_URL, status.ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
    assert.ok((await unprivileged.rpc('prepare_employee_creation', { caller_id: randomUUID(), details: details('rpc-denied') })).error);
    assert.ok((await unprivileged.rpc('finish_employee_creation', { caller_id: randomUUID(), contact_id: randomUUID(), new_user_id: randomUUID(), details: {} })).error);
    assert.ok((await unprivileged.rpc('cancel_employee_creation', { caller_id: randomUUID(), contact_id: randomUUID() })).error);
  }
} finally {
  sql(`ALTER TABLE auth.users ${triggerState === 'D' ? 'DISABLE' : 'ENABLE'} TRIGGER on_auth_user_created`);
  for (const id of userIds) {
    ok(await service.from('employee_positions').delete().eq('user_id', id));
    ok(await service.auth.admin.deleteUser(id));
  }
  for (const id of contactIds) ok(await service.from('employee_contacts').delete().eq('id', id));
  if (positionId) ok(await service.from('positions').delete().eq('id', positionId));
  if (contactSelect === 'f') sql('REVOKE SELECT ON public.employee_contacts FROM service_role');
}
console.log('Employee creation integration checks passed (synthetic local handler + Auth/REST; no hosted execution).');
