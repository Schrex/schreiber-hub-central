import { describe, expect, it } from "vitest";
import { profileEmails } from "../../supabase/functions/_shared/profileEmails";

describe("notification profile recipients", () => {
  it("reads both single and multiple joined profiles", () => {
    expect(profileEmails({ email: "office@example.test" })).toEqual(["office@example.test"]);
    expect(profileEmails([{ email: "office@example.test" }, { email: "admin@example.test" }]))
      .toEqual(["office@example.test", "admin@example.test"]);
  });
  it("ignores absent and malformed emails without breaking notification processing", () => {
    for (const value of [null, undefined, [], {}, "invalid", { email: 42 }, { email: "" }]) {
      expect(profileEmails(value)).toEqual([]);
    }
    expect(profileEmails([null, { email: "invalid" }, { email: "office@example.test" }]))
      .toEqual(["office@example.test"]);
  });
});
