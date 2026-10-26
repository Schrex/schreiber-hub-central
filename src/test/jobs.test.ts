import { describe, expect, it } from "vitest";
import { completedAtForDate, countPeopleByJob, formatNewYorkDate, ilikeOrFilter, isDispatchPickable, jobStatusBadge, groupArchiveByYear, sortActiveJobs, todayInNewYork, tileDate, mondayOf, isTileAfter, isShopJob } from "@/lib/jobs";

describe("todayInNewYork", () => {
  it("is still the previous day in New York just after midnight UTC", () => {
    expect(todayInNewYork(new Date("2026-10-27T00:30:00Z"))).toBe("2026-10-26");
  });

  it("rolls over at midnight Eastern, not UTC (EDT)", () => {
    // 8pm EDT = 00:00 UTC next day
    expect(todayInNewYork(new Date("2026-07-04T23:59:00Z"))).toBe("2026-07-04");
    expect(todayInNewYork(new Date("2026-07-05T03:59:00Z"))).toBe("2026-07-04");
    expect(todayInNewYork(new Date("2026-07-05T04:00:00Z"))).toBe("2026-07-05");
  });

  it("handles 8pm Eastern in winter (EST)", () => {
    // 8pm EST = 01:00 UTC next day
    expect(todayInNewYork(new Date("2026-01-16T01:00:00Z"))).toBe("2026-01-15");
    expect(todayInNewYork(new Date("2026-01-16T05:00:00Z"))).toBe("2026-01-16");
  });
});

describe("sortActiveJobs", () => {
  it("lists running jobs before on-hold jobs, newest start date first, unknown start last", () => {
    const jobs = [
      { id: "hold-new", status: "on_hold" as const, start_date: "2026-09-01" },
      { id: "run-old", status: "active" as const, start_date: "2025-03-10" },
      { id: "run-none", status: "active" as const, start_date: null },
      { id: "run-new", status: "active" as const, start_date: "2026-08-15" },
      { id: "hold-old", status: "on_hold" as const, start_date: "2024-05-01" },
    ];
    expect(sortActiveJobs(jobs).map((j) => j.id)).toEqual([
      "run-new", "run-old", "run-none", "hold-new", "hold-old",
    ]);
  });

  it("does not mutate its input", () => {
    const jobs = [
      { id: "b", status: "on_hold" as const, start_date: null },
      { id: "a", status: "active" as const, start_date: null },
    ];
    sortActiveJobs(jobs);
    expect(jobs.map((j) => j.id)).toEqual(["b", "a"]);
  });
});

describe("groupArchiveByYear", () => {
  it("groups by New York completion year, newest year first, with 'Date unknown' last", () => {
    const rows = [
      { id: "a", completed_at: "2026-06-01T15:00:00Z" },
      { id: "unknown-1", completed_at: null },
      { id: "b", completed_at: "2026-01-01T03:00:00Z" }, // Dec 31 2025, 10pm EST
      { id: "c", completed_at: "2024-11-20T12:00:00Z" },
      { id: "unknown-2", completed_at: null },
      { id: "d", completed_at: "2026-01-01T06:00:00Z" }, // Jan 1 2026 in NY
    ];
    expect(groupArchiveByYear(rows).map((g) => [g.label, g.jobs.map((j) => j.id)])).toEqual([
      ["2026", ["a", "d"]],
      ["2025", ["b"]],
      ["2024", ["c"]],
      ["Date unknown", ["unknown-1", "unknown-2"]],
    ]);
  });

  it("returns no groups for no rows", () => {
    expect(groupArchiveByYear([])).toEqual([]);
  });
});

describe("countPeopleByJob", () => {
  it("counts distinct people per job", () => {
    const assignments = [
      { job_id: "j1", user_id: "u1" },
      { job_id: "j1", user_id: "u2" },
      { job_id: "j1", user_id: "u1" }, // same person twice on one job
      { job_id: "j2", user_id: "u1" }, // same person on another job counts there too
    ];
    const counts = countPeopleByJob(assignments);
    expect(counts.get("j1")).toBe(2);
    expect(counts.get("j2")).toBe(1);
  });

  it("has no entry for jobs nobody is assigned to", () => {
    expect(countPeopleByJob([]).get("j1")).toBeUndefined();
  });
});

describe("jobStatusBadge", () => {
  it("maps each status to its label and visual tone", () => {
    expect(jobStatusBadge("active")).toMatchObject({ label: "Active", tone: "solid" });
    expect(jobStatusBadge("on_hold")).toMatchObject({ label: "On hold", tone: "outline" });
    expect(jobStatusBadge("complete")).toMatchObject({ label: "Complete", tone: "muted" });
  });

  it("gives every status a distinct style", () => {
    const classes = (["active", "on_hold", "complete"] as const).map((s) => jobStatusBadge(s).className);
    expect(new Set(classes).size).toBe(3);
  });
});

