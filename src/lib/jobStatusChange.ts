import { supabase } from "@/integrations/supabase/client";
import { isTileAfter, mondayOf, todayInNewYork, type JobStatus } from "@/lib/jobs";

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

/** Schedule entries still pointing at a job after today (New York). Today's entries are always kept. */
export interface FutureReferenceCounts {
  assignments: number;
  tiles: number;
}

/** Ids of the job's whiteboard tiles that fall after today. Their crew child tiles go by cascade. */
async function futureTileIds(jobId: string, today: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("whiteboard_tiles")
    .select("id, week_start, day_index")
    .eq("kind", "job")
    .eq("ref_id", jobId)
    .gte("week_start", mondayOf(today));
  if (error) throw error;
  return (data ?? []).filter((tile) => isTileAfter(tile, today)).map((tile) => tile.id);
}

/** Count the job's schedule assignments and whiteboard tiles dated after today (New York). */
export async function countFutureReferences(jobId: string): Promise<FutureReferenceCounts> {
  const today = todayInNewYork();
  const [assignments, tileIds] = await Promise.all([
    supabase
      .from("schedule_assignments")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .gt("assignment_date", today),
    futureTileIds(jobId, today),
  ]);
  if (assignments.error) throw assignments.error;
  return { assignments: assignments.count ?? 0, tiles: tileIds.length };
}

/** Delete the job's schedule assignments and whiteboard tiles dated after today (New York). */
export async function removeFutureReferences(jobId: string): Promise<FutureReferenceCounts> {
  const today = todayInNewYork();
  const assignments = await supabase
    .from("schedule_assignments")
    .delete()
    .eq("job_id", jobId)
    .gt("assignment_date", today)
    .select("id");
  if (assignments.error) throw assignments.error;
  const tileIds = await futureTileIds(jobId, today);
  let tiles = 0;
  if (tileIds.length > 0) {
    const deleted = await supabase.from("whiteboard_tiles").delete().in("id", tileIds).select("id");
    if (deleted.error) throw deleted.error;
    tiles = deleted.data?.length ?? 0;
  }
  return { assignments: assignments.data?.length ?? 0, tiles };
}
