import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TruckRequestsPanel } from '@/components/dispatch/TruckRequestsPanel';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: mocks.error, success: mocks.success, warning: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => {
  const query = { select: () => query, eq: () => query, order: () => query,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [{ id: 'synthetic-request', requested_date: '2026-10-21', status: 'pending', jobs: { name: 'Synthetic job' } }], error: null }).then(resolve) };
  const channel = { on: () => channel, subscribe: () => channel };
  return { supabase: { from: () => query, functions: { invoke: mocks.invoke }, channel: () => channel, removeChannel: vi.fn() } };
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.clearAllMocks(); });
it('blocks approval retries after a dispatch was saved but approval failed, including remount', async () => {
  mocks.invoke.mockResolvedValue({ data: { ok: false, reconciliationRequired: true, dispatchOrderId: 'synthetic-order', error: 'Dispatch saved; administrator reconciliation needed.' }, error: null });
  const view = render(<TruckRequestsPanel />);
  fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
  fireEvent.change(screen.getByLabelText('Truck #'), { target: { value: 'TEST-1' } });
  fireEvent.click(screen.getByRole('button', { name: /Approve.*dispatch/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled());
  expect(mocks.invoke).toHaveBeenCalledTimes(1);
  expect(mocks.success).not.toHaveBeenCalled();
  view.unmount();
  render(<TruckRequestsPanel />);
  expect(await screen.findByRole('button', { name: 'Approve' })).toBeDisabled();
});
