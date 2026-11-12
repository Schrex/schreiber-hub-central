import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAILY_SCHEDULE_URL, ScheduleEntry } from '@/components/schedule/ScheduleEntry';
import { schedulePageParked } from '@/lib/launchScope';

vi.mock('@/pages/Schedule', () => ({ default: () => <p>old schedule page</p> }));
vi.mock('@/components/ProtectedRoute', () => ({ ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const replace = vi.fn();
const original = window.location;
beforeEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: { ...original, replace } });
});
afterEach(() => {
  cleanup();
  replace.mockReset();
  Object.defineProperty(window, 'location', { configurable: true, value: original });
});

const renderAt = (parked?: boolean) => render(
  <MemoryRouter initialEntries={['/schedule']}>
    <Routes><Route path="/schedule" element={parked === undefined ? <ScheduleEntry /> : <ScheduleEntry parked={parked} />} /></Routes>
  </MemoryRouter>,
);

describe('/schedule (#99)', () => {
  it('the old Schedule page is parked in this build', () => {
    expect(schedulePageParked).toBe(true);
  });
  it('replaces the page with the Daily Schedule by a real page load', () => {
    renderAt();
    expect(replace).toHaveBeenCalledWith(DAILY_SCHEDULE_URL);
    expect(DAILY_SCHEDULE_URL).toBe('/daily-schedule/');
    expect(screen.getByText('Opening the Daily Schedule…')).toBeInTheDocument();
    expect(screen.queryByText('old schedule page')).toBeNull();
  });
  it('shows the old Schedule page again when the switch is turned back on', () => {
    renderAt(false);
    expect(screen.getByText('old schedule page')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
