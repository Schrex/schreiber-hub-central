import { eachDayOfInterval, format, parseISO } from "date-fns";
import { z } from "zod";

/** Time off domain types, labels and pure helpers shared by the page and src/components/timeoff/. */

export type TimeOffStatus = "pending" | "approved" | "denied" | "cancelled";
export type TimeOffType = "vacation" | "sick" | "personal" | "other";
export type HalfDay = "none" | "am" | "pm";

/** A `time_off_requests` row as the Time Off page reads it (`select("*")`). */
export interface TimeOffRequest {
  id: string;
  user_id: string;
  requester_name: string | null;
  type: TimeOffType;
  start_date: string;
  end_date: string;
  half_day: HalfDay;
  reason: string | null;
  status: TimeOffStatus;
  denial_reason: string | null;
  decided_at: string | null;
  invites_sent_at: string | null;
  created_at: string;
}

export const STATUS_STYLE: Record<TimeOffStatus, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  approved: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  denied: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

/** Display label per type; its key order also drives the form's type options. */
export const TYPE_LABEL: Record<TimeOffType, string> = {
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  other: "Other",
};

export const timeOffFormSchema = z.object({
  type: z.enum(["vacation", "sick", "personal", "other"]),
  start_date: z.date(),
  end_date: z.date(),
  half_day: z.enum(["none", "am", "pm"]),
  reason: z.string().trim().max(1000).optional().or(z.literal("")),
}).refine((d) => d.end_date >= d.start_date, { message: "End date must be on or after start date", path: ["end_date"] })
  .refine((d) => d.half_day === "none" || d.start_date.getTime() === d.end_date.getTime(), {
    message: "Half-day applies to single-day requests only", path: ["half_day"],
  });

export const datesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  aStart <= bEnd && bStart <= aEnd;

/** Other people's approved requests whose dates overlap `req`. */
export const findConflicts = (items: TimeOffRequest[], req: TimeOffRequest) =>
  items.filter((r) =>
    r.id !== req.id &&
    r.user_id !== req.user_id &&
    r.status === "approved" &&
    datesOverlap(req.start_date, req.end_date, r.start_date, r.end_date),
  );

/** Whole days from today to `d`, both taken at local midnight (browser date). */
export const noticeDaysFromNow = (d: Date, now: Date = new Date()) => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

/** Date range text for a request card or dialog. The "N days" count is calendar days (T05 replaces it). */
export const renderRange = (r: Pick<TimeOffRequest, "start_date" | "end_date" | "half_day">) => {
  const s = parseISO(r.start_date);
  const e = parseISO(r.end_date);
  const same = r.start_date === r.end_date;
  const days = eachDayOfInterval({ start: s, end: e }).length;
  const halfTag = r.half_day !== "none" ? ` · ${r.half_day.toUpperCase()} half` : "";
  if (same) return `${format(s, "EEE, MMM d, yyyy")}${halfTag}`;
  return `${format(s, "MMM d")} → ${format(e, "MMM d, yyyy")} · ${days} days`;
};
