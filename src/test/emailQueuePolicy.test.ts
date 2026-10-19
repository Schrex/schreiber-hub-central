import { describe, expect, it } from 'vitest';
import { classifyEmailFailure, evaluateEmailPreflight, rateLimitLogFields, persistEmailRateLimit } from '../../supabase/functions/_shared/email-queue-policy';

const pending = {
  queuedAt: '2026-01-01T00:00:00.000Z', nowMs: Date.parse('2026-01-01T00:15:00.000Z'),
  ttlMinutes: 15, failedAttempts: 0, maxRetries: 5,
};

describe('email queue preflight', () => {
  it('keeps a message at its exact TTL eligible but expires it one millisecond later', () => {
    expect(evaluateEmailPreflight(pending)).toEqual({ kind: 'eligible' });
    expect(evaluateEmailPreflight({ ...pending, nowMs: pending.nowMs + 1 })).toEqual({ kind: 'expired', reason: 'TTL exceeded (15 minutes)' });
  });
  it('uses each queue TTL independently', () => {
    expect(evaluateEmailPreflight({ ...pending, nowMs: pending.nowMs + 1, ttlMinutes: 60 })).toEqual({ kind: 'eligible' });
  });
  it('uses actual failed attempts and moves to DLQ at the configured retry boundary', () => {
    expect(evaluateEmailPreflight({ ...pending, failedAttempts: 4 }).kind).toBe('eligible');
    expect(evaluateEmailPreflight({ ...pending, failedAttempts: 5 })).toEqual({ kind: 'retry_exhausted', reason: 'Max retries (5) exceeded (attempted 5 times)' });
  });
  it('preserves TTL precedence when both expiration and retries are exhausted', () => {
    expect(evaluateEmailPreflight({ ...pending, nowMs: pending.nowMs + 1, failedAttempts: 5 }).kind).toBe('expired');
  });
  it.each([undefined, null, '', 'not-a-date'])('preserves existing behavior for missing/malformed queued_at %s', (queuedAt) => {
    expect(evaluateEmailPreflight({ ...pending, queuedAt }).kind).toBe('eligible');
    expect(evaluateEmailPreflight({ ...pending, queuedAt, failedAttempts: 5 }).kind).toBe('retry_exhausted');
  });
});

describe('email queue failure policy', () => {
  it.each([0, 120])('retains explicit retry-after %s without increasing failed-attempt policy', (retryAfterSeconds) => {
    expect(classifyEmailFailure({ status: 429, retryAfterSeconds })).toEqual({ kind: 'rate_limited', retryAfterSeconds });
  });
  it.each([undefined, null])('defaults absent retry-after %s to sixty seconds', (retryAfterSeconds) => {
    expect(classifyEmailFailure({ status: 429, retryAfterSeconds })).toEqual({ kind: 'rate_limited', retryAfterSeconds: 60 });
  });
  it('routes structured forbidden responses to the disabled policy', () => {
    expect(classifyEmailFailure({ status: 403 })).toEqual({ kind: 'emails_disabled' });
  });
  it('gives structured status precedence over legacy error strings', () => {
    expect(classifyEmailFailure(Object.assign(new Error('429 403'), { status: 500 }))).toEqual({ kind: 'failed' });
    expect(classifyEmailFailure(Object.assign(new Error('429'), { status: 403 }))).toEqual({ kind: 'emails_disabled' });
  });
  it('supports legacy SDK errors and retains rate-limit precedence', () => {
    expect(classifyEmailFailure(new Error('HTTP 429; earlier 403'))).toEqual({ kind: 'rate_limited', retryAfterSeconds: 60 });
    expect(classifyEmailFailure(new Error('HTTP 403'))).toEqual({ kind: 'emails_disabled' });
  });
  it.each([null, undefined, '429', { status: '429' }, new Error('timeout')])('leaves ordinary/malformed errors on the existing failure path: %s', (error) => {
    expect(classifyEmailFailure(error)).toEqual({ kind: 'failed' });
  });
});

// The persisted status must satisfy the existing schema and must not enter the
// failed-attempt counter query, which selects status=failed.
it('records cooldown as pending metadata without consuming provider failure budget', () => {
  const failure = classifyEmailFailure({ status: 429, retryAfterSeconds: 90 });
  if (failure.kind !== 'rate_limited') throw new Error('Expected rate limiting');
  expect(rateLimitLogFields(failure.retryAfterSeconds)).toEqual({
    status: 'pending', metadata: { outcome: 'rate_limited', retry_after_seconds: 90 },
  });
});


describe('rate-limit persistence', () => {
  it.each(['returned', 'thrown'])('still persists cooldown when the audit error is %s', async mode => {
    const auditError = new Error('synthetic audit failure');
    let cooldownWrites = 0;
    const result = await persistEmailRateLimit(
      async () => { if (mode === 'thrown') throw auditError; return { error: auditError }; },
      async () => { cooldownWrites++; return { error: null }; },
    );
    expect(cooldownWrites).toBe(1);
    expect(result).toEqual({ auditError, cooldownError: null });
  });
  it('reports cooldown failure independently of successful audit', async () => {
    const cooldownError = new Error('synthetic cooldown failure');
    expect(await persistEmailRateLimit(async () => ({ error: null }), async () => { throw cooldownError; }))
      .toEqual({ auditError: null, cooldownError });
  });
  it('reports successful persistence', async () => {
    expect(await persistEmailRateLimit(async () => ({ error: null }), async () => ({ error: null })))
      .toEqual({ auditError: null, cooldownError: null });
  });
});
