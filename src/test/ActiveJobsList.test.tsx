import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ActiveJobsList } from "@/components/jobs/ActiveJobsList";
import type { JobCardRow } from "@/components/jobs/jobsQueries";

const mocks = vi.hoisted(() => ({ fetchActiveJobs: vi.fn(), fetchPeopleToday: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn() } }));
vi.mock("@/components/jobs/jobsQueries", () => ({
  fetchActiveJobs: mocks.fetchActiveJobs,
  fetchPeopleToday: mocks.fetchPeopleToday,
}));

const row = (over: Partial<JobCardRow>): JobCardRow => ({
  id: "synthetic-job",
  job_number: null,
  name: "Synthetic Job",
  address: null,
  status: "active",
  start_date: null,
  hold_reason: null,
  completed_at: null,
  customer: null,
  foreman_id: null,
  foreman_name: null,
  ...over,
});

const renderList = (refreshKey = 0) => (
  <MemoryRouter><ActiveJobsList canEdit={false} refreshKey={refreshKey} /></MemoryRouter>
);

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("ActiveJobsList", () => {
  it("still lists jobs when today's crew can't be loaded, without claiming nobody is scheduled", async () => {
    mocks.fetchActiveJobs.mockResolvedValue([row({ id: "a", name: "Synthetic Alpha" })]);
    mocks.fetchPeopleToday.mockRejectedValue(new Error("synthetic failure"));
    render(renderList());
    expect(await screen.findByText("Synthetic Alpha")).toBeInTheDocument();
    expect(await screen.findByText(/Couldn't load today's crew/)).toBeInTheDocument();
    expect(screen.queryByText(/No crew scheduled today/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Couldn't load jobs/)).not.toBeInTheDocument();
  });

  it("drops the previous crew counts while a refresh is reloading them", async () => {
    mocks.fetchActiveJobs.mockResolvedValue([row({ id: "a", name: "Synthetic Alpha" })]);
    mocks.fetchPeopleToday.mockResolvedValueOnce(new Map([["a", 3]]));
    const view = render(renderList(0));
    expect(await screen.findByText("3 people scheduled today")).toBeInTheDocument();
    mocks.fetchPeopleToday.mockReturnValueOnce(new Promise(() => {}));
    view.rerender(renderList(1));
    await waitFor(() => expect(mocks.fetchPeopleToday).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("3 people scheduled today")).not.toBeInTheDocument();
  });
});
