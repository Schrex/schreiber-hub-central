import { toast } from "sonner";
import type { TimeOffRequest } from "@/lib/timeOff";
import { EmptyState } from "./EmptyState";
import { RequestCard } from "./RequestCard";
import { cancelTimeOffRequest } from "./timeOffApi";

interface Props {
  items: TimeOffRequest[];
  loading: boolean;
  onChanged: () => void;
}

/** Body of the "My Requests" tab: the viewer's own requests, with cancel for pending ones. */
export const MyRequestsTab = ({ items, loading, onChanged }: Props) => {
  const cancelMine = async (id: string) => {
    const { error } = await cancelTimeOffRequest(id);
    if (error) return toast.error(error.message);
    toast.success("Cancelled");
    onChanged();
  };

  return (
    <>
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && items.length === 0 && <EmptyState>No requests yet — tap "Request" to submit one.</EmptyState>}
      {items.map((r) => <RequestCard key={r.id} request={r} onCancel={cancelMine} />)}
    </>
  );
};
