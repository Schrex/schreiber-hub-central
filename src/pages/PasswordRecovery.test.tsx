import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
const auth = vi.hoisted(() => ({ getUser: vi.fn(), verifyOtp: vi.fn(), updateUser: vi.fn(), resetPasswordForEmail: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth } }));
import PasswordRecovery from './PasswordRecovery';
beforeEach(() => { cleanup(); vi.resetAllMocks(); window.history.replaceState({}, '', '/'); });
function mount(update = false) { render(<MemoryRouter><PasswordRecovery update={update} /></MemoryRouter>); }
describe('password recovery', () => {
  it('requests recovery at the current app origin without exposing account existence', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null }); mount();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset email' }));
    await screen.findByRole('status');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('person@example.test', { redirectTo: `${window.location.origin}/reset-password` });
    expect(screen.getByRole('status')).toHaveTextContent('If an account exists');
  });
  it('blocks password updates without a validated session', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('expired') }); mount(true);
    await screen.findByRole('alert'); expect(screen.getByRole('button')).toBeDisabled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it('does not fall back to an existing session when the recovery URL reports an error', async () => {
    window.history.replaceState({}, '', '/reset-password#error=access_denied'); mount(true);
    expect(screen.getByRole('alert')).toHaveTextContent('invalid or expired');
    expect(auth.getUser).not.toHaveBeenCalled(); expect(screen.getByRole('button')).toBeDisabled();
  });
  it('requires matching passwords and only updates the authenticated account password', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'synthetic' } }, error: null });
    auth.updateUser.mockResolvedValue({ error: null }); mount(true);
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'SyntheticPassword123' } });
    fireEvent.change(screen.getByLabelText('Repeat password'), { target: { value: 'OtherPassword123' } });
    fireEvent.click(screen.getByRole('button')); expect(auth.updateUser).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Repeat password'), { target: { value: 'SyntheticPassword123' } });
    fireEvent.click(screen.getByRole('button')); await screen.findByRole('status');
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'SyntheticPassword123' });
  });
});

 it('keeps passwords blocked on rejected code, then verifies recovery before enabling them', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    auth.verifyOtp.mockResolvedValueOnce({ data: { session: null }, error: new Error('invalid') })
      .mockResolvedValueOnce({ data: { session: { user: { id: 'synthetic' } } }, error: null });
    mount();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset email' }));
    await screen.findByLabelText('Recovery code');
    fireEvent.change(screen.getByLabelText('Recovery code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    await screen.findByRole('alert');
    expect(screen.queryByLabelText('New password')).toBeNull();
    expect(auth.updateUser).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    await screen.findByLabelText('New password');
    expect(auth.verifyOtp).toHaveBeenLastCalledWith({ email: 'person@example.test', token: '123456', type: 'recovery' });
    expect(screen.getByLabelText('New password')).toBeEnabled();
 });
