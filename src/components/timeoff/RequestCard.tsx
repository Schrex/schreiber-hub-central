import { Button } from "@/components/ui/button";
import { renderRange, TYPE_LABEL, type TimeOffRequest } from "@/lib/timeOff";
import { StatusBadge } from "./StatusBadge";

interface Props {
  request: TimeOffRequest;
  onCancel: (id: string) => void;
}

/** The requester's own request card (My Requests tab). */
export const RequestCard = ({ request: r, onCancel }: Props) => (
  <div className="rounded-xl border border-border bg-surface p-3">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-display text-base uppercase tracking-wide">{TYPE_LABEL[r.type]}</p>
        <p className="text-xs text-muted-foreground">{renderRange(r)}</p>
      </div>
      <StatusBadge status={r.status} />
    </div>
    {r.reason && <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{r.reason}</p>}
    {r.status === "denied" && r.denial_reason && (
      <p className="mt-2 text-xs text-destructive">Reason: {r.denial_reason}</p>
    )}
    {r.status === "pending" && (
      <Button size="sm" variant="ghost" className="mt-2 h-7 text-xs text-muted-foreground" onClick={() => onCancel(r.id)}>
        Cancel request
      </Button>
    )}
  </div>
);
