import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { renderRange, TYPE_LABEL, type TimeOffRequest } from "@/lib/timeOff";
import { StatusBadge } from "./StatusBadge";

interface Props {
  request: TimeOffRequest;
  /** Other people's approved requests overlapping this one. */
  conflicts: TimeOffRequest[];
  /** A decision on this request is in flight. */
  acting: boolean;
  onApprove: (request: TimeOffRequest) => void;
  onDeny: (request: TimeOffRequest) => void;
}

/** A pending request awaiting an admin decision (Approvals tab). */
export const ApprovalCard = ({ request: r, conflicts, acting, onApprove, onDeny }: Props) => (
  <div className="rounded-xl border border-border bg-surface p-3">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-display text-base uppercase tracking-wide truncate">{r.requester_name ?? "Employee"}</p>
        <p className="text-xs text-muted-foreground">{TYPE_LABEL[r.type]} · {renderRange(r)}</p>
      </div>
      <StatusBadge status={r.status} />
    </div>
    {r.reason && <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{r.reason}</p>}
    {conflicts.length > 0 && (
      <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
        <span><strong>{conflicts.length}</strong> overlap{conflicts.length > 1 ? "s" : ""}: {conflicts.map((c) => c.requester_name ?? "Employee").join(", ")}</span>
      </div>
    )}
    <div className="mt-3 flex gap-2">
      <Button size="sm" className="flex-1" disabled={acting} onClick={() => onApprove(r)}>
        {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-1 h-4 w-4" /> Approve</>}
      </Button>
      <Button size="sm" variant="outline" className="flex-1" disabled={acting} onClick={() => onDeny(r)}>
        <X className="mr-1 h-4 w-4" /> Deny
      </Button>
    </div>
  </div>
);
