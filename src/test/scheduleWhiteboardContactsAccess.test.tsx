import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Schedule from '@/pages/Schedule';
import Whiteboard from '@/pages/Whiteboard';
import EmployeeContacts from '@/pages/EmployeeContacts';

type R = 'employee' | 'foreman' | 'office' | 'admin';
const auth = vi.hoisted(() => ({
  roles: [] as R[], previewRole: null as R | null, rolesLoaded: true,
}));

const contact = {
  id: 'synthetic-contact', name: 'Sam Synthetic', first_name: 'Sam', last_name: 'Synthetic', middle_initial: null,
  job_title: null, department: null, phone: null, email: null, work_email: null, personal_email: null,
  address: null, notes: null, is_active: true, converted_user_id: null, manager_contact_id: null,
};

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => {
    const role = auth.rolesLoaded ? auth.roles[0] ?? null : null;
    const effectiveRole = auth.previewRole && auth.roles.includes('admin') ? auth.previewRole : role;
    return {
      user: { id: 'synthetic-user' }, displayName: 'Synthetic', role, effectiveRole,
      roles: auth.rolesLoaded ? auth.roles : [], previewRole: auth.previewRole, rolesLoaded: auth.rolesLoaded,
      loading: !auth.rolesLoaded,
    };
  },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/hooks/useResumeRefresh', () => ({ useResumeRefresh: () => undefined }));
vi.mock('@/lib/currentPositions', () => ({ fetchCurrentPositions: async () => new Map() }));
vi.mock('@/components/BottomNav', () => ({ BottomNav: () => null }));
vi.mock('@/components/AddEmployeeWizard', () => ({ AddEmployeeWizard: () => null }));
vi.mock('@/integrations/supabase/client', () => {
  // Any query chain resolves to an empty result.
  const chain: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(chain, {
    get: (_t, key) => key === 'then'
      ? (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve)
      : () => proxy,
  });
  const channel = { on: () => channel, subscribe: () => channel };
  return { supabase: {
    from: () => proxy,
    rpc: async (name: string) => ({ data: name === 'list_employee_directory' ? [contact] : [], error: null }),
    channel: () => channel,
    removeChannel: () => undefined,
    functions: { invoke: async () => ({ data: null, error: null }) },
  } };
});

const as = (roles: R[], previewRole: R | null = null, rolesLoaded = true) => {
  Object.assign(auth, { roles, previewRole, rolesLoaded });
};
const DENIED = "You don't have access to the planning whiteboard.";
const page = (el: JSX.Element) => render(<MemoryRouter>{el}</MemoryRouter>);
afterEach(() => { cleanup(); as([]); });

describe('Whiteboard access', () => {
  it.each<[R[], R | null, boolean]>([
    [['employee'], null, false],
    [['foreman'], null, true],
    [['office'], null, true],
    [['admin'], null, true],
    [['admin'], 'employee', false],
    [['office', 'employee'], null, true],
  ])('roles %j previewing %s may use the board: %s', async (roles, preview, allowed) => {
    as(roles, preview);
    page(<Whiteboard />);
    await waitFor(() => expect(screen.queryByText(DENIED) === null).toBe(allowed));
  });
  // Before roles load, ProtectedRoute renders nothing (ProtectedRouteReady.test.tsx).
});

describe('Schedule access', () => {
  it.each<[R[], R | null, boolean, boolean]>([
    [['employee'], null, false, false],
    [['foreman'], null, true, false],
    [['office'], null, true, true],
    [['admin'], 'foreman', true, false],
    [['foreman', 'office'], null, true, true],
  ])('roles %j previewing %s: whiteboard link %s, crew edit %s', async (roles, preview, board, edit) => {
    as(roles, preview);
    page(<Schedule />);
    await screen.findByText('Crews assigned to jobs');
    expect(screen.queryByRole('button', { name: 'Whiteboard' }) !== null).toBe(board);
    // The day/week/board view switch is shown only to crew editors.
    expect(screen.queryByRole('button', { name: /^week$/i }) !== null).toBe(edit);
  });
});

describe('Employee Contacts access', () => {
  it.each<[R[], R | null, boolean]>([
    [['admin'], 'foreman', false],
    [['admin'], 'office', true],
    [['foreman', 'office'], null, true],
  ])('roles %j previewing %s sees edit and delete: %s', async (roles, preview, visible) => {
    as(roles, preview);
    page(<EmployeeContacts />);
    await screen.findByText('Sam Synthetic');
    expect(screen.queryByRole('button', { name: 'Edit' }) !== null).toBe(visible);
    expect(screen.queryByRole('button', { name: 'Delete' }) !== null).toBe(visible);
  });
});
