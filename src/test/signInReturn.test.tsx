import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Auth from '@/pages/Auth';

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const signedOut = { session: null, user: null, roles: [], previewRole: null, rolesLoaded: true, loading: false };
const signedIn = {
  session: { user: { id: 'synthetic-admin' } }, user: { id: 'synthetic-admin' },
  roles: ['admin'], previewRole: null, rolesLoaded: true, loading: false,
};
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth.value }));
vi.mock('@/components/BottomNav', () => ({ BottomNav: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {} } }));
afterEach(() => cleanup());

const Where = () => { const l = useLocation(); return <p data-testid="where">{l.pathname + l.search}</p>; };
const app = (entry: string) => (
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/" element={<p>Home page</p>} />
      <Route path="/auth" element={<><Auth /><Where /></>} />
      <Route path="/time-off" element={<ProtectedRoute><p>Time off page</p><Where /></ProtectedRoute>} />
    </Routes>
  </MemoryRouter>
);

describe('sign-in keeps the requested link', () => {
  it('sends a signed-out user to sign-in with the path and query, then returns there', async () => {
    auth.value = signedOut;
    const view = render(app('/time-off?request=abc-123'));
    expect(screen.getByTestId('where')).toHaveTextContent('/auth?next=%2Ftime-off%3Frequest%3Dabc-123');
    auth.value = signedIn;
    view.rerender(app('/time-off?request=abc-123'));
    expect(await screen.findByText('Time off page')).toBeVisible();
    expect(screen.getByTestId('where')).toHaveTextContent('/time-off?request=abc-123');
  });

  it('refuses an outside target after sign-in and goes home', async () => {
    auth.value = signedIn;
    render(app('/auth?next=%2F%2Fevil.example.test%2Ftime-off'));
    expect(await screen.findByText('Home page')).toBeVisible();
  });
});
