import { STATUS_STYLE, type TimeOffStatus } from "@/lib/timeOff";

/** Coloured status pill shown on every request card. */
export const StatusBadge = ({ status }: { status: TimeOffStatus }) => (
  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STATUS_STYLE[status]}`}>{status}</span>
);
