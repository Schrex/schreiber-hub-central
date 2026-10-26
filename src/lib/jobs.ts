// Framework-free jobs helpers shared by the Jobs pages and unit tests.
// Inputs are typed structurally so callers can pass rows before/after new columns land.

export const NEW_YORK_TZ = "America/New_York";

const nyDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: NEW_YORK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** New York calendar date (YYYY-MM-DD) for an instant. Matches `(now() AT TIME ZONE 'America/New_York')::date`. */
export function newYorkDate(instant: Date): string {
  const parts = nyDateFormatter.formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's date in New York (YYYY-MM-DD). */
export function todayInNewYork(now: Date = new Date()): string {
  return newYorkDate(now);
}

export type JobStatus = "active" | "on_hold" | "complete";

const STATUS_RANK: Record<JobStatus, number> = { active: 0, on_hold: 1, complete: 2 };

/** Running first, then on hold; newest start date first within each group; unknown start last. Returns a new array. */
export function sortActiveJobs<T extends { status: JobStatus; start_date: string | null }>(jobs: readonly T[]): T[] {
  return [...jobs].sort((a, b) => {
    const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (byStatus !== 0) return byStatus;
    if (a.start_date === b.start_date) return 0;
    if (a.start_date === null) return 1;
    if (b.start_date === null) return -1;
    return a.start_date < b.start_date ? 1 : -1;
  });
}

export const DATE_UNKNOWN_LABEL = "Date unknown";

export interface ArchiveYearGroup<T> {
  /** Calendar year in New York, or null for the "Date unknown" group. */
  year: number | null;
  label: string;
  jobs: T[];
}

/** New York calendar year of an ISO timestamp. */
export function newYorkYear(iso: string): number {
  return Number(newYorkDate(new Date(iso)).slice(0, 4));
}

/** Group archived rows by New York completion year (newest first); rows without a date go in a final "Date unknown" group. Row order within a group is preserved. */
export function groupArchiveByYear<T extends { completed_at: string | null }>(rows: readonly T[]): ArchiveYearGroup<T>[] {
  const byYear = new Map<number, T[]>();
  const unknown: T[] = [];
  for (const row of rows) {
    if (!row.completed_at) {
      unknown.push(row);
      continue;
    }
    const year = newYorkYear(row.completed_at);
    const bucket = byYear.get(year);
    if (bucket) bucket.push(row);
    else byYear.set(year, [row]);
  }
  const groups: ArchiveYearGroup<T>[] = [...byYear.keys()]
    .sort((a, b) => b - a)
    .map((year) => ({ year, label: String(year), jobs: byYear.get(year)! }));
  if (unknown.length) groups.push({ year: null, label: DATE_UNKNOWN_LABEL, jobs: unknown });
  return groups;
}

/** Distinct people per job from an assignment list (pass only the day's assignments). Jobs with nobody have no entry. */
export function countPeopleByJob(assignments: readonly { job_id: string; user_id: string }[]): Map<string, number> {
  const people = new Map<string, Set<string>>();
  for (const { job_id, user_id } of assignments) {
    const set = people.get(job_id);
    if (set) set.add(user_id);
    else people.set(job_id, new Set([user_id]));
  }
  return new Map([...people].map(([jobId, set]) => [jobId, set.size]));
}

export type JobStatusTone = "solid" | "outline" | "muted";

export interface JobStatusBadgeStyle {
  label: string;
  tone: JobStatusTone;
  /** Tailwind classes; readable in light and dark themes. */
  className: string;
}

const STATUS_BADGES: Record<JobStatus, JobStatusBadgeStyle> = {
  // Solid hi-vis yellow with dark text.
  active: { label: "Active", tone: "solid", className: "border-primary bg-primary text-primary-foreground" },
  // Warning-color outline. Light mode darkens the text so it stays readable on white.
  on_hold: { label: "On hold", tone: "outline", className: "border-warning bg-transparent text-amber-800 dark:text-warning" },
  complete: { label: "Complete", tone: "muted", className: "border-transparent bg-muted text-muted-foreground" },
};

export function jobStatusBadge(status: JobStatus): JobStatusBadgeStyle {
  return STATUS_BADGES[status];
}

/**
 * Build a PostgREST `or` filter body matching `text` as a case-insensitive substring of any column,
 * e.g. for `.or(ilikeOrFilter(["name", "job_number"], search))`.
 * The value is double-quoted so commas and parentheses cannot break the filter; LIKE wildcards
 * (`%`, `_`) are escaped to match literally; `*` (PostgREST's wildcard, not escapable) is dropped.
 */
export function ilikeOrFilter(columns: readonly string[], text: string): string {
  const likeLiteral = text
    .trim()
    .replace(/\*/g, "")
    .replace(/[\\%_]/g, (c) => `\\${c}`);
  const quoted = `"*${likeLiteral.replace(/[\\"]/g, (c) => `\\${c}`)}*"`;
  return columns.map((column) => `${column}.ilike.${quoted}`).join(",");
}