describe("ilikeOrFilter", () => {
  it("builds a contains match across columns", () => {
    expect(ilikeOrFilter(["name", "job_number"], "main st")).toBe('name.ilike."*main st*",job_number.ilike."*main st*"');
  });

  it("quotes commas and parentheses so they cannot split or nest the or filter", () => {
    expect(ilikeOrFilter(["name"], "Smith, Inc (Phase 2)")).toBe('name.ilike."*Smith, Inc (Phase 2)*"');
  });

  it("makes user wildcards literal", () => {
    // % and _ are LIKE wildcards: escaped with a backslash, which is itself escaped inside the quoted value.
    expect(ilikeOrFilter(["name"], "50%_off")).toBe('name.ilike."*50\\\\%\\\\_off*"');
    // * is PostgREST's wildcard and cannot be escaped, so it is dropped.
    expect(ilikeOrFilter(["name"], "a*b")).toBe('name.ilike."*ab*"');
  });

  it("escapes double quotes and backslashes", () => {
    expect(ilikeOrFilter(["name"], 'say "hi"')).toBe('name.ilike."*say \\"hi\\"*"');
    expect(ilikeOrFilter(["name"], "a\\b")).toBe('name.ilike."*a\\\\\\\\b*"');
  });

  it("trims surrounding whitespace", () => {
    expect(ilikeOrFilter(["name"], "  pond  ")).toBe('name.ilike."*pond*"');
  });
});

describe("completedAtForDate", () => {
  const now = new Date("2026-10-26T14:30:00Z"); // 10:30 EDT

  it("uses the current instant when completing today", () => {
    expect(completedAtForDate("2026-10-26", now)).toBe("2026-10-26T14:30:00.000Z");
  });

  it("stores a backdated day at midday so it stays on that New York date", () => {
    expect(completedAtForDate("2026-07-04", now)).toBe("2026-07-04T17:00:00.000Z");
    expect(completedAtForDate("2026-01-15", now)).toBe("2026-01-15T17:00:00.000Z");
  });
});

describe("formatNewYorkDate", () => {
  it("formats an instant as its New York calendar date", () => {
    expect(formatNewYorkDate("2025-06-15T16:00:00Z")).toBe("Jun 15, 2025");
    expect(formatNewYorkDate("2026-01-01T03:00:00Z")).toBe("Dec 31, 2025");
  });
});

describe("isDispatchPickable", () => {
  it("offers active jobs only for a new order", () => {
    expect(isDispatchPickable({ id: "a", status: "active" })).toBe(true);
    expect(isDispatchPickable({ id: "h", status: "on_hold" })).toBe(false);
    expect(isDispatchPickable({ id: "c", status: "complete" })).toBe(false);
  });

  it("keeps the job an existing order already points at", () => {
    expect(isDispatchPickable({ id: "c", status: "complete" }, "c")).toBe(true);
    expect(isDispatchPickable({ id: "h", status: "on_hold" }, "c")).toBe(false);
  });
});

describe("future whiteboard tiles", () => {
  it("dates a tile by its Monday week start plus day index", () => {
    expect(tileDate("2026-10-26", 0)).toBe("2026-10-26");
    expect(tileDate("2026-10-26", 6)).toBe("2026-11-01");
    expect(tileDate("2026-12-28", 5)).toBe("2027-01-02");
  });

  it("finds the Monday of the week containing a day", () => {
    expect(mondayOf("2026-10-26")).toBe("2026-10-26");
    expect(mondayOf("2026-10-28")).toBe("2026-10-26");
    expect(mondayOf("2026-11-01")).toBe("2026-10-26");
  });

  it("treats only tiles after today as future", () => {
    const today = "2026-10-28"; // Wednesday
    expect(isTileAfter({ week_start: "2026-10-26", day_index: 1 }, today)).toBe(false);
    expect(isTileAfter({ week_start: "2026-10-26", day_index: 2 }, today)).toBe(false);
    expect(isTileAfter({ week_start: "2026-10-26", day_index: 3 }, today)).toBe(true);
    expect(isTileAfter({ week_start: "2026-11-02", day_index: 0 }, today)).toBe(true);
  });
});

describe("isShopJob", () => {
  it("matches the Shop job ignoring case and surrounding spaces", () => {
    expect(isShopJob("Shop")).toBe(true);
    expect(isShopJob("  SHOP ")).toBe(true);
    expect(isShopJob("Shop Road")).toBe(false);
    expect(isShopJob(null)).toBe(false);
  });
});
