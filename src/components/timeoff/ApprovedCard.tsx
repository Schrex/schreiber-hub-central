import { format, parseISO } from "date-fns";
import { renderRange, TYPE_LABEL, type TimeOffRequest } from "@/lib/timeOff";
import { StatusBadge } from "./StatusBadge";

/** An approved request in the admin's Approved tab. */
export const ApprovedCard = ({ request: r }: { request: TimeOffRequest }) => (
  <div className="rounded-xl border border-border bg-surface p-3">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-display text-base uppercase tracking-wide truncate">{r.requester_name ?? "Employee"}</p>
        <p className="text-xs text-muted-foreground">{TYPE_LABEL[r.type]} · {renderRange(r)}</p>
      </div>
      <StatusBadge status={r.status} />
    </div>
    {r.invites_sent_at && <p className="mt-1 text-[10px] text-muted-foreground">Invites sent {format(parseISO(r.invites_sent_at), "MMM d, p")}</p>}
  </div>
);
