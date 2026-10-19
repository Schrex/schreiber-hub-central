import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { jobFileUrl, loadJobFiles, type JobFile } from './jobFiles';

export function JobFilesSection({ jobId }: { jobId: string }) {
  const { role, effectiveRole } = useAuth();
  const activeRole = effectiveRole ?? role;
  // A keyed child removes private rows immediately when role/job changes, before
  // effects run. Its cleanup also prevents a late signed URL from opening.
  return <FileList key={`${jobId}:${activeRole}`} jobId={jobId} role={activeRole} />;
}
function FileList({ jobId, role }: { jobId: string; role: ReturnType<typeof useAuth>['role'] }) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof loadJobFiles>> | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    let current = true;
    setResult(null);
    loadJobFiles(jobId, role).then(value => { if (current) setResult(value); });
    return () => { current = false; };
  }, [jobId, role, revision]);

  async function access(file: JobFile, download: boolean) {
    setPending(file.id);
    setError('');
    // Reserve the tab within the user gesture so async URL signing does not get
    // blocked as a popup. Detach opener immediately, before navigating.
    const target = download ? null : window.open('about:blank', '_blank');
    if (target) target.opener = null;
    try {
      if (!download && !target) throw new Error('popup');
      const url = await jobFileUrl(file, download);
      if (!mounted.current) { target?.close(); return; }
      if (target) target.location.replace(url);
      else {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.name;
        anchor.rel = 'noopener noreferrer';
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
      }
    } catch {
      target?.close();
      if (mounted.current) setError(`Could not ${download ? 'download' : 'open'} ${file.name}. Check access and allow popups, then try again.`);
    } finally {
      if (mounted.current) setPending(null);
    }
  }
  return <section aria-label="Job files" className="space-y-3 rounded-2xl border border-border bg-surface p-4">
    <div className="flex items-center justify-between gap-2">
      <h2 className="font-display text-sm uppercase tracking-wider">Files</h2>
      <Button variant="ghost" size="sm" disabled={pending !== null} onClick={() => setRevision(value => value + 1)}>Refresh files</Button>
    </div>
    <p className="text-xs text-muted-foreground">Open or download job attachments. Uploads and updates are in the sections below.</p>
    {!result && <p role="status" className="text-sm">Loading files…</p>}
    {!!result?.failed.length && <p role="alert" className="text-sm text-destructive">Could not load {result.failed.join(', ')}. Other available files are shown. Try refreshing.</p>}
    {result && !result.files.length && !result.failed.length && <p className="text-sm text-muted-foreground">No files attached to this job yet.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!!result?.files.length && <ul className="divide-y divide-border">
      {result.files.map(file => <li key={file.id} className="py-3 space-y-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{file.source}</p>
          <p className="break-words text-sm font-medium">{file.name}</p>
          {file.detail && <p className="break-words text-xs text-muted-foreground">{file.detail}</p>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={pending !== null} aria-label={`Open ${file.name}`} onClick={() => access(file, false)}>Open</Button>
          <Button size="sm" variant="outline" disabled={pending !== null} aria-label={`Download ${file.name}`} onClick={() => access(file, true)}>Download</Button>
        </div>
      </li>)}
    </ul>}
  </section>;
}
