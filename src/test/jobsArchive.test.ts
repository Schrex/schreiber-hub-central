import { describe, expect, it } from "vitest";
import { archiveYearOptions, newYorkYear, newYorkYearRange } from "@/lib/jobs";

describe("newYorkYearRange", () => {
  it("spans New York midnight Jan 1 to the next Jan 1 (EST, UTC-5)", () => {
    expect(newYorkYearRange(2025)).toEqual({ start: "2025-01-01T05:00:00.000Z", end: "2026-01-01T05:00:00.000Z" });
  });

  it("puts New Year's Eve evening in New York in the old year, even though it is already next year in UTC", () => {
    const { start, end } = newYorkYearRange(2025);
    const nye = "2026-01-01T03:00:00Z"; // 10pm Dec 31 in New York
    const t = new Date(nye).getTime();
    expect(t >= new Date(start).getTime() && t < new Date(end).getTime()).toBe(true);
    expect(newYorkYear(nye)).toBe(2025);
  });
});

describe("archiveYearOptions", () => {
  const now = new Date("2026-10-26T15:00:00Z");

  it("lists every year from this New York year back to the oldest completion, newest first", () => {
    expect(archiveYearOptions("2023-06-01T12:00:00Z", now)).toEqual([2026, 2025, 2024, 2023]);
  });

  it("offers only this year when nothing has a completion date", () => {
    expect(archiveYearOptions(null, now)).toEqual([2026]);
  });

  it("uses the New York year of the oldest completion", () => {
    // 10pm Dec 31 2022 in New York
    expect(archiveYearOptions("2023-01-01T03:00:00Z", now).at(-1)).toBe(2022);
  });
});
