import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

const { getSession, rolesQuery, positionsLte } = vi.hoisted(() => ({
  getSession: vi.fn(),
  rolesQuery: vi.fn(),
  positionsLte: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    getSession,
    signOut: vi.fn(),
  },
  from: (table: string) => {
    if (table === 'user_roles') return { select: () => ({ eq: rolesQuery }) };
    if (table === 'profiles') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { display_name: 'Synthetic Admin' } }) }) }) };
    return { select: () => ({ eq: () => ({ lte: (col: string, value: string) => {
      positionsLte(col, value);
      return { order: () => ({ limit: async () => ({ data: [] }) }) };
    } }) }) };
  },
} }));

const Probe = () => {
  const { session, loading, role, roles, rolesLoaded } = useAuth();
  return <output data-testid="auth">{JSON.stringify({ session: !!session, loading, role, roles, rolesLoaded })}</output>;
};
const state = () => JSON.parse(screen.getByTestId('auth').textContent ?? '{}');
const session = { user: { id: 'synthetic-admin' } };

beforeEach(() => { sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); getSession.mockReset(); rolesQuery.mockReset(); positionsLte.mockReset(); });

describe('auth readiness', () => {
  it('stays loading after the session is known until roles load, then exposes every role held', async () => {
    getSession.mockResolvedValue({ data: { session } });
    let finishRoles!: (value: { data: { role: string }[] }) => void;
    rolesQuery.mockReturnValue(new Promise(resolve => { finishRoles = resolve; }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(state()).toEqual({ session: true, loading: true, role: null, roles: [], rolesLoaded: false });
    await act(async () => { finishRoles({ data: [{ role: 'foreman' }, { role: 'admin' }] }); });
    expect(state()).toEqual({ session: true, loading: false, role: 'admin', roles: ['admin', 'foreman'], rolesLoaded: true });
  });

  it('is ready with no roles when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(state()).toEqual({ session: false, loading: false, role: null, roles: [], rolesLoaded: true });
  });

  it('becomes ready with no roles when the roles load fails', async () => {
    getSession.mockResolvedValue({ data: { session } });
    rolesQuery.mockRejectedValue(new Error('synthetic network failure'));
    render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(state()).toEqual({ session: true, loading: false, role: null, roles: [], rolesLoaded: true });
  });

  it('uses the New York business date for the current position, not UTC', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-28T02:30:00Z')); // 22:30 on Oct 27 in New York
    getSession.mockResolvedValue({ data: { session } });
    rolesQuery.mockResolvedValue({ data: [{ role: 'employee' }] });
    render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(positionsLte).toHaveBeenCalledWith('effective_date', '2026-10-27');
  });
});
