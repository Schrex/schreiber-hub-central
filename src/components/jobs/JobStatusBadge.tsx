import { cn } from "@/lib/utils";
import { jobStatusBadge, type JobStatus } from "@/lib/jobs";

interface JobStatusBadgeProps {
  status: JobStatus;
  className?: string;
}

/** Shared status badge for the jobs list and job page. */
export function JobStatusBadge({ status, className }: JobStatusBadgeProps) {
  const badge = jobStatusBadge(status);
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center rounded border-[1.5px] px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wider",
        badge.className,
        className,
      )}
    >
      {badge.label}
    </span>
  );
}
