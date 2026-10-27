import { describe, expect, it } from "vitest";
import { judge, uiAllows } from "../../scripts/local-access-policy.mjs";

const foreman = { roles: ["foreman"], assignedForeman: false };
const assigned = { roles: ["foreman"], assignedForeman: true };
const office = { roles: ["office"], assignedForeman: false };

describe("access policy probe verdicts", () => {
  it("UI allows a role from its explicit set, or the assigned foreman when orJobForeman", () => {
    expect(uiAllows({ roles: ["office", "admin"] }, office)).toBe(true);
    expect(uiAllows({ roles: ["office", "admin"] }, assigned)).toBe(false);
    expect(uiAllows({ roles: ["office", "admin"], orJobForeman: true }, assigned)).toBe(true);
    expect(uiAllows({ roles: ["office", "admin"], orJobForeman: true }, foreman)).toBe(false);
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
