import { supabase } from "@/integrations/supabase/client";
import type { JobStatus } from "@/lib/jobs";

/** The status fields an office user sets. `completed_by` is always derived by the database trigger. */
export interface JobStatusChange {
  status: JobStatus;
  hold_reason: string | null;
  completed_at: string | null;
}

export interface JobStatusFields extends JobStatusChange {
  completed_by: string | null;
}

const STATUS_COLUMNS = "status, hold_reason, completed_at, completed_by";

/** Apply a status change and return the stored fields (as normalized by the trigger). */
export async function applyJobStatusChange(jobId: string, change: JobStatusChange): Promise<JobStatusFields> {
  const { data, error } = await supabase
    .from("jobs")
    .update(change)
    .eq("id", jobId)
    .select(STATUS_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("You don't have permission to change this job's status.");
  return data as JobStatusFields;
}

/**
 * Restore the previous status fields, but only if the job still has the status just set.
 * Returns the restored fields, or null when someone else changed the job in the meantime.
 */
export async function undoJobStatusChange(
  jobId: string,
  appliedStatus: JobStatus,
  previous: JobStatusChange,
): Promise<JobStatusFields | null> {
  const { data, error } = await supabase
    .from("jobs")
    .update({ status: previous.status, hold_reason: previous.hold_reason, completed_at: previous.completed_at })
    .eq("id", jobId)
    .eq("status", appliedStatus)
    .select(STATUS_COLUMNS);
  if (error) throw error;
  return (data?.[0] as JobStatusFields | undefined) ?? null;
}
