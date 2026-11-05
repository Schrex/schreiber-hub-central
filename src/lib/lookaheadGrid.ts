// Pure look-ahead calendar rules shared by tests and the published grid.
// Dates are calendar days from the schedule file (YYYY-MM-DD), not instants.

export type ContractorType = "schreiber" | "sub" | "others" | "crew";

export interface ScheduleLeaf {
  name: string;
  start: string;
  finish: string;
  pctComplete: number;
  summary: boolean;
  predecessors: string;
  resources: string;
  parentName: string;
  uniqueId: number | null;
  outlineNumber: string;
  wbs: string;
}

export interface LookaheadRow {
  name: string;
  groupName: string;
  contractorType: ContractorType;
  contractorName: string;
  sortOrder: number;
  mppUniqueId: number | null;
  outlineNumber: string;
  wbs: string;
  pctComplete: number;
  days: string[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function isoDate(value: string): string {
  return value.slice(0, 10);
}

export function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = isoDate(iso).split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, from the calendar date itself. */
export function isoWeekday(iso: string): number {
  const [year, month, day] = isoDate(iso).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function isMondayToFriday(iso: string): boolean {
  const day = isoWeekday(iso);
  return day >= 1 && day <= 5;
}

export function weekdayLabel(iso: string): string {
  return WEEKDAYS[isoWeekday(iso)] ?? "";
}

export function formatMdYy(iso: string): string {
  const [year, month, day] = isoDate(iso).split("-");
  return `${Number(month)}/${Number(day)}/${year.slice(2)}`;
}

export function formatWeekSpan(start: string, end: string): string {
  const [, startMonth, startDay] = isoDate(start).split("-").map(Number);
  const [, endMonth, endDay] = isoDate(end).split("-").map(Number);
  if (startMonth === endMonth) return `${MONTHS[startMonth - 1]} ${startDay}–${endDay}`;
  return `${MONTHS[startMonth - 1]} ${startDay}–${MONTHS[endMonth - 1]} ${endDay}`;
}

/** Monday of the calendar week that contains `iso` (Sunday belongs to the previous Monday). */
export function mondayOf(iso: string): string {
  const day = isoWeekday(iso);
  const back = day === 0 ? 6 : day - 1;
  return addIsoDays(iso, -back);
}

/** This week plus the next three, Monday–Friday. `asOf` is a calendar date. */
export function rollingLookaheadWindow(asOf: string): {
  weekStart: string;
  weeks: 4;
  thisWeek: string[];
  nextWeeks: string[];
} {
  const weekStart = mondayOf(asOf);
  const columns = planColumns(weekStart, 4);
  return { weekStart, weeks: 4, thisWeek: columns.slice(0, 5), nextWeeks: columns.slice(5) };
}

/** Mon–Fri columns for `weeks` weeks beginning on `weekStart` (a Monday). */
export function planColumns(weekStart: string, weeks: number): string[] {
  const columns: string[] = [];
  for (let week = 0; week < weeks; week += 1) {
    const monday = addIsoDays(weekStart, week * 7);
    for (let day = 0; day < 5; day += 1) columns.push(addIsoDays(monday, day));
  }
  return columns;
}

/**
 * Working days touched by [start, finish]. A half day still marks the whole
 * calendar date. Weekends and holiday dates are omitted.
 */
export function workingDatesInSpan(start: string, finish: string, holidays: ReadonlySet<string>): string[] {
  const first = isoDate(start);
  const last = isoDate(finish);
  if (!first || !last || first > last) return [];
  const dates: string[] = [];
  for (let cursor = first; cursor <= last; cursor = addIsoDays(cursor, 1)) {
    if (!isMondayToFriday(cursor)) continue;
    if (holidays.has(cursor)) continue;
    dates.push(cursor);
  }
  return dates;
}

/**
 * Parked placeholder: leaf pinned to the project start, 0% complete, and no
 * predecessors. Summaries are not placeholders; they are group headers.
 */
export function isParkedPlaceholder(task: ScheduleLeaf, projectStartDate: string): boolean {
  if (task.summary) return false;
  return isoDate(task.start) === projectStartDate
    && task.pctComplete === 0
    && task.predecessors.trim() === "";
}

/** Resource name → contractor column. Craft stays "Craft"; Hynes is a sub. */
export function mapContractor(resource: string): { contractorType: ContractorType; contractorName: string } {
  const name = resource.trim();
  const key = name.toLowerCase();
  if (key === "schreiber") return { contractorType: "schreiber", contractorName: "Schreiber" };
  if (key === "hynes") return { contractorType: "sub", contractorName: "Hynes" };
  if (key === "craft") return { contractorType: "crew", contractorName: "Craft" };
  if (!name) return { contractorType: "others", contractorName: "Others" };
  return { contractorType: "others", contractorName: name };
}

/** Leaf rows that have at least one working day inside the plan window. */
export function buildLookaheadRows(
  tasks: readonly ScheduleLeaf[],
  options: {
    projectStartDate: string;
    weekStart: string;
    weeks: number;
    holidays: readonly string[];
  },
): LookaheadRow[] {
  const holidaySet = new Set(options.holidays.map(isoDate));
  const columns = new Set(planColumns(options.weekStart, options.weeks));
  const rows: LookaheadRow[] = [];
  for (const task of tasks) {
    if (task.summary) continue;
    if (isParkedPlaceholder(task, options.projectStartDate)) continue;
    const days = workingDatesInSpan(task.start, task.finish, holidaySet).filter((day) => columns.has(day));
    if (days.length === 0) continue;
    const contractor = mapContractor(task.resources);
    rows.push({
      name: task.name,
      groupName: task.parentName,
      contractorType: contractor.contractorType,
      contractorName: contractor.contractorName,
      sortOrder: rows.length + 1,
      mppUniqueId: task.uniqueId,
      outlineNumber: task.outlineNumber,
      wbs: task.wbs,
      pctComplete: task.pctComplete,
      days,
    });
  }
  return rows;
}
