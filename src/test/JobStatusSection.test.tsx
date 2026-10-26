import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { JobStatusSection, type StatusSectionJob } from "@/components/jobs/JobStatusSection";

const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), apply: vi.fn(), undo: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@/components/jobs/jobsQueries", () => ({ fetchDisplayNames: vi.fn().mockResolvedValue(new Map()) }));
vi.mock("@/lib/jobStatusChange", () => ({
  applyJobStatusChange: mocks.apply,
  undoJobStatusChange: mocks.undo,
  countFutureReferences: vi.fn().mockResolvedValue({ assignments: 0, tiles: 0 }),
  removeFutureReferences: vi.fn(),
}));

const job = (over: Partial<StatusSectionJob> = {}): StatusSectionJob => ({
  id: "synthetic-job",
  name: "Synthetic Job",
  job_number: "S-1",
  status: "complete",
  hold_reason: null,
  completed_at: null,
  completed_by: "synthetic-closer",
  ...over,
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("JobStatusSection", () => {
  it("reopening a completed job confirms without Undo (undo would rewrite who and when it was completed)", async () => {
    mocks.apply.mockResolvedValue({ status: "active", hold_reason: null, completed_at: null, completed_by: null });
    const onChanged = vi.fn();
    render(<JobStatusSection job={job()} canChangeStatus onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalled());
    const [, options] = mocks.success.mock.calls[0];
    expect(options?.action).toBeUndefined();
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
  });
});
