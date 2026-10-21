import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isolateEnvironment, validateDestination } from './independent-build.mjs';

const project = 'abcdefghijklmnopqrst';
const token = claims => ['synthetic', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'synthetic'].join('.');
const valid = { project, url: `https://${project}.supabase.co`, key: token({ role: 'anon', ref: project }) };

test('rejects missing/source/wrong destinations and privileged or invalid keys', () => {
  for (const input of [undefined, {}, { ...valid, project: 'bitogpfplcquovpdjprk' }, { ...valid, url: 'http://localhost:55321' }, { ...valid, url: `${valid.url}/` }, ...[
    'sb_secret_synthetic', 'sb_publishable_synthetic', 'invalid', token({ role: 'service_role', ref: project }), token({ role: 'anon', ref: 'wrong' }), token({ role: 'anon', ref: project, exp: 1 }),
  ].map(key => ({ ...valid, key }))]) assert.throws(() => validateDestination(input));
});

test('explicit destination and independent controls replace inherited configuration', () => {
  const client = validateDestination(valid);
  const env = isolateEnvironment({ PATH: '/synthetic', VITE_SUPABASE_URL: 'source', VITE_EXTRA_SECRET: 'secret', SUPABASE_SERVICE_ROLE_KEY: 'secret', POSTMARK_SERVER_TOKEN: 'secret', NODE_OPTIONS: '--require=unsafe' }, client);
  assert.equal(env.VITE_SUPABASE_URL, valid.url);
  assert.equal(env.VITE_INDEPENDENT_LAUNCH, 'true');
  assert.equal(env.VITE_LOCAL_BACKEND, 'false');
  assert.equal(env.VITE_REHEARSAL_BACKEND, 'false');
  for (const name of ['VITE_EXTRA_SECRET', 'SUPABASE_SERVICE_ROLE_KEY', 'POSTMARK_SERVER_TOKEN', 'NODE_OPTIONS']) assert.equal(env[name], undefined);
});
