import { describe, expect, it, vi } from 'vitest';
import { checkEmailDelivery } from '../../supabase/functions/_shared/email-delivery-guard';
function lookups(reason: string | null = null, used_at: string | null = null) {
  return {
    suppression: vi.fn(async () => ({ data: reason ? { reason } : null, error: null })),
    unsubscribe: vi.fn(async () => ({ data: used_at ? { used_at } : null, error: null })),
  };
}
describe('delivery-time suppression', () => {
  it('checks normalized current state for transactional mail even after enqueue', async () => {
    const lookup = lookups();
    expect(await checkEmailDelivery('transactional_emails', 'Employee@Example.test', lookup)).toEqual({ kind: 'allow' });
    expect(lookup.suppression).toHaveBeenCalledWith('employee@example.test');
    expect(lookup.unsubscribe).toHaveBeenCalledWith('employee@example.test');
  });
  it.each(['bounce', 'complaint', 'unsubscribe', 'unknown'])('suppresses transactional messages for %s', async (reason) => {
    expect((await checkEmailDelivery('transactional_emails', 'a@example.test', lookups(reason))).kind).toBe('suppress');
  });
  it('blocks used tokens when a previous suppression write failed', async () => {
    expect(await checkEmailDelivery('transactional_emails', 'a@example.test', lookups(null, '2026-01-01'))).toEqual({ kind: 'suppress', reason: 'recipient_unsubscribed' });
  });
  it('allows Auth access mail despite unsubscribe without reading marketing tokens', async () => {
    const lookup = lookups('unsubscribe', '2026-01-01');
    expect(await checkEmailDelivery('auth_emails', 'a@example.test', lookup)).toEqual({ kind: 'allow' });
    expect(lookup.unsubscribe).not.toHaveBeenCalled();
  });
  it.each(['bounce', 'complaint', 'unknown'])('blocks Auth mail for %s suppression', async (reason) => {
    expect((await checkEmailDelivery('auth_emails', 'a@example.test', lookups(reason))).kind).toBe('suppress');
  });
  it.each(['suppression', 'unsubscribe'] as const)('defers on %s read errors without provider-failure outcome', async (field) => {
    const lookup = lookups();
    lookup[field].mockResolvedValue({ data: null, error: new Error('synthetic private detail') });
    expect(await checkEmailDelivery('transactional_emails', 'a@example.test', lookup)).toEqual({ kind: 'defer', reason: 'lookup_failed' });
  });
  it('fails closed on thrown lookups', async () => {
    const lookup = lookups(); lookup.suppression.mockRejectedValue(new Error('private detail'));
    expect(await checkEmailDelivery('auth_emails', 'a@example.test', lookup)).toEqual({ kind: 'defer', reason: 'lookup_failed' });
  });
  it.each([undefined, 'a@example.test,b@example.test', 'Name <a@example.test>', 'a@example.test\n'])('defers malformed or multi-recipient %s before any lookup', async (recipient) => {
    const lookup = lookups();
    expect(await checkEmailDelivery('auth_emails', recipient, lookup)).toEqual({ kind: 'defer', reason: 'invalid_recipient' });
    expect(lookup.suppression).not.toHaveBeenCalled();
  });
  it('does not silently treat unknown queues as Auth', async () => {
    expect(await checkEmailDelivery('other', 'a@example.test', lookups())).toEqual({ kind: 'defer', reason: 'unknown_queue' });
  });
});
