import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
beforeEach(() => sessionStorage.clear());
afterEach(() => { cleanup(); rolesQuery.mockReset(); sessionStorage.clear(); });

const renderAdminRoute = () => render(
  <AuthProvider>
    <MemoryRouter initialEntries={['/admin/users']}>
      <Routes>
        <Route path="/" element={<p>Home page</p>} />
        <Route path="/admin/users" element={<ProtectedRoute requireAction="admin.open"><p>Admin page</p></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>
  </AuthProvider>,
);

describe('admin route on direct open', () => {
  it('waits for roles, then shows the admin page instead of redirecting home', async () => {
    let finishRoles!: (value: { data: { role: string }[] }) => void;
    rolesQuery.mockReturnValue(new Promise(resolve => { finishRoles = resolve; }));
    renderAdminRoute();
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText('Home page')).toBeNull();
    expect(screen.getByText('Loading…')).toBeVisible();
    await act(async () => { finishRoles({ data: [{ role: 'foreman' }, { role: 'admin' }] }); });
    expect(screen.getByText('Admin page')).toBeVisible();
  });

  it('redirects an admin previewing as employee', async () => {
    sessionStorage.setItem('previewRole', 'employee');
    rolesQuery.mockResolvedValue({ data: [{ role: 'admin' }] });
    renderAdminRoute();
    expect(await screen.findByText('Home page')).toBeVisible();
    expect(screen.queryByText('Admin page')).toBeNull();
  });

  it('redirects a non-admin once roles load', async () => {
    rolesQuery.mockResolvedValue({ data: [{ role: 'office' }] });
    renderAdminRoute();
    expect(await screen.findByText('Home page')).toBeVisible();
  });
});
