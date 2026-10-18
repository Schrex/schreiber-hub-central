import { describe, expect, it } from "vitest";
import { errorMessage as frontendErrorMessage } from "./errorMessage";
import { errorMessage as edgeErrorMessage } from "../../supabase/functions/_shared/errorMessage";

describe.each([["frontend", frontendErrorMessage], ["edge", edgeErrorMessage]] as const)("%s errorMessage", (_, errorMessage) => {
  it("preserves native and API error messages", () => {
    expect(errorMessage(new Error("Upload failed"), "Fallback")).toBe("Upload failed");
    expect(errorMessage({ message: "Permission denied", code: "42501" }, "Fallback")).toBe("Permission denied");
    expect(errorMessage({ message: "" }, "Fallback")).toBe("");
  });

  it.each([null, undefined, "failure", 42, {}, { message: 42 }, { message: null }])(
    "uses the workflow fallback for non-message values: %j",
    (value) => expect(errorMessage(value, "Could not save")).toBe("Could not save"),
  );
});
