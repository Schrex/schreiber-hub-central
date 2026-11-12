// Shared helpers for the local time-off backend check (scripts/local-time-off.mjs).
// Fixed loopback backend only; synthetic @example.test users; never hosted URLs or real data.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from './local-backend.mjs';

export const SEED_PASSWORD = 'LocalOnly-12345!';
export const DENIED = '42501';

/**
 * Seed logins from local/seed.sql (handle -> email, highest role, contact hire date).
 * Keep in sync with the seed; later tickets read hire dates from here instead of hard-coding.
 */
export const SEED_USERS = {
  employee: { email: 'employee@example.test', role: 'employee', hireDate: '2015-03-02' },
  other: { email: 'other@example.test', role: 'employee', hireDate: '2022-07-01' },
  admin: { email: 'admin@example.test', role: 'admin', hireDate: '2010-01-04' },
  admin2: { email: 'admin2@example.test', role: 'admin', hireDate: '2012-05-14' },
  foreman2: { email: 'foreman2@example.test', role: 'foreman', hireDate: '2019-08-12' },
};

/** Assert a Supabase result has no error and return its data. */
export const ok = (r, label) => { assert.equal(r.error, null, `${label ? `${label}: ` : ''}${r.error?.message}`); return r.data; };

/** Assert a Supabase result was refused with the given SQLSTATE (default 42501). */
export const refused = (r, code = DENIED, label = 'expected refusal') => {
  assert.equal(r.error?.code, code, `${label}: got ${r.error ? `${r.error.code} ${r.error.message}` : 'success'}`);
  return r.error;
};

/** New York calendar date (YYYY-MM-DD), offset by whole days from now. */
export const nyDate = (offsetDays = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
  .format(new Date(Date.now() + offsetDays * 86400000));

/** Run SQL as supabase_admin in the local DB container (bypasses RLS; use for setup/inspection only). */
export const sql = (input) => execFileSync('docker', ['exec', '-i', 'supabase_db_schreiber-local', 'psql', '-X', '-qAt',
  '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', 'postgres'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

const status = localStatus(); // Fixed loopback only; never env/hosted keys.
const options = { auth: { persistSession: false, autoRefreshToken: false } };
/** A fresh, signed-out anon client. One client per actor. */
export const anonClient = () => createClient(status.API_URL, status.ANON_KEY, options);
/** Service-role client: setup reads and cleanup only, never for writes under test. */
export const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);

/** Sign in a seed login by handle (see SEED_USERS). Returns { client, id, email, hireDate, role }. */
export async function signInSeed(handle) {
  const seed = SEED_USERS[handle];
  assert.ok(seed, `unknown seed handle ${handle}`);
  const client = anonClient();
  const id = ok(await client.auth.signInWithPassword({ email: seed.email, password: SEED_PASSWORD }), `sign in ${handle}`).user.id;
  return { client, id, ...seed };
}

/**
 * One run of the check: a unique prefix plus per-run cleanup of everything it creates.
 * Usage: const run = createRun('time-off'); try { ... } finally { await run.cleanup(); }
 */
export function createRun(name = 'time-off') {
  const prefix = `${name}-${randomUUID()}`;
  const userIds = [];
  const requestIds = new Set();
  const cleanups = [];
  let counter = 0;

  return {
    prefix,
    /**
     * Create a signed-in synthetic user. roles: app_role[] (default ['employee']).
     * hireDate / terminationDate / isActive set the linked employee record and profile.
     * Returns { client, id, email, contactId }.
     */
    async createUser({ label = `user${++counter}`, roles = ['employee'], hireDate = null, terminationDate = null, isActive = true } = {}) {
      const email = `${prefix}-${label}@example.test`;
      const password = `Local-${randomUUID()}!`;
      const id = ok(await service.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { display_name: `${prefix} ${label}` },
      }), `create ${label}`).user.id;
      userIds.push(id);
      ok(await service.from('user_roles').delete().eq('user_id', id), 'reset roles');
      ok(await service.from('user_roles').insert(roles.map(role => ({ user_id: id, role }))), 'set roles');
      const contactId = ok(await service.from('employee_contacts')
        .update({ hire_date: hireDate, termination_date: terminationDate })
        .eq('converted_user_id', id).select('id').single(), 'set hire date').id;
      const client = anonClient();
      ok(await client.auth.signInWithPassword({ email, password }), `sign in ${label}`);
      if (!isActive) ok(await service.from('profiles').update({ is_active: false }).eq('user_id', id), 'deactivate');
      return { client, id, email, contactId };
    },
    /** Remember a time_off_requests id (any owner, including seed users) for deletion at cleanup. */
    trackRequest(id) { requestIds.add(id); return id; },
    /** Register an extra cleanup step (runs before the built-in ones, last registered first). */
    onCleanup(fn) { cleanups.push(fn); },
    async cleanup() {
      const errors = [];
      const attempt = async (fn) => { try { await fn(); } catch (error) { errors.push(error); } };
      for (const fn of cleanups.reverse()) await attempt(fn);
      const ids = [...requestIds];
      if (ids.length) {
        await attempt(async () => ok(await service.from('notifications').delete().in('metadata->>request_id', ids)));
        await attempt(async () => ok(await service.from('time_off_requests').delete().in('id', ids)));
      }
      if (userIds.length) {
        await attempt(async () => ok(await service.from('time_off_requests').delete().in('user_id', userIds)));
        await attempt(async () => ok(await service.from('notifications').delete().in('user_id', userIds)));
        await attempt(async () => ok(await service.from('employee_contacts').delete().in('converted_user_id', userIds)));
        for (const id of userIds) await attempt(async () => ok(await service.auth.admin.deleteUser(id)));
      }
      if (errors.length) throw new AggregateError(errors, `${prefix} cleanup failed`);
    },
  };
}
