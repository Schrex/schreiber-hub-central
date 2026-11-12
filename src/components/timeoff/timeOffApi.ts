import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { renderRange, TYPE_LABEL, type HalfDay, type TimeOffRequest, type TimeOffType } from "@/lib/timeOff";

/**
 * Every time off read/write the page makes, in one place. Each function returns the Supabase
 * error (or throws, for the decision writes) so callers keep their own toasts.
 */

/** All requests RLS lets the viewer see (own rows, or every row for an admin), by start date. */
export async function fetchTimeOffRequests() {
  const { data, error } = await supabase
    .from("time_off_requests")
    .select("*")
    .order("start_date", { ascending: true });
  return { items: (data as TimeOffRequest[]) ?? [], error };
}

export interface NewTimeOffRequest {
  userId: string;
  requesterName: string | null;
  type: TimeOffType;
  startDate: Date;
  endDate: Date;
  halfDay: HalfDay;
  reason: string;
}

export async function submitTimeOffRequest(r: NewTimeOffRequest) {
  const { error } = await supabase.from("time_off_requests").insert({
    user_id: r.userId,
    requester_name: r.requesterName,
    type: r.type,
    start_date: format(r.startDate, "yyyy-MM-dd"),
    end_date: format(r.endDate, "yyyy-MM-dd"),
    half_day: r.halfDay,
    reason: r.reason.trim() || null,
  });
  if (error) throw error;
}

export async function cancelTimeOffRequest(id: string) {
  const { error } = await supabase.from("time_off_requests").update({ status: "cancelled" }).eq("id", id);
  return { error };
}

export async function approveTimeOffRequest(id: string, deciderId: string | undefined) {
  const { error } = await supabase.from("time_off_requests").update({
    status: "approved",
    decided_by: deciderId,
    decided_at: new Date().toISOString(),
    denial_reason: null,
  }).eq("id", id);
  if (error) throw error;
}

export async function denyTimeOffRequest(id: string, deciderId: string | undefined, reason: string) {
  const { error } = await supabase.from("time_off_requests").update({
    status: "denied",
    decided_by: deciderId,
    decided_at: new Date().toISOString(),
    denial_reason: reason.trim() || null,
  }).eq("id", id);
  if (error) throw error;
}

/**
 * Browser-sent "time off approved" email to admins, foremen and the current Equipment Manager.
 * Best effort: failures are logged, never thrown. (Spec #61 moves this server-side.)
 */
export async function notifyTeamOfApproval(req: TimeOffRequest, decidedBy: string) {
  try {
    const [{ data: roleRows }, { data: posRows }] = await Promise.all([
      supabase.from("user_roles").select("user_id, role").in("role", ["admin", "foreman"]),
      supabase
        .from("employee_positions")
        .select("user_id, positions!inner(title), end_date")
        .eq("positions.title", "Equipment Manager")
        .is("end_date", null),
    ]);
    const userIds = new Set<string>();
    (roleRows ?? []).forEach((r) => r.user_id && userIds.add(r.user_id));
    (posRows ?? []).forEach((r) => r.user_id && userIds.add(r.user_id));
    if (userIds.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, email, display_name")
        .in("user_id", Array.from(userIds));
      const recipients = (profs ?? []).filter((p) => p.email);
      const dateRange = renderRange(req);
      await Promise.all(
        recipients.map((p) =>
          supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "time-off-approved",
              recipientEmail: p.email,
              idempotencyKey: `time-off-approved-${req.id}-${p.user_id}`,
              templateData: {
                requesterName: req.requester_name ?? "Employee",
                type: TYPE_LABEL[req.type],
                dateRange,
                halfDay: req.half_day !== "none" ? req.half_day.toUpperCase() : "",
                reason: req.reason ?? "",
                decidedBy,
              },
            },
          }),
        ),
      );
    }
  } catch (notifyErr) {
    console.error("Failed to send approval notifications", notifyErr);
  }
}
