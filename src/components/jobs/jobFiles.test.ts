import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fileEntry, jobFileUrl, loadJobFiles, visibleFileSources } from './jobFiles';
const mocks = vi.hoisted(() => ({ from: vi.fn(), storage: vi.fn(), signed: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from, storage: { from: mocks.storage } } }));
beforeEach(() => { vi.clearAllMocks(); mocks.storage.mockReturnValue({ createSignedUrl: mocks.signed }); });
function dataSources(fail?: string) {
  const filters: [string, string, string][] = [];
  mocks.from.mockImplementation((table: string) => ({ select: () => ({ eq: (key: string, value: string) => {
    filters.push([table, key, value]);
    const result = table === fail ? { data: null, error: new Error('private error') } : { data: table === 'job_plans' ? [
      { id: 'old', file_path: 'job/old.pdf', title: 'Plan', category: 'civil', version: '1', is_current: false },
      { id: 'new', file_path: 'job/new.pdf', title: 'Plan', category: 'civil', version: '2', is_current: true },
    ] : [], error: null };
    if (table === 'jobs') return { maybeSingle: () => Promise.resolve({ data: { id: value, contract_file_path: 'job/private.pdf', contract_file_name: 'Private contract' }, error: null }) };
    return Promise.resolve(result);
  } }) }));
  return filters;
}
describe('job file aggregation', () => {
  it('does not query restricted sources for employee and scopes queries to job', async () => {
    const filters = dataSources();
    await loadJobFiles('chosen-job', 'employee');
    expect(mocks.from.mock.calls.map(([table]) => table).sort()).toEqual(['job_permits', 'job_photos', 'job_plans', 'swpppp_reports']);
    expect(filters.every(([, key, value]) => key === 'job_id' && value === 'chosen-job')).toBe(true);
    expect(visibleFileSources(null)).toEqual([]);
    expect(visibleFileSources('foreman')).toContain('Submittals');
    expect(visibleFileSources('foreman')).not.toContain('Contract');
  });
  it('keeps both plan versions and contract for office while reporting partial failures', async () => {
    dataSources('job_photos');
    const result = await loadJobFiles('chosen-job', 'office');
    expect(result.failed).toEqual(['Photos']);
    expect(result.files.map(file => file.id)).toEqual(['Contract:chosen-job', 'Plans:new', 'Plans:old']);
    expect(result.files.find(file => file.id === 'Plans:old')?.detail).toContain('Previous version');
    expect(result.files.find(file => file.id === 'Plans:new')?.detail).toContain('Current');
  });
  it('omits metadata-only records and preserves distinct bucket/path mapping', () => {
    expect(fileEntry('Permits', 'empty', null)).toEqual([]);
    expect(fileEntry('SWPPP', 'report', 'folder/report.pdf')).toEqual([{ id: 'SWPPP:report', source: 'SWPPP', bucket: 'swpppp-reports', path: 'folder/report.pdf', name: 'report.pdf', detail: undefined }]);
  });
  it('signs on demand and requests attachment semantics for download', async () => {
    const file = fileEntry('Contract', '1', 'job/contract.pdf', 'Contract.pdf')[0];
    mocks.signed.mockResolvedValue({ data: { signedUrl: 'https://example.test/signed' }, error: null });
    await jobFileUrl(file, true);
    expect(mocks.storage).toHaveBeenCalledWith('job-contracts');
    expect(mocks.signed).toHaveBeenCalledWith(file.path, 300, { download: file.name });
    mocks.signed.mockResolvedValue({ data: null, error: new Error('secret') });
    await expect(jobFileUrl(file)).rejects.toThrow('Could not access file');
  });
});
