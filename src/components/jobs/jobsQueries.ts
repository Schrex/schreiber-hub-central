// Supabase reads for the Jobs page tabs. Kept apart from the components so the archive
// query (search, year, paging) and the active cards (people today) can grow independently.
import { supabase } from "@/integrations/supabase/client";
import { countPeopleByJob, sortActiveJobs, todayInNewYork, type JobStatus } from "@/lib/jobs";

export interface JobCardRow {
  id: string;
  job_number: string | null;
  name: string;
  address: string | null;
  status: JobStatus;
  start_date: string | null;
  hold_reason: string | null;
  completed_at: string | null;
  customer: string | null;
  foreman_id: string | null;
  /** Foreman display name, resolved from profiles (foreman_id references auth users, so it can't be embedded). */
  foreman_name: string | null;
}

const CARD_COLUMNS = "id, job_number, name, address, status, start_date, hold_reason, completed_at, customer, foreman_id";

/** Display names for user ids (profiles are readable by every signed-in user). */
export async function fetchDisplayNames(userIds: readonly (string | null)[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (!ids.length) return new Map();
  const { data, error } = await supabase.from("profiles").select("user_id, display_name").in("user_id", ids);
  if (error) throw error;
  return new Map((data ?? []).filter((p) => p.display_name).map((p) => [p.user_id, p.display_name as string]));
}

async function withForemanNames(rows: Omit<JobCardRow, "foreman_name">[]): Promise<JobCardRow[]> {
  const names = await fetchDisplayNames(rows.map((r) => r.foreman_id));
  return rows.map((r) => ({ ...r, foreman_name: r.foreman_id ? names.get(r.foreman_id) ?? null : null }));
}

export interface JobTabCounts {
  active: number;
  archive: number;
}

/** Count-only head queries for the two tabs. */
export async function fetchJobTabCounts(): Promise<JobTabCounts> {
  const [active, archive] = await Promise.all([
    supabase.from("jobs").select("id", { count: "exact", head: true }).in("status", ["active", "on_hold"]),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "complete"),
  ]);
  if (active.error) throw active.error;
  if (archive.error) throw archive.error;
  return { active: active.count ?? 0, archive: archive.count ?? 0 };
}

/** Running jobs, then on-hold jobs (newest start first within each). */
export async function fetchActiveJobs(): Promise<JobCardRow[]> {
  const { data, error } = await supabase.from("jobs").select(CARD_COLUMNS).in("status", ["active", "on_hold"]);
  if (error) throw error;
  return sortActiveJobs(await withForemanNames((data ?? []) as Omit<JobCardRow, "foreman_name">[]));
}

/** Distinct people scheduled today (New York) per job, in one query for all given jobs. Jobs with nobody have no entry. */
export async function fetchPeopleToday(jobIds: readonly string[]): Promise<Map<string, number>> {
  if (!jobIds.length) return new Map();
  const { data, error } = await supabase
    .from("schedule_assignments")
    .select("job_id, user_id")
    .eq("assignment_date", todayInNewYork())
    .in("job_id", [...jobIds]);
  if (error) throw error;
  return countPeopleByJob(data ?? []);
}

/** Completed jobs, newest completion first; rows with no completion date last. */
export async function fetchArchivedJobs(): Promise<JobCardRow[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select(CARD_COLUMNS)
    .eq("status", "complete")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true });
  if (error) throw error;
  return withForemanNames((data ?? []) as Omit<JobCardRow, "foreman_name">[]);
}
