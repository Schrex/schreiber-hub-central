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

// Highest role first, as useAuth reports `role`.
const signIn = (roles: Role[], previewRole: Role | null = null) => {
  const role = roles[0] ?? null;
  auth.value = {
    user: { id: 'synthetic-user' }, session: {}, roles, role, rolesLoaded: true, loading: false,
    previewRole, effectiveRole: role === 'admin' && previewRole ? previewRole : role,
    setPreviewRole: vi.fn(), displayName: 'Synthetic', positionTitle: null, signOut: vi.fn(),
  };
  render(<MemoryRouter><Index /></MemoryRouter>);
};
// Tile label + hint, so role badges and the preview switcher do not match.
const RESTRICTED = {
  Clearstory: 'CORs & RFIs', Tools: 'Calculators & utilities',
  HR: 'Reviews, pay, time off, contacts & new hires', Admin: 'Users & settings',
};
const shown = () => {
  const names = screen.getAllByRole('button').map((b) => b.textContent ?? '');
  return Object.entries(RESTRICTED).filter(([label, hint]) => names.includes(label + hint)).map(([label]) => label);
};

describe('home tiles', () => {
  it.each([
    [['employee'], []],
    [['foreman'], ['Clearstory', 'Tools']],
    [['office'], ['Tools']],
    [['admin'], ['Clearstory', 'Tools', 'HR', 'Admin']],
  ] as [Role[], string[]][])('%s sees restricted tiles %s', (roles, expected) => {
    signIn(roles);
    expect(shown()).toEqual(expected);
    expect(screen.getByText('Schedule')).toBeInTheDocument();
  });
  it('honours an admin preview', () => {
    signIn(['admin'], 'office');
    expect(shown()).toEqual(['Tools']);
  });
  it('shows tiles for any role held', () => {
    signIn(['office', 'foreman']);
    expect(shown()).toEqual(['Clearstory', 'Tools']);
  });
});
