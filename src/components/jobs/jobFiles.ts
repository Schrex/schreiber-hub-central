import { supabase } from '@/integrations/supabase/client';
import type { AccessAction } from '@/lib/access';

export type FileSource = 'Plans' | 'Photos' | 'Permits' | 'SWPPP' | 'Submittals' | 'Contract';
export interface JobFile {
  id: string;
  source: FileSource;
  bucket: string;
  path: string;
  name: string;
  detail?: string;
}
export const fileBuckets: Record<FileSource, string> = {
  Plans: 'job-plans', Photos: 'job-photos', Permits: 'permits',
  SWPPP: 'swpppp-reports', Submittals: 'job-submittals', Contract: 'job-contracts',
};
/** Actions that decide which file sources a viewer sees. */
export type FileAccessAction = Extract<AccessAction, 'job.files.view' | 'job.submittals.view' | 'job.contract.view'>;
/** Pass `useAccess().can` (or `can` bound to a Viewer in tests). */
export function visibleFileSources(can: (action: FileAccessAction) => boolean): FileSource[] {
  if (!can('job.files.view')) return [];
  const sources: FileSource[] = ['Plans', 'Photos', 'Permits', 'SWPPP'];
  if (can('job.submittals.view')) sources.push('Submittals');
  if (can('job.contract.view')) sources.push('Contract');
  return sources;
}
export function fileEntry(source: FileSource, id: string, path: string | null, name?: string | null, detail?: string): JobFile[] {
  if (!path?.trim()) return [];
  return [{ id: `${source}:${id}`, source, bucket: fileBuckets[source], path,
    name: name?.trim() || path.split('/').pop() || 'File', detail }];
}

async function loadSource(source: FileSource, jobId: string): Promise<JobFile[]> {
  switch (source) {
    case 'Contract': {
      const { data, error } = await supabase.from('jobs').select('id,contract_file_path,contract_file_name').eq('id', jobId).maybeSingle();
      if (error) throw error;
      return data ? fileEntry(source, data.id, data.contract_file_path, data.contract_file_name) : [];
    }
    case 'Plans': {
      const { data, error } = await supabase.from('job_plans').select('id,file_path,title,category,version,is_current').eq('job_id', jobId);
      if (error) throw error;
      return (data ?? []).flatMap(row => fileEntry(source, row.id, row.file_path, null,
        `${row.title} · ${row.category} · ${row.version || 'Unnumbered version'} · ${row.is_current ? 'Current' : 'Previous version'}`));
    }
    case 'Photos': {
      const { data, error } = await supabase.from('job_photos').select('id,file_path,caption,taken_on').eq('job_id', jobId);
      if (error) throw error;
      return (data ?? []).flatMap(row => fileEntry(source, row.id, row.file_path, null, [row.caption, row.taken_on].filter(Boolean).join(' · ')));
    }
    case 'Permits': {
      const { data, error } = await supabase.from('job_permits').select('id,file_path,permit_type,permit_number,status').eq('job_id', jobId);
      if (error) throw error;
      return (data ?? []).flatMap(row => fileEntry(source, row.id, row.file_path, null, [row.permit_type, row.permit_number, row.status].filter(Boolean).join(' · ')));
    }
    case 'Submittals': {
      const { data, error } = await supabase.from('job_submittals').select('id,file_path,file_name,title,status').eq('job_id', jobId);
      if (error) throw error;
      return (data ?? []).flatMap(row => fileEntry(source, row.id, row.file_path, row.file_name, `${row.title} · ${row.status}`));
    }
    case 'SWPPP': {
      const { data, error } = await supabase.from('swpppp_reports').select('id,file_path,file_name,title,week_of').eq('job_id', jobId);
      if (error) throw error;
      return (data ?? []).flatMap(row => fileEntry(source, row.id, row.file_path, row.file_name, [row.title, row.week_of].filter(Boolean).join(' · ')));
    }
  }
}
export async function loadJobFiles(jobId: string, sources: readonly FileSource[]) {
  const results = await Promise.allSettled(sources.map(source => loadSource(source, jobId)));
  const files: JobFile[] = [];
  const failed: FileSource[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') files.push(...result.value);
    else failed.push(sources[index]);
  });
  files.sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return { files, failed };
}
export async function jobFileUrl(file: JobFile, download = false) {
  const { data, error } = await supabase.storage.from(file.bucket).createSignedUrl(file.path, 300,
    download ? { download: file.name } : undefined);
  if (error || !data?.signedUrl) throw new Error('Could not access file');
  return data.signedUrl;
}
