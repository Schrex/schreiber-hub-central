import { useEffect, useState } from "react";
import { PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { JobStatusSheet, type StatusSheetJob } from "@/components/jobs/JobStatusSheet";
import { fetchDisplayNames } from "@/components/jobs/jobsQueries";
import { errorMessage } from "@/lib/errorMessage";
import { formatNewYorkDate, jobStatusBadge, DATE_UNKNOWN_LABEL } from "@/lib/jobs";
import {
  applyJobStatusChange,
  undoJobStatusChange,
  type JobStatusChange,
  type JobStatusFields,
} from "@/lib/jobStatusChange";

export interface StatusSectionJob extends StatusSheetJob {
  completed_by: string | null;
}

interface JobStatusSectionProps {
  job: StatusSectionJob;
  /** Office/admin, using the job page's preview-aware role. The database enforces permissions regardless. */
  canChangeStatus: boolean;
  onChanged: (fields: JobStatusFields) => void;
}

/** Job page status area: archived/on-hold banners, the "Change status" row and its bottom sheet, with Undo. */
export function JobStatusSection({ job, canChangeStatus, onChanged }: JobStatusSectionProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reopening, setReopening] = useState(false);

  const change = async (next: JobStatusChange) => {
    const previous: JobStatusChange = { status: job.status, hold_reason: job.hold_reason, completed_at: job.completed_at };
    const stored = await applyJobStatusChange(job.id, next);
    onChanged(stored);
    toast.success(`Status changed to ${jobStatusBadge(stored.status).label}`, {
      duration: 10_000,
      action: {
        label: "Undo",
        onClick: async () => {
          try {
            const restored = await undoJobStatusChange(job.id, stored.status, previous);
            if (!restored) {
              toast.error("Changed by someone else; not undone");
              return;
            }
            onChanged(restored);
            toast.success("Status change undone");
          } catch (err: unknown) {
            toast.error(errorMessage(err, "Couldn't undo the status change"));
          }
        },
      },
    });
  };

  const submit = async (next: JobStatusChange) => {
    try {
      await change(next);
      setSheetOpen(false);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Couldn't change the status"));
    }
  };

  const reopen = async () => {
    setReopening(true);
    try {
      await change({ status: "active", hold_reason: null, completed_at: null });
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Couldn't reopen the job"));
    } finally {
      setReopening(false);
    }
  };

  return (
    <>
      {job.status === "complete" && (
        <ArchivedBanner job={job} action={canChangeStatus && (
          <Button size="sm" variant="outline" onClick={reopen} disabled={reopening}>Reopen</Button>
        )} />
      )}
      {job.status === "on_hold" && (
        <p className="flex items-center gap-2 rounded-xl border-[1.5px] border-warning bg-warning/10 px-3 py-2.5 text-xs">
          <PauseCircle className="h-4 w-4 shrink-0 text-amber-800 dark:text-warning" />
          <span><b className="text-amber-800 dark:text-warning">On hold</b> · {job.hold_reason || "No reason given"}</span>
        </p>
      )}
      {canChangeStatus && (
        <>
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm">Status <JobStatusBadge status={job.status} /></span>
            <Button size="sm" variant="secondary" onClick={() => setSheetOpen(true)}>Change status</Button>
          </div>
          <JobStatusSheet job={job} open={sheetOpen} onOpenChange={setSheetOpen} onSubmit={submit} />
        </>
      )}
    </>
  );
}

function ArchivedBanner({ job, action }: { job: StatusSectionJob; action: React.ReactNode }) {
  // undefined while loading; null when unknown (service-role writes, deleted users, legacy rows).
  const [closer, setCloser] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const userId = job.completed_by;
    if (!userId) { setCloser(null); return; }
    let cancelled = false;
    setCloser(undefined);
    fetchDisplayNames([userId])
      .then((names) => { if (!cancelled) setCloser(names.get(userId) ?? null); })
      .catch(() => { if (!cancelled) setCloser(null); });
    return () => { cancelled = true; };
  }, [job.completed_by]);

  return (
    <section aria-label="Archived" className="overflow-hidden rounded-xl border border-border">
      <div
        aria-hidden
        className="h-1.5"
        style={{ background: "repeating-linear-gradient(135deg, hsl(var(--muted-foreground)) 0 8px, hsl(var(--muted)) 8px 16px)" }}
      />
      <div className="flex items-center justify-between gap-3 bg-surface px-3 py-2.5 text-xs">
        <span>
          <b>Archived</b> · {job.completed_at ? `Completed ${formatNewYorkDate(job.completed_at)}` : DATE_UNKNOWN_LABEL}
          {" · by "}{closer === undefined ? "…" : closer ?? "Unknown"}
        </span>
        {action}
      </div>
    </section>
  );
}
