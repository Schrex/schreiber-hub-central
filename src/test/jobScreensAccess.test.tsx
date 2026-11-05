import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhotosSection } from '@/components/jobs/PhotosSection';
import { SafetyInspectionButton } from '@/components/jobs/SafetyInspectionButton';

type Role = 'employee' | 'foreman' | 'office' | 'admin';
const auth = vi.hoisted(() => ({ roles: [] as Role[], previewRole: null as Role | null }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => {
    const real = (['admin', 'office', 'foreman', 'employee'] as Role[]).find((r) => auth.roles.includes(r)) ?? null;
    return {
      user: { id: 'synthetic-user' }, displayName: 'Synthetic', rolesLoaded: true,
      roles: auth.roles, role: real, previewRole: auth.previewRole, effectiveRole: auth.previewRole ?? real,
    };
  },
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => ({ select: () => ({ eq: () => ({ order: () => ({ order: async () => ({ data: [], error: null }) }) }) }) }),
  storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) },
} }));
afterEach(() => { cleanup(); auth.roles = []; auth.previewRole = null; });

describe('job screens follow the access module', () => {
  it('photos honour an admin previewing as employee', async () => {
    auth.roles = ['admin'];
    auth.previewRole = 'employee';
    render(<PhotosSection jobId="synthetic" jobLabel="Synthetic" />);
    expect(await screen.findByText('No photos yet.')).toBeInTheDocument();
  });
  it('photos let a foreman upload', async () => {
    auth.roles = ['foreman'];
    render(<PhotosSection jobId="synthetic" jobLabel="Synthetic" />);
    expect(await screen.findByText(/Tap Upload/)).toBeInTheDocument();
  });
  it('inspection request shows for anyone holding office, even with admin too', () => {
    auth.roles = ['office', 'admin'];
    render(<SafetyInspectionButton jobId="synthetic" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
  it('inspection request stays hidden from admin-only and foreman', () => {
    auth.roles = ['admin'];
    const { container, rerender } = render(<SafetyInspectionButton jobId="synthetic" />);
    expect(container).toBeEmptyDOMElement();
    auth.roles = ['foreman'];
    rerender(<SafetyInspectionButton jobId="synthetic" />);
    expect(container).toBeEmptyDOMElement();
  });
});
