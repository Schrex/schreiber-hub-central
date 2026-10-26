import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, HardHat, MapPin, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { fetchActiveJobs, type JobCardRow } from "@/components/jobs/jobsQueries";
import { errorMessage } from "@/lib/errorMessage";

interface ActiveJobsListProps {
  canEdit: boolean;
  /** Bump to reload (e.g. after a job is added). */
  refreshKey: number;
}

/** Active tab: running jobs, then on-hold jobs, as rich cards. */
export function ActiveJobsList({ canEdit, refreshKey }: ActiveJobsListProps) {
  const [jobs, setJobs] = useState<JobCardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchActiveJobs()
      .then((rows) => { if (!cancelled) setJobs(rows); })
      .catch((err: unknown) => { if (!cancelled) toast.error(errorMessage(err, "Couldn't load jobs")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading && jobs.length === 0) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <Briefcase className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">No active jobs.</p>
        {canEdit && <p className="mt-1 text-xs text-muted-foreground">Tap "New" to add one.</p>}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {jobs.map((job) => <ActiveJobCard key={job.id} job={job} />)}
    </div>
  );
}

function ActiveJobCard({ job }: { job: JobCardRow }) {
  return (
    <Link
      to={`/jobs/${job.id}`}
      className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center gap-2">
        {job.job_number && <span className="font-mono text-[10px] text-muted-foreground">#{job.job_number}</span>}
        <JobStatusBadge status={job.status} />
      </div>
      <p data-testid="job-name" className="mt-1 truncate font-display text-base uppercase tracking-wide">{job.name}</p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {job.address && (
          <span className="flex min-w-0 items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" /> {job.address}</span>
        )}
        <span className="flex items-center gap-1"><HardHat className="h-3 w-3 shrink-0" /> {job.foreman_name ?? "No foreman"}</span>
      </div>
      {job.status === "on_hold" && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-background px-2 py-1.5 text-xs text-amber-800 dark:text-warning">
          <PauseCircle className="h-3.5 w-3.5 shrink-0" /> {job.hold_reason || "No reason given"}
        </p>
      )}
    </Link>
  );
}
