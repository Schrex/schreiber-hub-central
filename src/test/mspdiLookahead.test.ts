import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseMspdi } from "@/lib/mspdiLookahead";

const xml = readFileSync(path.resolve(__dirname, "../../e2e/fixtures/cobblestone.mspdi.xml"), "utf8");

describe("MSPDI look-ahead parser", () => {
  const parsed = parseMspdi(xml, "2026-11-05");
  const row = (name: string) => parsed.rows.find((item) => item.name === name);

  it("marks a half day as one X and keeps the trade and resource", () => {
    expect(row("Inlet protection")).toMatchObject({
      groupName: "Start-up/Erosion control",
      contractorName: "Schreiber",
      contractorType: "schreiber",
      days: ["2026-11-02"],
    });
    expect(row("Construction entrence")?.days).toEqual(["2026-11-02"]);
  });

  it("skips parked placeholders and keeps sequenced leaves", () => {
    expect(parsed.skippedPlaceholders).toEqual(expect.arrayContaining([
      "Respread topsoil (open areas)",
      "Respread topsoil (tight areas)",
      "Excavate",
      "Install Light bases w/ conduit",
      "Layout",
      "Curb prep",
      "Curbs",
    ]));
    expect(parsed.rows.map((item) => item.name)).not.toContain("Curbs");
    expect(parsed.rows.map((item) => item.name)).not.toContain("Excavate");
    expect(row("Clearing tree area")).toBeUndefined();
  });

  it("drops Thanksgiving from working days and records those dates as holidays", () => {
    expect(row("Hot Box")?.days).toEqual(["2026-11-20", "2026-11-23", "2026-11-24", "2026-11-25"]);
    expect(parsed.holidays).toEqual([
      { date: "2026-11-26", label: "Thanksgiving" },
      { date: "2026-11-27", label: "Thanksgiving" },
    ]);
    expect(parsed.weekStart).toBe("2026-11-02");
    expect(parsed.weeks).toBe(4);
    expect(row("Strip Topsoil")?.days).toEqual(["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-09"]);
  });

  it("does not keep cost or rate figures from the XML", () => {
    expect(xml).toContain("987654.32");
    expect(xml).toContain("<StandardRate>55.55</StandardRate>");
    const encoded = JSON.stringify(parsed);
    expect(encoded).not.toContain("987654.32");
    expect(encoded).not.toContain("55.55");
    expect(encoded).not.toMatch(/"(cost|rate|price|billing)"/i);
  });
});
