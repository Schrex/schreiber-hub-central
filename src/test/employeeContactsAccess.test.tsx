import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EmployeeContacts from '@/pages/EmployeeContacts';

const mocks = vi.hoisted(() => ({
  role: 'office' as string,
  toast: vi.fn(),
  writeResult: { data: [] as unknown[] | null, error: null as unknown },
  writes: [] as string[],
}));

const contact = {
  id: 'synthetic-contact', name: 'Sam Synthetic', first_name: 'Sam', last_name: 'Synthetic', middle_initial: null,
  job_title: null, department: null, phone: null, email: null, work_email: null, personal_email: null,
  address: null, notes: null, is_active: true, converted_user_id: null, manager_contact_id: null,
};

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ role: mocks.role, effectiveRole: mocks.role, user: { id: 'synthetic-user' } }),
}));
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }));
vi.mock('@/lib/currentPositions', () => ({ fetchCurrentPositions: async () => new Map() }));
vi.mock('@/components/BottomNav', () => ({ BottomNav: () => null }));
vi.mock('@/components/AddEmployeeWizard', () => ({ AddEmployeeWizard: () => null }));
vi.mock('@/integrations/supabase/client', () => {
  const write = (kind: string) => {
    const chain = {
      eq: () => chain,
      select: () => { mocks.writes.push(kind); return Promise.resolve(mocks.writeResult); },
      then: (resolve: (v: unknown) => unknown) => { mocks.writes.push(kind); return Promise.resolve({ data: null, error: null }).then(resolve); },
    };
    return chain;
  };
  const read = { select: () => read, eq: () => read, order: () => read, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r) };
  return { supabase: {
    rpc: async () => ({ data: [contact], error: null }),
    from: () => ({ ...read, update: () => write('update'), delete: () => write('delete') }),
  } };
});

const renderPage = () => render(<MemoryRouter><EmployeeContacts /></MemoryRouter>);
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.writes.length = 0; mocks.writeResult = { data: [], error: null }; });

describe('Employee Contacts access', () => {
  it.each([['foreman', false], ['employee', false], ['office', true], ['admin', true]])(
    '%s sees edit and delete controls: %s',
    async (role, visible) => {
      mocks.role = role;
      renderPage();
      await screen.findByText('Sam Synthetic');
      expect(screen.queryByRole('button', { name: 'Edit' }) !== null).toBe(visible);
      expect(screen.queryByRole('button', { name: 'Delete' }) !== null).toBe(visible);
    },
  );

  it('reports an update that changes 0 rows as a failure, not success', async () => {
    mocks.role = 'office';
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Save failed', description: "You don't have permission to make this change.", variant: 'destructive',
    })));
    expect(mocks.writes).toEqual(['update']);
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Contact updated' }));
  });

  it('reports an update that changes a row as success', async () => {
    mocks.role = 'office';
    mocks.writeResult = { data: [{ id: contact.id }], error: null };
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Contact updated' })));
  });

  it('reports a delete that changes 0 rows as a failure, not success', async () => {
    mocks.role = 'admin';
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Delete failed', description: "You don't have permission to make this change.", variant: 'destructive',
    })));
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Contact deleted' }));
  });
});
