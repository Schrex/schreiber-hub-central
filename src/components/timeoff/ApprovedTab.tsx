import type { TimeOffRequest } from "@/lib/timeOff";
import { ApprovedCard } from "./ApprovedCard";
import { EmptyState } from "./EmptyState";

/** Body of the admin "Approved" tab. */
export const ApprovedTab = ({ approved, loading }: { approved: TimeOffRequest[]; loading: boolean }) => (
  <>
    {!loading && approved.length === 0 && <EmptyState>No approved requests.</EmptyState>}
    {approved.map((r) => <ApprovedCard key={r.id} request={r} />)}
  </>
);
