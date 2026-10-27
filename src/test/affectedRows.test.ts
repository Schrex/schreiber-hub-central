import { describe, expect, it } from "vitest";
import { requireAffectedRows } from "@/lib/affectedRows";

describe("requireAffectedRows", () => {
  it("returns the changed rows", async () => {
    const rows = [{ id: "a" }, { id: "b" }];
    await expect(requireAffectedRows(Promise.resolve({ data: rows, error: null }))).resolves.toEqual(rows);
  });

  it("treats 0 changed rows as a permission error", async () => {
    await expect(requireAffectedRows(Promise.resolve({ data: [], error: null }))).rejects.toThrow(
      "You don't have permission to make this change.",
    );
  });

  it("treats a null result as a permission error with the caller's message", async () => {
    await expect(
      requireAffectedRows(Promise.resolve({ data: null, error: null }), "You can't edit this contact."),
    ).rejects.toThrow("You can't edit this contact.");
  });

  it("rethrows the database error unchanged", async () => {
    const dbError = { message: "duplicate key value violates unique constraint", code: "23505" };
    await expect(requireAffectedRows(Promise.resolve({ data: null, error: dbError }))).rejects.toBe(dbError);
  });
});
