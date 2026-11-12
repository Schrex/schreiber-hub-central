import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@/hooks/useAuth';
import TimeOffPage from '@/pages/TimeOff';

/**
 * Characterization of the Time Off page (#64 / T03): the page is split into components
 * without any visible or behavioural change. Synthetic rows only.
 */

type Row = Record<string, unknown>;

const db = vi.hoisted(() => ({
  rows: [] as Row[],
  updates: [] as { values: Row; id: unknown }[],
  inserts: [] as Row[],
  invokes: [] as unknown[],
}));

vi.mock('@/integrations/supabase/client', () => {
  const ok = (data: unknown) => Promise.resolve({ data, error: null });
  const from = (table: string) => {
    if (table === 'time_off_requests') {
      return {
        select: () => ({ order: () => ok(db.rows) }),
        insert: (values: Row) => { db.inserts.push(values); return ok(null); },
        update: (values: Row) => ({ eq: (_col: string, id: unknown) => { db.updates.push({ values, id }); return ok(null); } }),
      };
    }
    // Team-notification lookups after an approval: no recipients.
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'in', 'eq', 'is']) chain[m] = () => chain;
    (chain as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
    return chain;
  };
  return { supabase: { from, functions: { invoke: (...args: unknown[]) => { db.invokes.push(args); return ok(null); } } } };
});

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth.value }));

const ME = 'synthetic-me';
const req = (over: Row): Row => ({
  id: 'r1', user_id: ME, requester_name: 'Synthetic Me', type: 'vacation',
  start_date: '2030-06-10', end_date: '2030-06-12', half_day: 'none', reason: null,
  status: 'pending', denial_reason: null, decided_at: null, invites_sent_at: null,
  created_at: '2030-01-01T00:00:00Z', ...over,
});

const renderPage = (roles: Role[]) => {
  const role = roles[0] ?? null;
  auth.value = {
    user: { id: ME }, session: {}, roles, role, rolesLoaded: true, loading: false,
    previewRole: null, effectiveRole: role, setPreviewRole: vi.fn(),
    displayName: 'Synthetic Me', positionTitle: null, signOut: vi.fn(),
  };
  render(<MemoryRouter><TimeOffPage /></MemoryRouter>);
};

const card = (text: string) => screen.getByText(text).closest('div.rounded-xl') as HTMLElement;

beforeEach(() => {
  db.rows = []; db.updates = []; db.inserts = []; db.invokes = [];
  toast.success.mockReset(); toast.error.mockReset();
});
afterEach(cleanup);

