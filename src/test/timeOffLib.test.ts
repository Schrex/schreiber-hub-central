import { describe, expect, it } from 'vitest';
import { findConflicts, noticeDaysFromNow, renderRange, timeOffFormSchema, type TimeOffRequest } from '@/lib/timeOff';

const req = (over: Partial<TimeOffRequest>): TimeOffRequest => ({
  id: 'r', user_id: 'u', requester_name: null, type: 'vacation', start_date: '2030-06-10',
  end_date: '2030-06-10', half_day: 'none', reason: null, status: 'pending', denial_reason: null,
  decided_at: null, invites_sent_at: null, created_at: '2030-01-01T00:00:00Z', ...over,
});

describe('renderRange', () => {
  it('formats a single day with its half', () => {
    expect(renderRange(req({ half_day: 'pm' }))).toBe('Mon, Jun 10, 2030 · PM half');
  });
  it('formats a range with its calendar-day count (unchanged by T03)', () => {
    expect(renderRange(req({ end_date: '2030-06-16' }))).toBe('Jun 10 → Jun 16, 2030 · 7 days');
  });
});

describe('findConflicts', () => {
  it("returns other people's approved overlapping requests only", () => {
    const target = req({ id: 't', user_id: 'a', end_date: '2030-06-12' });
    const items = [
      target,
      req({ id: 'hit', user_id: 'b', status: 'approved', start_date: '2030-06-12', end_date: '2030-06-20' }),
      req({ id: 'same-user', user_id: 'a', status: 'approved' }),
      req({ id: 'pending', user_id: 'c' }),
      req({ id: 'after', user_id: 'd', status: 'approved', start_date: '2030-06-13', end_date: '2030-06-13' }),
    ];
    expect(findConflicts(items, target).map((r) => r.id)).toEqual(['hit']);
  });
});

describe('noticeDaysFromNow', () => {
  it('counts whole local days from today', () => {
    const now = new Date(2030, 5, 10, 23, 59);
    expect(noticeDaysFromNow(new Date(2030, 5, 24, 0, 1), now)).toBe(14);
    expect(noticeDaysFromNow(new Date(2030, 5, 10, 8), now)).toBe(0);
  });
});

describe('timeOffFormSchema', () => {
  it('rejects a half day on a multi-day request', () => {
    const r = timeOffFormSchema.safeParse({
      type: 'vacation', start_date: new Date(2030, 5, 10), end_date: new Date(2030, 5, 11), half_day: 'am', reason: '',
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('Half-day applies to single-day requests only');
  });
});
