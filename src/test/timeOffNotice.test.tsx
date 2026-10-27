import { describe, expect, it } from 'vitest';
import { noticeFor } from '@/lib/timeOffNotice';

describe('time off notice period', () => {
  it('asks foremen for 4 weeks', () => {
    expect(noticeFor('foreman')).toEqual({ days: 28, text: "Foremen are expected to give at least 4 weeks' notice" });
  });
  it('asks everyone else for 2 weeks', () => {
    for (const role of ['employee', 'office', 'admin', null] as const) {
      expect(noticeFor(role)).toEqual({ days: 14, text: "Employees are expected to give at least 2 weeks' notice" });
    }
  });
});
