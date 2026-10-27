import { describe, expect, it } from "vitest";
import { judge } from "../../scripts/local-access-policy.mjs";
import { decide } from "@/lib/accessDecision";

const job = { foremanId: "assigned" };
const as = (id: string, roles: ("foreman" | "office")[]) => ({ userId: id, roles, previewRole: null });

describe("access policy probe verdicts", () => {
  it("probe and UI share one decision: explicit role set, or the assigned foreman when orJobForeman", () => {
    expect(decide({ roles: ["office", "admin"], rls: "ui-only" }, as("office", ["office"]), job)).toBe(true);
    expect(decide({ roles: ["office", "admin"], rls: "ui-only" }, as("assigned", ["foreman"]), job)).toBe(false);
    expect(decide({ roles: ["office", "admin"], orJobForeman: true, rls: "ui-only" }, as("assigned", ["foreman"]), job)).toBe(true);
    expect(decide({ roles: ["office", "admin"], orJobForeman: true, rls: "ui-only" }, as("other", ["foreman"]), job)).toBe(false);
  });

  it("matches when UI and RLS agree for every actor", () => {
    expect(judge({}, [{ actor: "office", ui: true, rls: true }, { actor: "foreman", ui: false, rls: false }]))
      .toEqual({ verdict: "match", actors: [] });
  });

  it("fails when the UI allows an actor RLS refuses, even with a narrower reason", () => {
    expect(judge({ narrower: "reason" }, [{ actor: "foreman", ui: true, rls: false }]))
      .toEqual({ verdict: "ui-exceeds-rls", actors: ["foreman"] });
  });

  it("accepts a wider RLS only when the rule records why it is narrower", () => {
    const probes = [{ actor: "foreman", ui: false, rls: true }];
    expect(judge({ narrower: "reason" }, probes)).toEqual({ verdict: "narrower", actors: ["foreman"] });
    expect(judge({}, probes)).toEqual({ verdict: "unrecorded-difference", actors: ["foreman"] });
  });
});
