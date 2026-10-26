import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";

describe("JobStatusBadge", () => {
  it("shows the human label for each status", () => {
    render(
      <>
        <JobStatusBadge status="active" />
        <JobStatusBadge status="on_hold" />
        <JobStatusBadge status="complete" />
      </>,
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("On hold")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });
});
