import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhotosSection } from '@/components/jobs/PhotosSection';
const { query, sign } = vi.hoisted(() => ({ query: vi.fn(), sign: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => ({ select: () => ({ eq: () => ({ order: () => ({ order: query }) }) }) }),
  storage: { from: () => ({ createSignedUrls: sign }) },
} }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ role: 'employee', displayName: 'Synthetic Employee' }) }));
const row = (name: string) => ({ id: name, job_id: 'synthetic', caption: name, file_path: `${name}.png`, taken_on: '2026-10-21', created_at: '2026-10-21T00:00:00Z' });
const reply = (name: string) => ({ data: [row(name)], error: null });
afterEach(() => { cleanup(); query.mockReset(); sign.mockReset(); vi.restoreAllMocks(); });

describe('photo refresh ordering', () => {
  it('ignores an earlier fetch that finishes after the resume fetch', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    let finishOld!: (value: ReturnType<typeof reply>) => void;
    query.mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; })).mockResolvedValue(reply('newer'));
    sign.mockImplementation(async (paths: string[]) => ({ data: paths.map(path => ({ signedUrl: `https://local.example.test/${path}` })), error: null }));
    render(<PhotosSection jobId="synthetic" jobLabel="Synthetic" />);
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(screen.getByAltText('newer')).toHaveAttribute('src', 'https://local.example.test/newer.png');
    await act(async () => { finishOld(reply('older')); });
    expect(screen.queryByAltText('older')).toBeNull();
    expect(screen.getByAltText('newer')).toBeVisible();
  });
  it('ignores stale signed URLs when the selected job changes during signing', async () => {
    let finishOld!: (value: { data: { signedUrl: string }[]; error: null }) => void;
    query.mockResolvedValueOnce(reply('old-job')).mockResolvedValueOnce(reply('new-job'));
    sign.mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; }))
      .mockResolvedValueOnce({ data: [{ signedUrl: 'https://local.example.test/new-job.png' }], error: null });
    const { rerender } = render(<PhotosSection jobId="old" jobLabel="Old" />);
    await act(async () => { await Promise.resolve(); });
    rerender(<PhotosSection jobId="new" jobLabel="New" />);
    expect(await screen.findByAltText('new-job')).toBeVisible();
    await act(async () => { finishOld({ data: [{ signedUrl: 'https://local.example.test/old-job.png' }], error: null }); });
    expect(screen.queryByAltText('old-job')).toBeNull();
    expect(screen.getByAltText('new-job')).toHaveAttribute('src', 'https://local.example.test/new-job.png');
  });
});
