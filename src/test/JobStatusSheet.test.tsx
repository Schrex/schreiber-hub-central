import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { JobStatusSheet, type StatusSheetJob } from "@/components/jobs/JobStatusSheet";
import { todayInNewYork } from "@/lib/jobs";

const job = (over: Partial<StatusSheetJob> = {}): StatusSheetJob => ({
  id: "synthetic-job",
  name: "Synthetic Job",
  job_number: "S-1",
  status: "active",
  hold_reason: null,
  completed_at: null,
  ...over,
});

function renderSheet(over: Partial<StatusSheetJob> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<JobStatusSheet job={job(over)} open onOpenChange={() => {}} onSubmit={onSubmit} />);
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
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ status: "on_hold", hold_reason: null, completed_at: null }));
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
});
