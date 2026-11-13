// Local synthetic time-off backend checks (spec #61). Fixed loopback backend, synthetic users only.
// Extend by appending one self-contained block per ticket at the end of main(): use run.createUser
// for throwaway users (with hire dates), signInSeed for seed logins, run.trackRequest for requests
// on seed users, and print one `PASS:` line per behaviour. Never reorder earlier blocks.
import assert from 'node:assert/strict';
import { createRun, ok, service, signInSeed, SEED_USERS } from './local-time-off-support.mjs';

const run = createRun('time-off');

async function main() {
  // T02 (#63): seed logins carry the expected roles and linked employee records with hire dates.
  for (const handle of Object.keys(SEED_USERS)) {
    const user = await signInSeed(handle);
    const roles = ok(await user.client.from('user_roles').select('role').eq('user_id', user.id)).map(r => r.role);
    assert.deepEqual(roles, [user.role], `${handle} roles`);
    const profile = ok(await user.client.from('profiles').select('contact_id,is_active').eq('user_id', user.id).single());
    assert.equal(profile.is_active, true, `${handle} active`);
    const contact = ok(await user.client.from('employee_contacts').select('hire_date,converted_user_id')
      .eq('id', profile.contact_id).single());
    assert.deepEqual(contact, { hire_date: user.hireDate, converted_user_id: user.id }, `${handle} linked employee record`);
  }
  console.log('PASS: seed logins (employee, other, admin, admin2, foreman2) have roles and linked hire dates.');

  // T02 (#63): helper users get the requested roles and hire date, and are removed at cleanup.
  const temp = await run.createUser({ label: 'helper', roles: ['foreman'], hireDate: '2020-02-29' });
  const own = ok(await temp.client.from('employee_contacts').select('hire_date').eq('id', temp.contactId).single());
  assert.equal(own.hire_date, '2020-02-29');
  console.log('PASS: synthetic helper user signs in with its hire date.');
}

let failed = false;
try {
  await main();
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  try {
    await run.cleanup();
    assert.equal(ok(await service.from('profiles').select('user_id').like('email', `${run.prefix}%`)).length, 0, 'cleanup left profiles');
  } catch (error) {
    failed = true;
    console.error(error);
  }
}
if (failed) process.exitCode = 1;
