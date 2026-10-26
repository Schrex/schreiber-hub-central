import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, Building2, HardHat, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import {
  fetchArchivedJobsPage,
  fetchOldestCompletion,
  type ArchiveYearFilter,
  type JobCardRow,
} from "@/components/jobs/jobsQueries";
import { errorMessage } from "@/lib/errorMessage";
import { archiveYearOptions, DATE_UNKNOWN_LABEL, formatNewYorkDate, groupArchiveByYear } from "@/lib/jobs";

const SEARCH_DEBOUNCE_MS = 300;

interface ArchiveJobsListProps {
  /** Foreman, office and admin see (and can search by) the customer; employees can't (matches the job page). */
  canSeeCustomer: boolean;
}

function parseYear(value: string): ArchiveYearFilter {
  if (value === "unknown") return "unknown";
  return value ? Number(value) : null;
}

/** Archive tab: completed jobs grouped by New York completion year, "Date unknown" last; searchable, filterable by year, paged. */
export function ArchiveJobsList({ canSeeCustomer }: ArchiveJobsListProps) {
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [year, setYear] = useState<ArchiveYearFilter>(null);
  const [years, setYears] = useState<number[]>(() => archiveYearOptions(null));
  const [jobs, setJobs] = useState<JobCardRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Only the latest request may update the list, so a slow earlier search can't overwrite a newer one.
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchText), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    fetchOldestCompletion()
      .then((oldest) => setYears(archiveYearOptions(oldest)))
      .catch(() => { /* keep this year only; the list itself still loads */ });
  }, []);

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    fetchArchivedJobsPage({ search, year, canSeeCustomer, page: 0 })
      .then((result) => {
        if (id !== requestId.current) return;
        setJobs(result.rows);
        setTotal(result.total);
        setPage(0);
      })
      .catch((err: unknown) => { if (id === requestId.current) toast.error(errorMessage(err, "Couldn't load the archive")); })
      .finally(() => { if (id === requestId.current) setLoading(false); });
  }, [search, year, canSeeCustomer]);

  const loadMore = () => {
    const id = ++requestId.current;
    const next = page + 1;
    setLoadingMore(true);
    fetchArchivedJobsPage({ search, year, canSeeCustomer, page: next })
      .then((result) => {
        if (id !== requestId.current) return;
        setJobs((current) => [...current, ...result.rows]);
        setTotal(result.total);
        setPage(next);
      })
      .catch((err: unknown) => { if (id === requestId.current) toast.error(errorMessage(err, "Couldn't load more jobs")); })
      .finally(() => setLoadingMore(false));
  };

  const filtered = search.trim() !== "" || year !== null;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search archive"
            placeholder={canSeeCustomer ? "Name, number, foreman, customer" : "Name, number or foreman"}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          aria-label="Year"
          value={year === null ? "" : String(year)}
          onChange={(e) => setYear(parseYear(e.target.value))}
          className="h-10 shrink-0 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
          <option value="unknown">{DATE_UNKNOWN_LABEL}</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Archive className="mx-auto h-8 w-8 text-muted-foreground" />
          {filtered ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">No archived jobs match</p>
              <p className="text-xs text-muted-foreground">Try a different search or year.</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No archived jobs yet.</p>
          )}
        </div>
      ) : (
        <>
          {groupArchiveByYear(jobs).map((group) => (
            <section key={group.label} aria-label={group.label} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">{group.label}</h2>
                <span className="text-[11px] text-muted-foreground">{group.jobs.length}</span>
              </div>
              {group.jobs.map((job) => <ArchiveJobCard key={job.id} job={job} canSeeCustomer={canSeeCustomer} />)}
            </section>
          ))}
          <div className="flex flex-col items-center gap-2 pt-2">
            <p className="text-xs text-muted-foreground">Showing {jobs.length} of {total}</p>
            {jobs.length < total && (
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            )}
          </div>
        </>
      )}
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
