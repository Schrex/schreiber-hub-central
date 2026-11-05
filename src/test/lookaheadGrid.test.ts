import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildLookaheadRows,
  isParkedPlaceholder,
  mapContractor,
  planColumns,
  workingDatesInSpan,
  type ScheduleLeaf,
} from "@/lib/lookaheadGrid";

const root = path.resolve(__dirname, "../..");

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function tasksFromCsv(text: string): ScheduleLeaf[] {
  const table = parseCsv(text).filter((record) => record.some((value) => value.length > 0));
  const header = table[0];
  const index = (name: string) => {
    const found = header.indexOf(name);
    if (found < 0) throw new Error(`missing ${name}`);
    return found;
  };
  const column = {
    unique: index("unique_id"),
    wbs: index("wbs"),
    outline: index("outline_number"),
    name: index("name"),
    start: index("start"),
    finish: index("finish"),
    pct: index("pct_complete"),
    summary: index("summary"),
    predecessors: index("predecessors"),
    resources: index("resources"),
    parent: index("parent_task_name"),
  };
  return table.slice(1).map((record) => ({
    name: record[column.name] ?? "",
    start: record[column.start] ?? "",
    finish: record[column.finish] ?? "",
    pctComplete: Number(record[column.pct] ?? 0),
    summary: (record[column.summary] ?? "").toLowerCase() === "true",
    predecessors: record[column.predecessors] ?? "",
    resources: record[column.resources] ?? "",
    parentName: record[column.parent] ?? "",
    uniqueId: record[column.unique] ? Number(record[column.unique]) : null,
    outlineNumber: record[column.outline] ?? "",
    wbs: record[column.wbs] ?? "",
  }));
}

function readTree(target: string): string {
  const info = statSync(target);
  if (info.isFile()) return readFileSync(target, "utf8");
  return readdirSync(target)
    .map((name) => readTree(path.join(target, name)))
    .join("\n");
}

const csv = readFileSync(path.join(root, "e2e/fixtures/cobblestone-tasks.csv"), "utf8");
const tasks = tasksFromCsv(csv);
const golden = JSON.parse(readFileSync(path.join(root, "e2e/fixtures/cobblestone-lookahead-nov9.json"), "utf8")) as {
  weekStart: string;
  weeks: number;
  holidays: string[];
  rows: { name: string; group: string; who: string; contractorType: string; days: string[] }[];
  skippedPlaceholders: string[];
};

describe("lookahead day expansion", () => {
  it("marks a half day as one X and skips weekends", () => {
    expect(workingDatesInSpan("2026-11-02T08:00", "2026-11-02T12:00", new Set())).toEqual(["2026-11-02"]);
    expect(workingDatesInSpan("2026-11-19T13:00", "2026-11-19T17:00", new Set())).toEqual(["2026-11-19"]);
    expect(workingDatesInSpan("2026-11-06T08:00", "2026-11-09T17:00", new Set())).toEqual([
      "2026-11-06",
      "2026-11-09",
    ]);
  });

  it("drops Thanksgiving from working days and keeps the weekday before it", () => {
    const holidays = new Set(["2026-11-26", "2026-11-27"]);
    expect(workingDatesInSpan("2026-11-25T08:00", "2026-11-27T17:00", holidays)).toEqual(["2026-11-25"]);
    expect(planColumns("2026-11-09", 3)).toContain("2026-11-26");
    expect(planColumns("2026-11-09", 3)).toContain("2026-11-27");
  });

  it("maps Craft, Schreiber, and Hynes onto the contractor column", () => {
    expect(mapContractor("Schreiber")).toEqual({ contractorType: "schreiber", contractorName: "Schreiber" });
    expect(mapContractor("Craft")).toEqual({ contractorType: "crew", contractorName: "Craft" });
    expect(mapContractor("Hynes")).toEqual({ contractorType: "sub", contractorName: "Hynes" });
  });

  it("builds the published Nov 9–27 Cobblestone grid from leaf tasks", () => {
    const projectStart = tasks[0].start.slice(0, 10);
    expect(projectStart).toBe("2026-10-23");
    const rows = buildLookaheadRows(tasks, {
      projectStartDate: projectStart,
      weekStart: golden.weekStart,
      weeks: golden.weeks,
      holidays: golden.holidays,
    });
    expect(rows.map((row) => ({
      name: row.name,
      group: row.groupName,
      who: row.contractorName,
      contractorType: row.contractorType,
      days: row.days,
    }))).toEqual(golden.rows);
    for (const name of golden.skippedPlaceholders) {
      expect(rows.map((row) => row.name)).not.toContain(name);
    }
    expect(rows.map((row) => row.name)).not.toContain('6" DIP');
  });

  it("skips parked placeholders and still keeps sequenced work on the project start", () => {
    const projectStart = "2026-10-23";
    const curbs = tasks.find((task) => task.name === "Curbs");
    const clearing = tasks.find((task) => task.name === "Clearing tree area");
    expect(curbs && isParkedPlaceholder(curbs, projectStart)).toBe(true);
    expect(clearing && isParkedPlaceholder(clearing, projectStart)).toBe(false);
    const rows = buildLookaheadRows(tasks, {
      projectStartDate: projectStart,
      weekStart: "2026-10-19",
      weeks: 3,
      holidays: [],
    });
    const clearingRow = rows.find((row) => row.name === "Clearing tree area");
    expect(clearingRow).toMatchObject({
      contractorName: "Craft",
      contractorType: "crew",
      days: ["2026-10-23", "2026-10-26"],
    });
    expect(rows.find((row) => row.name === "Silt femce")?.days).toEqual(["2026-10-30"]);
    for (const name of golden.skippedPlaceholders) {
      expect(rows.map((row) => row.name)).not.toContain(name);
    }
  });
});

describe("lookahead fixtures omit money columns", () => {
  it("keeps cost, rate, and price fields out of the feature paths and seed", () => {
    const header = csv.split(/\r?\n/, 1)[0].toLowerCase().split(",");
    for (const banned of ["cost", "rate", "price", "billing", "amount", "pay_rate"]) {
      expect(header).not.toContain(banned);
    }
    const feature = [
      readTree(path.join(root, "src/lib/lookaheadGrid.ts")),
      readTree(path.join(root, "src/components/jobs/lookahead")),
      readFileSync(path.join(root, "src/components/jobs/JobDetailTabs.tsx"), "utf8"),
    ].join("\n");
    expect(feature).not.toMatch(/\b(pay_rate|billing_rate|unit_price|hourly_rate)\b|\$\d/);
    expect(feature).not.toMatch(/select\([^)]*\b(rate|price|cost|billing)\b/i);
    const seed = readFileSync(path.join(root, "local/seed.sql"), "utf8");
    const start = seed.indexOf("-- BEGIN lookahead seed");
    const end = seed.indexOf("-- END lookahead seed");
    expect(start).toBeGreaterThan(-1);
    const region = seed.slice(start, end);
    expect(region).not.toMatch(/\$\d|\b(pay_rate|billing_rate|unit_price)\b/);
    for (const row of golden.rows) {
      expect(region).toContain(`'${row.name}'`);
      for (const day of row.days) expect(region).toContain(`'${day}'`);
    }
    for (const day of golden.holidays) expect(region).toContain(`'${day}'`);
    for (const name of golden.skippedPlaceholders) expect(region).not.toContain(name);
    expect(region).not.toContain('6" DIP');
  });
});
