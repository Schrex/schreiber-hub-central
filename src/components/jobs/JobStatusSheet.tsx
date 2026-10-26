import { useEffect, useId, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { completedAtForDate, todayInNewYork, type JobStatus } from "@/lib/jobs";
import type { JobStatusChange } from "@/lib/jobStatusChange";
import { cn } from "@/lib/utils";

export interface StatusSheetJob {
  id: string;
  name: string;
  job_number: string | null;
  status: JobStatus;
  hold_reason: string | null;
  completed_at: string | null;
}

const OPTIONS: { status: JobStatus; label: string; effect: string }[] = [
  { status: "active", label: "Active", effect: "Running. Shows in the Schedule, Whiteboard, Dispatch and safety pickers." },
  { status: "on_hold", label: "On hold", effect: "Stays in the Active tab with a badge and the reason; leaves the Schedule, Whiteboard and Dispatch pickers." },
  { status: "complete", label: "Complete", effect: "Moves to the Archive and leaves every job picker. Office can reopen it later." },
];

interface JobStatusSheetProps {
  job: StatusSheetJob;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Persist the change; the sheet stays open (and shows the error toast from the caller) if this throws. */
  onSubmit: (change: JobStatusChange) => Promise<void>;
}

/** Bottom sheet that moves a job between Active, On hold and Complete (office/admin). */
export function JobStatusSheet({ job, open, onOpenChange, onSubmit }: JobStatusSheetProps) {
  const idBase = useId();
  const [pick, setPick] = useState<JobStatus>(job.status);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(todayInNewYork());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPick(job.status);
    setReason(job.hold_reason ?? "");
    setDate(todayInNewYork());
  }, [open, job.status, job.hold_reason]);

  const today = todayInNewYork();
  const dateValid = pick !== "complete" || (/^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today);
  const canSave = pick !== job.status && dateValid && !busy;
  const isShop = job.name.trim().toLowerCase() === "shop";

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await onSubmit({
        status: pick,
        hold_reason: pick === "on_hold" ? reason.trim() || null : null,
        completed_at: pick === "complete" ? completedAtForDate(date) : null,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[90vh] max-w-2xl overflow-y-auto rounded-t-2xl pb-8">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display uppercase tracking-wide">Change status</SheetTitle>
          <SheetDescription>
            {job.job_number ? `#${job.job_number} · ` : ""}{job.name}
          </SheetDescription>
        </SheetHeader>

        <div role="radiogroup" aria-label="Status" className="mt-4 space-y-2">
          {OPTIONS.map((option) => {
            const labelId = `${idBase}-${option.status}-label`;
            const effectId = `${idBase}-${option.status}-effect`;
            const checked = pick === option.status;
            return (
              <button
                key={option.status}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-labelledby={labelId}
                aria-describedby={effectId}
                onClick={() => setPick(option.status)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border-[1.5px] bg-card p-3 text-left transition-colors",
                  checked ? "border-primary bg-primary/10" : "border-border",
                )}
              >
                <JobStatusBadge status={option.status} className="mt-0.5" />
                <span className="min-w-0">
                  <span id={labelId} className="block text-sm font-semibold">{option.label}{option.status === job.status ? " (current)" : ""}</span>
                  <span id={effectId} className="block text-xs text-muted-foreground">{option.effect}</span>
                </span>
              </button>
            );
          })}
        </div>

        {pick === "on_hold" && (
          <div className="mt-4 space-y-1">
            <Label htmlFor={`${idBase}-reason`}>Reason (shown on the card)</Label>
            <Input
              id={`${idBase}-reason`}
              placeholder="e.g. Waiting on permit"
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}

        {pick === "complete" && (
          <div className="mt-4 space-y-1">
            <Label htmlFor={`${idBase}-date`}>Completed on</Label>
            <Input
              id={`${idBase}-date`}
              type="date"
              max={today}
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {!dateValid && <p className="text-xs text-destructive">Pick today or an earlier date.</p>}
          </div>
        )}

        {pick === "complete" && isShop && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-warning bg-warning/10 p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            Completing the Shop job will make it leave the Schedule board.
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="flex-[2]" disabled={!canSave} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
