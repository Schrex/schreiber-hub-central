import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localStatus } from './local-backend.mjs';
import { checkEmailDelivery } from '../supabase/functions/_shared/email-delivery-guard.ts';
import { rateLimitLogFields } from '../supabase/functions/_shared/email-queue-policy.ts';

const status = localStatus(); // Refuses all origins except the synthetic loopback API.
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const email = `delivery-guard-${randomUUID()}@example.test`;
const messageId = randomUUID();
const ok = result => {
  assert.equal(result.error, null, result.error?.message);
  return result.data;
};
const lookup = {
  suppression: email => service.from('suppressed_emails').select('reason').eq('email', email).maybeSingle(),
  unsubscribe: email => service.from('email_unsubscribe_tokens').select('used_at').eq('email', email).maybeSingle(),
};
try {
  let cases = 0;
  for (const reason of [null, 'unsubscribe', 'bounce', 'complaint']) {
    ok(await service.from('suppressed_emails').delete().eq('email', email));
    if (reason) ok(await service.from('suppressed_emails').insert({ email, reason }));
    for (const tokenState of ['absent', 'unused', 'used']) {
      ok(await service.from('email_unsubscribe_tokens').delete().eq('email', email));
      if (tokenState !== 'absent') ok(await service.from('email_unsubscribe_tokens').insert({
        email, token: randomUUID(), used_at: tokenState === 'used' ? new Date().toISOString() : null,
      }));
      for (const queue of ['auth_emails', 'transactional_emails']) {
        const result = await checkEmailDelivery(queue, email.toUpperCase(), lookup);
        const expected = reason && (queue === 'transactional_emails' || reason !== 'unsubscribe')
          ? { kind: 'suppress', reason: 'recipient_suppressed' }
          : queue === 'transactional_emails' && tokenState === 'used'
            ? { kind: 'suppress', reason: 'recipient_unsubscribed' } : { kind: 'allow' };
        assert.deepEqual(result, expected, `${queue}: ${reason ?? 'no suppression'}/${tokenState}`);
        cases++;
      }
    }
  }
  console.log(`PASS: ${cases} real local REST suppression/token/queue combinations, including uppercase recipient normalization.`);

  // Exercise actual REST errors without changing schema or permissions.
  const unavailable = () => service.from('synthetic_guard_missing_relation').select('id').maybeSingle();
  assert.deepEqual(await checkEmailDelivery('auth_emails', email, { ...lookup, suppression: unavailable }), { kind: 'defer', reason: 'lookup_failed' });
  ok(await service.from('suppressed_emails').delete().eq('email', email));
  assert.deepEqual(await checkEmailDelivery('transactional_emails', email, { ...lookup, unsubscribe: unavailable }), { kind: 'defer', reason: 'lookup_failed' });
  console.log('PASS: real local REST lookup errors defer delivery instead of allowing it.');

  const base = { message_id: messageId, template_name: 'synthetic-delivery-guard', recipient_email: email };
  ok(await service.from('email_send_log').insert([{ ...base, status: 'failed' }, { ...base, status: 'failed' }]));
  const failures = async () => ok(await service.from('email_send_log').select('id').eq('message_id', messageId).eq('status', 'failed')).length;
  const before = await failures();
  assert.equal(before, 2);
  ok(await service.from('email_send_log').insert({ ...base, ...rateLimitLogFields(60) }));
  assert.equal(await failures(), before, 'Rate limit deferral must not consume send-failure budget.');
  const saved = ok(await service.from('email_send_log').select('status,metadata').eq('message_id', messageId).eq('status', 'pending').single());
  assert.deepEqual(saved, { status: 'pending', metadata: { outcome: 'rate_limited', retry_after_seconds: 60 } });
  console.log('PASS: pending rate-limit metadata persists under existing schema; failed-attempt count unchanged.');
} finally {
  const results = await Promise.all([
    service.from('suppressed_emails').delete().eq('email', email),
    service.from('email_unsubscribe_tokens').delete().eq('email', email),
    service.from('email_send_log').delete().eq('message_id', messageId),
  ]);
  for (const result of results) ok(result);
}
