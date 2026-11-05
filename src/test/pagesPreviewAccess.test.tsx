import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@/hooks/useAuth';
import Jobs from '@/pages/Jobs';

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth.value }));
vi.mock('@/components/jobs/jobsQueries', () => ({ fetchJobTabCounts: () => new Promise(() => {}) }));
vi.mock('@/components/jobs/NewJobDialog', () => ({ NewJobDialog: () => <button>New job</button> }));
vi.mock('@/components/jobs/ActiveJobsList', () => ({
  ActiveJobsList: ({ canEdit }: { canEdit: boolean }) => <p>active list canEdit={String(canEdit)}</p>,
}));
vi.mock('@/components/jobs/ArchiveJobsList', () => ({ ArchiveJobsList: () => null }));
afterEach(cleanup);

const renderJobs = (roles: Role[], previewRole: Role | null = null, rolesLoaded = true) => {
  const role = roles[0] ?? null;
  auth.value = {
    user: { id: 'synthetic-user' }, session: {}, roles, role, rolesLoaded, loading: !rolesLoaded,
    previewRole, effectiveRole: role === 'admin' && previewRole ? previewRole : role,
    setPreviewRole: vi.fn(), displayName: 'Synthetic', positionTitle: null, signOut: vi.fn(),
  };
  render(<MemoryRouter><Jobs /></MemoryRouter>);
};

describe('Jobs page honours preview', () => {
  it('shows the office-only New job control to an admin', () => {
    renderJobs(['admin']);
    expect(screen.getByText('New job')).toBeInTheDocument();
    expect(screen.getByText('active list canEdit=true')).toBeInTheDocument();
  });
  it('hides the office-only New job control while an admin previews as employee', () => {
    renderJobs(['admin'], 'employee');
    expect(screen.queryByText('New job')).toBeNull();
    expect(screen.getByText('active list canEdit=false')).toBeInTheDocument();
  });
  it('shows it to an office user who also holds a lower role', () => {
    renderJobs(['foreman', 'office']);
    expect(screen.getByText('New job')).toBeInTheDocument();
  });
  it('hides it until roles load', () => {
    renderJobs(['admin'], null, false);
    expect(screen.queryByText('New job')).toBeNull();
  });
});