describe('Time Off page — employee', () => {
  it('shows only the My Requests tab and an empty state', async () => {
    renderPage(['employee']);
    expect(await screen.findByText('No requests yet — tap "Request" to submit one.')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['My Requests']);
  });

  it('renders own request cards with type, range, status, reason and denial reason', async () => {
    db.rows = [
      req({ id: 'a', reason: 'synthetic trip' }),
      req({ id: 'b', type: 'sick', start_date: '2030-07-01', end_date: '2030-07-01', half_day: 'am', status: 'denied', denial_reason: 'busy week' }),
      req({ id: 'c', user_id: 'someone-else', reason: 'not mine' }),
    ];
    renderPage(['employee']);
    const trip = card(await screen.findByText('synthetic trip').then((n) => n.textContent!));
    expect(within(trip).getByText('Vacation')).toBeInTheDocument();
    expect(within(trip).getByText('Jun 10 → Jun 12, 2030 · 3 days')).toBeInTheDocument();
    expect(within(trip).getByText('pending')).toBeInTheDocument();
    expect(within(trip).getByRole('button', { name: 'Cancel request' })).toBeInTheDocument();
    const sick = card('Sick');
    expect(within(sick).getByText('Mon, Jul 1, 2030 · AM half')).toBeInTheDocument();
    expect(within(sick).getByText('Reason: busy week')).toBeInTheDocument();
    expect(within(sick).queryByRole('button', { name: 'Cancel request' })).toBeNull();
    expect(screen.queryByText('not mine')).toBeNull();
  });

  it('cancels a pending request and reloads', async () => {
    db.rows = [req({ id: 'a', reason: 'synthetic trip' })];
    renderPage(['employee']);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel request' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Cancelled'));
    expect(db.updates).toEqual([{ values: { status: 'cancelled' }, id: 'a' }]);
  });

  it('asks for dates before submitting', async () => {
    renderPage(['employee']);
    fireEvent.click(screen.getByRole('button', { name: 'Request' }));
    const dialog = await screen.findByRole('dialog', { name: 'New time off request' });
    expect(within(dialog).getAllByRole('button', { name: 'Pick' })).toHaveLength(2);
    expect(within(dialog).getByPlaceholderText('e.g. family vacation')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit request' }));
    expect(toast.error).toHaveBeenCalledWith('Pick start and end dates');
    expect(db.inserts).toEqual([]);
  });

  it('warns about short notice for a vacation starting today, then submits anyway', async () => {
    renderPage(['employee']);
    fireEvent.click(screen.getByRole('button', { name: 'Request' }));
    const dialog = await screen.findByRole('dialog', { name: 'New time off request' });
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Pick' })[0]);
    const today = new Date();
    const grid = await screen.findByRole('grid');
    const day = within(grid).getAllByRole('gridcell', { name: String(today.getDate()) })
      .find((c) => !c.className.includes('outside') && !c.className.includes('day_outside')) ?? within(grid).getAllByRole('gridcell', { name: String(today.getDate()) })[0];
    fireEvent.click(day);
    fireEvent.change(within(dialog).getByPlaceholderText('e.g. family vacation'), { target: { value: 'synthetic short' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit request' }));
    const warn = await screen.findByRole('alertdialog', { name: /Short notice/ });
    expect(within(warn).getByText(/Employees are expected to give at least 2 weeks' notice for vacation and personal days\. This request starts in 0 days\./)).toBeInTheDocument();
    fireEvent.click(within(warn).getByRole('button', { name: 'Submit anyway' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Request submitted'));
    const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(db.inserts).toEqual([{
      user_id: ME, requester_name: 'Synthetic Me', type: 'vacation',
      start_date: ymd, end_date: ymd, half_day: 'none', reason: 'synthetic short',
    }]);
  });
});

describe('Time Off page — admin', () => {
  const rows = () => [
    req({ id: 'p1', user_id: 'u-a', requester_name: 'Synthetic A', reason: 'beach' }),
    req({ id: 'p2', user_id: 'u-b', requester_name: 'Synthetic B', start_date: '2031-01-05', end_date: '2031-01-05' }),
    req({ id: 'x1', user_id: 'u-c', requester_name: 'Synthetic C', status: 'approved', start_date: '2030-06-11', end_date: '2030-06-11', invites_sent_at: '2030-05-01T15:30:00Z' }),
  ];

  it('opens on Approvals with a pending count, cards and an overlap warning', async () => {
    db.rows = rows();
    renderPage(['admin']);
    const a = card(await screen.findByText('Synthetic A').then((n) => n.textContent!));
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Approvals 2', 'My Requests', 'Approved']);
    expect(within(a).getByText('Vacation · Jun 10 → Jun 12, 2030 · 3 days')).toBeInTheDocument();
    expect(within(a).getByText('beach')).toBeInTheDocument();
    expect(a.textContent).toContain('1 overlap: Synthetic C');
    expect(card('Synthetic B').textContent).not.toContain('overlap');
  });

  it('approves a request without conflicts directly', async () => {
    db.rows = rows();
    renderPage(['admin']);
    const b = card(await screen.findByText('Synthetic B').then((n) => n.textContent!));
    fireEvent.click(within(b).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Approved'));
    expect(db.updates).toHaveLength(1);
    expect(db.updates[0].id).toBe('p2');
    expect(db.updates[0].values).toMatchObject({ status: 'approved', decided_by: ME, denial_reason: null });
  });

  it('confirms before approving a conflicting request', async () => {
    db.rows = rows();
    renderPage(['admin']);
    const a = card(await screen.findByText('Synthetic A').then((n) => n.textContent!));
    fireEvent.click(within(a).getByRole('button', { name: 'Approve' }));
    const confirm = await screen.findByRole('alertdialog', { name: /Conflict on these dates/ });
    expect(confirm.textContent).toContain('Synthetic C — Tue, Jun 11, 2030');
    expect(db.updates).toEqual([]);
    fireEvent.click(within(confirm).getByRole('button', { name: 'Approve anyway' }));
    await waitFor(() => expect(db.updates.map((u) => u.id)).toEqual(['p1']));
  });

  it('denies with an optional note', async () => {
    db.rows = rows();
    renderPage(['admin']);
    const b = card(await screen.findByText('Synthetic B').then((n) => n.textContent!));
    fireEvent.click(within(b).getByRole('button', { name: 'Deny' }));
    const dialog = await screen.findByRole('dialog', { name: 'Deny request' });
    expect(within(dialog).getByText('Denying Synthetic B for Sun, Jan 5, 2031.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText('Optional note for the employee'), { target: { value: ' crew short ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deny request' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Denied'));
    expect(db.updates[0].id).toBe('p2');
    expect(db.updates[0].values).toMatchObject({ status: 'denied', decided_by: ME, denial_reason: 'crew short' });
  });

  it('lists approved requests with the invites line', async () => {
    db.rows = rows();
    renderPage(['admin']);
    await screen.findByText('Synthetic A');
    const approvedTab = screen.getByRole('tab', { name: 'Approved' });
    fireEvent.mouseDown(approvedTab);
    fireEvent.click(approvedTab);
    const panel = await screen.findByRole('tabpanel', { name: 'Approved' });
    const c = within(panel).getByText('Synthetic C').closest('div.rounded-xl') as HTMLElement;
    expect(within(c).getByText('Vacation · Tue, Jun 11, 2030')).toBeInTheDocument();
    expect(within(c).getByText('approved')).toBeInTheDocument();
    expect(within(c).getByText(/^Invites sent May 1, /)).toBeInTheDocument();
  });
});
