// Supabase reads for the Jobs page tabs. Kept apart from the components so the archive
// query (search, year, paging) and the active cards (people today) can grow independently.
import { supabase } from "@/integrations/supabase/client";
import { ilikeOrFilter, newYorkYearRange, sortActiveJobs, type JobStatus } from "@/lib/jobs";

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

export const ARCHIVE_PAGE_SIZE = 25;

/** A New York calendar year, "unknown" for jobs with no completion date, or null for all years. */
export type ArchiveYearFilter = number | "unknown" | null;

export interface ArchiveQuery {
  search: string;
  year: ArchiveYearFilter;
  /** Foreman, office and admin may also match on customer. */
  canSeeCustomer: boolean;
  /** Zero-based page of ARCHIVE_PAGE_SIZE rows. */
  page: number;
}

export interface ArchivePage {
  rows: JobCardRow[];
  /** All matching archived jobs, across pages. */
  total: number;
}

/** User ids of profiles whose display name contains `text` (case-insensitive). */
async function userIdsMatchingName(text: string): Promise<string[]> {
  const { data, error } = await supabase.from("profiles").select("user_id").or(ilikeOrFilter(["display_name"], text));
  if (error) throw error;
  return (data ?? []).map((p) => p.user_id);
}

/**
 * One page of completed jobs, newest completion first, undated last.
 * Search matches name and job number (plus customer when allowed) and foreman name. Foreman takes
 * two steps because `foreman_id` references auth users, not profiles, so it can't be embedded.
 */
export async function fetchArchivedJobsPage({ search, year, canSeeCustomer, page }: ArchiveQuery): Promise<ArchivePage> {
  let query = supabase.from("jobs").select(CARD_COLUMNS, { count: "exact" }).eq("status", "complete");
  if (year === "unknown") {
    query = query.is("completed_at", null);
  } else if (year !== null) {
    const { start, end } = newYorkYearRange(year);
    query = query.gte("completed_at", start).lt("completed_at", end);
  }
  const text = search.trim();
  if (text) {
    const columns = canSeeCustomer ? ["name", "job_number", "customer"] : ["name", "job_number"];
    const filters = [ilikeOrFilter(columns, text)];
    const foremanIds = await userIdsMatchingName(text);
    if (foremanIds.length) filters.push(`foreman_id.in.(${foremanIds.join(",")})`);
    query = query.or(filters.join(","));
  }
  const from = page * ARCHIVE_PAGE_SIZE;
  const { data, error, count } = await query
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, from + ARCHIVE_PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: await withForemanNames((data ?? []) as Omit<JobCardRow, "foreman_name">[]), total: count ?? 0 };
}

/** Earliest completion date in the archive, for the year filter's range. */
export async function fetchOldestCompletion(): Promise<string | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select("completed_at")
    .eq("status", "complete")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.completed_at ?? null;
}
