import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { JobStatusSheet, type StatusSheetJob } from "@/components/jobs/JobStatusSheet";
import { todayInNewYork } from "@/lib/jobs";
import type { FutureReferenceCounts } from "@/lib/jobStatusChange";

const job = (over: Partial<StatusSheetJob> = {}): StatusSheetJob => ({
  id: "synthetic-job",
  name: "Synthetic Job",
  job_number: "S-1",
  status: "active",
  hold_reason: null,
  completed_at: null,
  ...over,
});

function renderSheet(
  over: Partial<StatusSheetJob> = {},
  futureRefs: FutureReferenceCounts | null = { assignments: 0, tiles: 0 },
  futureRefsFailed = false,
) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <JobStatusSheet
      job={job(over)}
      futureRefs={futureRefs}
      futureRefsFailed={futureRefsFailed}
      open
      onOpenChange={() => {}}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit, save: () => screen.getByRole("button", { name: "Save" }) };
}

afterEach(cleanup);

describe("JobStatusSheet", () => {
  it("explains every status and keeps Save disabled while the current status is chosen", () => {
    const { save } = renderSheet();
    expect(screen.getByRole("radio", { name: /Active/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /On hold/ })).toHaveTextContent(/pickers/i);
    expect(screen.getByRole("radio", { name: /Complete/ })).toHaveTextContent(/Archive/);
    expect(save()).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /On hold/ }));
    expect(save()).toBeEnabled();
    fireEvent.click(screen.getByRole("radio", { name: /Active/ }));
    expect(save()).toBeDisabled();
  });

  it("asks for a hold reason and stores a blank one as none", async () => {
    const { onSubmit, save } = renderSheet();
    fireEvent.click(screen.getByRole("radio", { name: /On hold/ }));
    expect(screen.getByLabelText(/Reason/)).toBeInTheDocument();
    fireEvent.click(save());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(
      { status: "on_hold", hold_reason: null, completed_at: null },
      { removeFuture: false },
    ));
  });

  it("defaults the completion date to today and refuses future dates", () => {
    const { save } = renderSheet();
    fireEvent.click(screen.getByRole("radio", { name: /Complete/ }));
    const date = screen.getByLabelText("Completed on");
    const today = todayInNewYork();
    expect(date).toHaveValue(today);
    expect(date).toHaveAttribute("max", today);
    expect(save()).toBeEnabled();
    fireEvent.change(date, { target: { value: "2999-01-01" } });
    expect(save()).toBeDisabled();
  });

  it("warns that completing Shop removes it from the Schedule board", () => {
    renderSheet({ name: "Shop" });
    expect(screen.queryByText(/Schedule board/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Complete/ }));
    expect(screen.getByText(/leave the Schedule board/)).toBeInTheDocument();
  });

  it("offers, checked by default, to remove future assignments and tiles when leaving active", async () => {
    const { onSubmit, save } = renderSheet({}, { assignments: 3, tiles: 1 });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Complete/ }));
    const option = screen.getByRole("checkbox", { name: "Remove 3 future assignments and 1 whiteboard tile" });
    expect(option).toBeChecked();
    expect(screen.getByText(/Undo does not restore removed assignments or tiles/)).toBeInTheDocument();
    fireEvent.click(save());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ status: "complete" }), { removeFuture: true }));
  });

  it("keeps future entries when the option is unchecked", async () => {
    const { onSubmit, save } = renderSheet({}, { assignments: 1, tiles: 2 });
    fireEvent.click(screen.getByRole("radio", { name: /On hold/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Remove 1 future assignment and 2 whiteboard tiles" }));
    fireEvent.click(save());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ status: "on_hold" }), { removeFuture: false }));
  });

  it("offers no cleanup when nothing is scheduled ahead or the job is not leaving active", () => {
    renderSheet({}, { assignments: 0, tiles: 0 });
    fireEvent.click(screen.getByRole("radio", { name: /Complete/ }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    cleanup();
    renderSheet({ status: "on_hold" }, { assignments: 2, tiles: 2 });
    fireEvent.click(screen.getByRole("radio", { name: /Complete/ }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("keeps Save disabled while future entries are still being counted, so cleanup can't be skipped", () => {
    const { save } = renderSheet({}, null);
    fireEvent.click(screen.getByRole("radio", { name: /Complete/ }));
    expect(screen.getByText(/Checking future schedule entries/)).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it("allows saving without cleanup when counting failed, and says cleanup is unavailable", async () => {
    const { onSubmit, save } = renderSheet({}, null, true);
    fireEvent.click(screen.getByRole("radio", { name: /On hold/ }));
    expect(screen.getByText(/cleanup is unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(save()).toBeEnabled();
    fireEvent.click(save());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ status: "on_hold" }), { removeFuture: false }));
  });
});
