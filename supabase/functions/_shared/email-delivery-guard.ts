export interface DeliveryGuardLookup {
  suppression(email: string): Promise<{ data: { reason: string } | null; error: unknown }>;
  unsubscribe(email: string): Promise<{ data: { used_at: string | null } | null; error: unknown }>;
}
export type DeliveryGuardResult =
  | { kind: 'allow' }
  | { kind: 'defer'; reason: 'invalid_recipient' | 'unknown_queue' | 'lookup_failed' }
  | { kind: 'suppress'; reason: 'recipient_suppressed' | 'recipient_unsubscribed' };

/** Fail closed on unavailable state; never treats lookup failure as provider failure. */
export async function checkEmailDelivery(
  queue: string, recipient: unknown, lookup: DeliveryGuardLookup,
): Promise<DeliveryGuardResult> {
  if (queue !== 'auth_emails' && queue !== 'transactional_emails') return { kind: 'defer', reason: 'unknown_queue' };
  if (typeof recipient !== 'string' || !/^[^\s<>,;@]+@[^\s<>,;@]+\.[^\s<>,;@]+$/.test(recipient)) {
    return { kind: 'defer', reason: 'invalid_recipient' };
  }
  const email = recipient.toLowerCase();
  try {
    const suppression = await lookup.suppression(email);
    if (suppression.error) return { kind: 'defer', reason: 'lookup_failed' };
    // Marketing unsubscribe must not block password reset/access mail. Hard bounce,
    // complaint and unknown suppression reasons remain blocking for either queue.
    if (suppression.data && (queue === 'transactional_emails' || suppression.data.reason !== 'unsubscribe')) {
      return { kind: 'suppress', reason: 'recipient_suppressed' };
    }
    if (queue === 'transactional_emails') {
      const unsubscribe = await lookup.unsubscribe(email);
      if (unsubscribe.error) return { kind: 'defer', reason: 'lookup_failed' };
      if (unsubscribe.data?.used_at) return { kind: 'suppress', reason: 'recipient_unsubscribed' };
    }
    return { kind: 'allow' };
  } catch {
    return { kind: 'defer', reason: 'lookup_failed' };
  }
}
