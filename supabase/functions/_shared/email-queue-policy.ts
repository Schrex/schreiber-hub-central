/** Queue policy and persistence coordination; no provider delivery. */
export type EmailFailurePolicy =
  | { kind: 'rate_limited'; retryAfterSeconds: number }
  | { kind: 'emails_disabled' }
  | { kind: 'failed' };

function hasStatus(error: unknown, status: number): boolean {
  // A structured status takes precedence over legacy message matching, even when
  // malformed. This preserves the worker's existing provider compatibility.
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: unknown }).status === status;
  }
  return error instanceof Error && error.message.includes(String(status));
}

export function classifyEmailFailure(error: unknown): EmailFailurePolicy {
  if (hasStatus(error, 429)) {
    const retryAfterSeconds = error && typeof error === 'object' && 'retryAfterSeconds' in error
      ? (error as { retryAfterSeconds: number | null }).retryAfterSeconds ?? 60
      : 60;
    return { kind: 'rate_limited', retryAfterSeconds };
  }
  if (hasStatus(error, 403)) return { kind: 'emails_disabled' };
  return { kind: 'failed' };
}

export type EmailPreflight =
  | { kind: 'expired'; reason: string }
  | { kind: 'retry_exhausted'; reason: string }
  | { kind: 'eligible' };

export function evaluateEmailPreflight(input: {
  queuedAt: string | null | undefined;
  nowMs: number;
  ttlMinutes: number;
  failedAttempts: number;
  maxRetries: number;
}): EmailPreflight {
  // Strict >, invalid date handling, and TTL-before-retries order intentionally
  // match the worker; validation changes need a separate behavioral review.
  if (input.queuedAt && input.nowMs - new Date(input.queuedAt).getTime() > input.ttlMinutes * 60 * 1000) {
    return { kind: 'expired', reason: `TTL exceeded (${input.ttlMinutes} minutes)` };
  }
  if (input.failedAttempts >= input.maxRetries) {
    return {
      kind: 'retry_exhausted',
      reason: `Max retries (${input.maxRetries}) exceeded (attempted ${input.failedAttempts} times)`,
    };
  }
  return { kind: 'eligible' };
}

/** Existing schema allows pending, not rate_limited; keep provider failures separate. */
export function rateLimitLogFields(retryAfterSeconds: number) {
  return { status: 'pending' as const, metadata: { outcome: 'rate_limited', retry_after_seconds: retryAfterSeconds } };
}

/** Attempt both writes independently: an audit failure must not bypass cooldown. */
export async function persistEmailRateLimit(
  writeAudit: () => PromiseLike<{ error: unknown }>,
  writeCooldown: () => PromiseLike<{ error: unknown }>,
): Promise<{ auditError: unknown; cooldownError: unknown }> {
  const [audit, cooldown] = await Promise.allSettled([
    Promise.resolve().then(writeAudit),
    Promise.resolve().then(writeCooldown),
  ]);
  return {
    auditError: audit.status === 'fulfilled' ? audit.value.error : audit.reason,
    cooldownError: cooldown.status === 'fulfilled' ? cooldown.value.error : cooldown.reason,
  };
}
