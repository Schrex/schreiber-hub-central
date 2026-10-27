import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@/hooks/useAuth';
import Index from '@/pages/Index';

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth.value }));
vi.mock('@/components/home/WeatherStrip', () => ({ WeatherStrip: () => null }));
vi.mock('@/components/home/CelebrationsBanner', () => ({ CelebrationsBanner: () => null }));
afterEach(cleanup);

const signIn = (roles: Role[], previewRole: Role | null = null) => {
  const role = roles[0] ?? null;
  auth.value = {
    user: { id: 'synthetic-user' }, session: {}, roles, role, rolesLoaded: true, loading: false,
    previewRole, effectiveRole: role === 'admin' && previewRole ? previewRole : role,
    setPreviewRole: vi.fn(), displayName: 'Synthetic', positionTitle: null, signOut: vi.fn(),
  };
  render(<MemoryRouter><Index /></MemoryRouter>);
};

describe('home role switcher', () => {
  it('stays visible to an admin previewing as employee, so they can exit preview', () => {
    signIn(['admin'], 'employee');
    expect(screen.getByText('Preview as role')).toBeVisible();
    expect(screen.queryByText('HR')).toBeNull();
  });
  it('is hidden from non-admins', () => {
    signIn(['office', 'foreman']);
    expect(screen.queryByText('Preview as role')).toBeNull();
  });
  it('is hidden until roles load', () => {
    signIn(['admin']);
    auth.value = { ...auth.value, rolesLoaded: false, loading: true };
    cleanup();
    render(<MemoryRouter><Index /></MemoryRouter>);
    expect(screen.queryByText('Preview as role')).toBeNull();
  });
});
