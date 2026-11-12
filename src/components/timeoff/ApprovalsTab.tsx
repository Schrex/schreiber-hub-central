import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errorMessage";
import { findConflicts, type TimeOffRequest } from "@/lib/timeOff";
import { ApprovalCard } from "./ApprovalCard";
import { ConflictDialog, type PendingApproval } from "./ConflictDialog";
import { DenyDialog } from "./DenyDialog";
import { EmptyState } from "./EmptyState";
import { approveTimeOffRequest, denyTimeOffRequest, notifyTeamOfApproval } from "./timeOffApi";

interface Props {
  /** Every visible request (conflicts are found among the approved ones). */
  items: TimeOffRequest[];
  /** Requests awaiting a decision. */
  pending: TimeOffRequest[];
  loading: boolean;
  deciderId: string | undefined;
  deciderName: string | null | undefined;
  onChanged: () => void;
}

/** Body of the admin "Approvals" tab: pending cards plus the approve-conflict and deny dialogs. */
export const ApprovalsTab = ({ items, pending, loading, deciderId, deciderName, onChanged }: Props) => {
  const [confirmApprove, setConfirmApprove] = useState<PendingApproval | null>(null);
  const [denyTarget, setDenyTarget] = useState<TimeOffRequest | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const doApprove = async (req: TimeOffRequest) => {
    setActingId(req.id);
    try {
      await approveTimeOffRequest(req.id, deciderId);
      toast.success("Approved");
      // Notify admins, foremen, and the current Equipment Manager
      await notifyTeamOfApproval(req, deciderName ?? "Admin");
      onChanged();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to approve"));
    } finally {
      setActingId(null);
      setConfirmApprove(null);
    }
  };

  const tryApprove = (req: TimeOffRequest) => {
    const conflicts = findConflicts(items, req);
    if (conflicts.length > 0) {
      setConfirmApprove({ req, conflicts });
    } else {
      doApprove(req);
    }
  };

  const doDeny = async (reason: string) => {
    if (!denyTarget) return;
    setActingId(denyTarget.id);
    try {
      await denyTimeOffRequest(denyTarget.id, deciderId, reason);
      toast.success("Denied");
      setDenyTarget(null); onChanged();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to deny"));
    } finally { setActingId(null); }
  };

  return (
    <>
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && pending.length === 0 && <EmptyState>No pending requests.</EmptyState>}
      {pending.map((r) => (
        <ApprovalCard
          key={r.id}
          request={r}
          conflicts={findConflicts(items, r)}
          acting={actingId === r.id}
          onApprove={tryApprove}
          onDeny={setDenyTarget}
        />
      ))}

      <ConflictDialog pending={confirmApprove} onClose={() => setConfirmApprove(null)} onConfirm={doApprove} />
      <DenyDialog target={denyTarget} busy={actingId === denyTarget?.id} onClose={() => setDenyTarget(null)} onConfirm={doDeny} />
    </>
  );
};
