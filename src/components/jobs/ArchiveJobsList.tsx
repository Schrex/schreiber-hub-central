import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, Building2, HardHat } from "lucide-react";
import { toast } from "sonner";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { fetchArchivedJobs, type JobCardRow } from "@/components/jobs/jobsQueries";
import { errorMessage } from "@/lib/errorMessage";
import { formatNewYorkDate, groupArchiveByYear } from "@/lib/jobs";

interface ArchiveJobsListProps {
  /** Foreman, office and admin see the customer; employees don't (matches the job page). */
  canSeeCustomer: boolean;
}

/** Archive tab: completed jobs grouped by New York completion year, "Date unknown" last. */
export function ArchiveJobsList({ canSeeCustomer }: ArchiveJobsListProps) {
  const [jobs, setJobs] = useState<JobCardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchArchivedJobs()
      .then((rows) => { if (!cancelled) setJobs(rows); })
      .catch((err: unknown) => { if (!cancelled) toast.error(errorMessage(err, "Couldn't load the archive")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <Archive className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">No archived jobs yet.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {groupArchiveByYear(jobs).map((group) => (
        <section key={group.label} aria-label={group.label} className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">{group.label}</h2>
            <span className="text-[11px] text-muted-foreground">{group.jobs.length}</span>
          </div>
          {group.jobs.map((job) => <ArchiveJobCard key={job.id} job={job} canSeeCustomer={canSeeCustomer} />)}
        </section>
      ))}
    </div>
  );
}

function ArchiveJobCard({ job, canSeeCustomer }: { job: JobCardRow; canSeeCustomer: boolean }) {
  return (
    <Link
      to={`/jobs/${job.id}`}
      className="block rounded-xl border border-border bg-surface p-4 opacity-90 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center gap-2">
        {job.job_number && <span className="font-mono text-[10px] text-muted-foreground">#{job.job_number}</span>}
        <JobStatusBadge status={job.status} />
        <span className="ml-auto text-[11px] text-muted-foreground">
          {job.completed_at ? `Done ${formatNewYorkDate(job.completed_at)}` : "Date unknown"}
        </span>
      </div>
      <p data-testid="job-name" className="mt-1 truncate font-display text-base uppercase tracking-wide">{job.name}</p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {canSeeCustomer && job.customer && (
          <span className="flex min-w-0 items-center gap-1 truncate"><Building2 className="h-3 w-3 shrink-0" /> {job.customer}</span>
        )}
        <span className="flex items-center gap-1"><HardHat className="h-3 w-3 shrink-0" /> {job.foreman_name ?? "No foreman"}</span>
      </div>
    </Link>
  );
}
