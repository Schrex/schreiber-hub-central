import { describe, expect, it } from 'vitest';
import { notificationResult } from '../../supabase/functions/_shared/notification-result';

describe('workflow notification queue evidence', () => {
  it('accepts explicit queue acceptance without claiming delivery', () => {
    expect(notificationResult({ success: true, queued: true }, null)).toBe('queued');
  });
  it.each([
    [{ success: true, queued: true }, new Error('function failed')],
    [{ success: false, reason: 'email_suppressed' }, null],
    [{ success: true }, null],
    [{ error: 'Failed to enqueue email' }, null],
    [null, null],
  ])('does not disguise suppressed, rejected or uncertain enqueue as success', (data, error) => {
    expect(notificationResult(data, error)).toBe('failed');
  });
});
