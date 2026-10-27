import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const { rolesQuery } = vi.hoisted(() => ({ rolesQuery: vi.fn() }));
vi.mock('@/components/BottomNav', () => ({ BottomNav: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    getSession: async () => ({ data: { session: { user: { id: 'synthetic-admin' } } } }),
    signOut: vi.fn(),
  },
  from: (table: string) => {
    if (table === 'user_roles') return { select: () => ({ eq: rolesQuery }) };
    if (table === 'profiles') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    return { select: () => ({ eq: () => ({ lte: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) }) };
  },
} }));
afterEach(() => { cleanup(); rolesQuery.mockReset(); });

describe('admin route on direct open', () => {
  it('waits for roles, then shows the admin page instead of redirecting home', async () => {
    let finishRoles!: (value: { data: { role: string }[] }) => void;
    rolesQuery.mockReturnValue(new Promise(resolve => { finishRoles = resolve; }));
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin/users']}>
          <Routes>
            <Route path="/" element={<p>Home page</p>} />
            <Route path="/admin/users" element={<ProtectedRoute requireRole="admin"><p>Admin page</p></ProtectedRoute>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText('Home page')).toBeNull();
    expect(screen.getByText('Loading…')).toBeVisible();
    await act(async () => { finishRoles({ data: [{ role: 'foreman' }, { role: 'admin' }] }); });
    expect(screen.getByText('Admin page')).toBeVisible();
  });
});
