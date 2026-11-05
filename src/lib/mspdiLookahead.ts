// MSPDI (Microsoft Project XML) → look-ahead rows. No cost or rate fields are read.
import {
  buildLookaheadRows,
  isParkedPlaceholder,
  rollingLookaheadWindow,
  type LookaheadRow,
  type ScheduleLeaf,
} from "@/lib/lookaheadGrid";

const PROJECT_NS = "http://schemas.microsoft.com/project";

export interface LookaheadHoliday {
  date: string;
  label: string;
}

export interface ParsedLookahead {
  projectName: string;
  projectStartDate: string;
  weekStart: string;
  weeks: 4;
  holidays: LookaheadHoliday[];
  rows: LookaheadRow[];
  skippedPlaceholders: string[];
}

function localElements(root: Document | Element, name: string): Element[] {
  const namespaced = root.getElementsByTagNameNS(PROJECT_NS, name);
  const found = namespaced.length > 0 ? namespaced : root.getElementsByTagName(name);
  return Array.from(found);
}

function directChild(element: Element, name: string): Element | null {
  for (const child of element.children) {
    if (child.localName === name) return child;
  }
  return null;
}

function directText(element: Element, name: string): string {
  return directChild(element, name)?.textContent ?? "";
}

function eachDate(start: string, finish: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = start.slice(0, 10).split("-").map(Number);
  const [ey, em, ed] = finish.slice(0, 10).split("-").map(Number);
  const cursor = new Date(Date.UTC(sy, sm - 1, sd));
  const end = Date.UTC(ey, em - 1, ed);
  while (cursor.getTime() <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function calendarHolidays(project: Element): LookaheadHoliday[] {
  const holidays: LookaheadHoliday[] = [];
  const seen = new Set<string>();
  for (const exception of localElements(project, "Exception")) {
    const working = directText(exception, "DayWorking").trim();
    if (working === "1") continue;
    const from = (localElements(exception, "FromDate")[0]?.textContent ?? "").slice(0, 10);
    const to = (localElements(exception, "ToDate")[0]?.textContent ?? "").slice(0, 10) || from;
    if (!from) continue;
    const label = (localElements(exception, "Name")[0]?.textContent ?? "").trim() || "Holiday";
    for (const date of eachDate(from, to)) {
      if (seen.has(date)) continue;
      seen.add(date);
      holidays.push({ date, label });
    }
  }
  return holidays;
}

function resourceNames(project: Element): Map<string, string> {
  const names = new Map<string, string>();
  for (const resource of localElements(project, "Resource")) {
    const uid = directText(resource, "UID").trim();
    const name = directText(resource, "Name").trim();
    if (uid && name) names.set(uid, name);
  }
  return names;
}

function assignmentResources(project: Element, names: Map<string, string>): Map<string, string> {
  const assigned = new Map<string, string>();
  for (const assignment of localElements(project, "Assignment")) {
    const taskUid = directText(assignment, "TaskUID").trim();
    const resourceUid = directText(assignment, "ResourceUID").trim();
    const name = names.get(resourceUid);
    if (taskUid && name && !assigned.has(taskUid)) assigned.set(taskUid, name);
  }
  return assigned;
}

/** Parse an MSPDI export into the rolling this-week-plus-three window. */
export function parseMspdi(xml: string, asOf: string): ParsedLookahead {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("This file is not valid XML.");
  }
  const project = localElements(doc, "Project")[0];
  if (!project) throw new Error("This file is not a Microsoft Project XML export.");

  const projectStart = directText(project, "StartDate").slice(0, 10);
  if (!projectStart) throw new Error("The project XML has no start date.");
  const window = rollingLookaheadWindow(asOf);
  const holidayList = calendarHolidays(project).filter((holiday) => (
    holiday.date >= window.thisWeek[0] && holiday.date <= window.nextWeeks[window.nextWeeks.length - 1]
  ));
  const names = resourceNames(project);
  const assigned = assignmentResources(project, names);

  const leaves: ScheduleLeaf[] = [];
  const skippedPlaceholders: string[] = [];
  const stack: { level: number; name: string }[] = [];
  for (const task of localElements(project, "Task")) {
    const level = Number(directText(task, "OutlineLevel") || "0");
    const name = directText(task, "Name");
    const summary = directText(task, "Summary").trim() === "1";
    while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
    const parentName = stack.length > 0 ? stack[stack.length - 1].name : "";
    if (summary || level === 0) {
      stack.push({ level, name });
      continue;
    }
    const leaf: ScheduleLeaf = {
      name,
      start: directText(task, "Start"),
      finish: directText(task, "Finish"),
      pctComplete: Number(directText(task, "PercentComplete") || "0"),
      summary: false,
      predecessors: directChild(task, "PredecessorLink") ? "1" : "",
      resources: assigned.get(directText(task, "UID").trim()) ?? "",
      parentName,
      uniqueId: Number(directText(task, "UID") || "0") || null,
      outlineNumber: directText(task, "OutlineNumber").trim(),
      wbs: directText(task, "WBS").trim(),
    };
    if (isParkedPlaceholder(leaf, projectStart)) {
      skippedPlaceholders.push(leaf.name);
      continue;
    }
    leaves.push(leaf);
  }

  return {
    projectName: directText(project, "Name").trim(),
    projectStartDate: projectStart,
    weekStart: window.weekStart,
    weeks: 4,
    holidays: holidayList,
    rows: buildLookaheadRows(leaves, {
      projectStartDate: projectStart,
      weekStart: window.weekStart,
      weeks: window.weeks,
      holidays: holidayList.map((holiday) => holiday.date),
    }),
    skippedPlaceholders,
  };
}

export function lookaheadUploadPayload(parsed: ParsedLookahead, filename: string) {
  return {
    source_filename: filename,
    week_start: parsed.weekStart,
    weeks: parsed.weeks,
    skipped_placeholder_count: parsed.skippedPlaceholders.length,
    holidays: parsed.holidays.map((holiday) => ({ date: holiday.date, label: holiday.label })),
    tasks: parsed.rows.map((row) => ({
      name: row.name,
      group_name: row.groupName,
      contractor_type: row.contractorType,
      contractor_name: row.contractorName,
      sort_order: row.sortOrder,
      mpp_unique_id: row.mppUniqueId,
      mpp_wbs: row.wbs,
      outline_number: row.outlineNumber,
      pct_complete: row.pctComplete,
      days: row.days,
    })),
  };
}
