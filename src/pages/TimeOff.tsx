import { useResumeRefresh } from "@/hooks/useResumeRefresh";
import { errorMessage } from "@/lib/errorMessage";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Palmtree, AlertTriangle, Check, X, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { noticeFor } from "@/lib/timeOffNotice";
import { useAccess } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Status = "pending" | "approved" | "denied" | "cancelled";
type Type = "vacation" | "sick" | "personal" | "other";
type HalfDay = "none" | "am" | "pm";

interface TimeOff {
  id: string;
  user_id: string;
  requester_name: string | null;
  type: Type;
  start_date: string;
  end_date: string;
  half_day: HalfDay;
  reason: string | null;
  status: Status;
  denial_reason: string | null;
  decided_at: string | null;
  invites_sent_at: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<Status, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  approved: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  denied: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const TYPE_LABEL: Record<Type, string> = {
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  other: "Other",
};

const formSchema = z.object({
  type: z.enum(["vacation", "sick", "personal", "other"]),
  start_date: z.date(),
  end_date: z.date(),
  half_day: z.enum(["none", "am", "pm"]),
  reason: z.string().trim().max(1000).optional().or(z.literal("")),
}).refine((d) => d.end_date >= d.start_date, { message: "End date must be on or after start date", path: ["end_date"] })
  .refine((d) => d.half_day === "none" || d.start_date.getTime() === d.end_date.getTime(), {
    message: "Half-day applies to single-day requests only", path: ["half_day"],
  });

const datesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  aStart <= bEnd && bStart <= aEnd;

const TimeOffPage = () => {
  const { user, effectiveRole, displayName } = useAuth();
  const { can } = useAccess();
  const isAdmin = can("timeOff.approve");
  const notice = noticeFor(effectiveRole);
  const requiredNoticeDays = notice.days;
  const [items, setItems] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<string>(isAdmin ? "approvals" : "mine");

  // form state
  const [type, setType] = useState<Type>("vacation");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [halfDay, setHalfDay] = useState<HalfDay>("none");
  const [reason, setReason] = useState("");
  const [shortNoticeConfirm, setShortNoticeConfirm] = useState(false);

  // approval state
  const [confirmApprove, setConfirmApprove] = useState<{ req: TimeOff; conflicts: TimeOff[] } | null>(null);
  const [denyTarget, setDenyTarget] = useState<TimeOff | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("time_off_requests")
      .select("*")
      .order("start_date", { ascending: true });
    if (error) toast.error(error.message);
    setItems((data as TimeOff[]) ?? []);
    setLoading(false);
  };

  useResumeRefresh(load);

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setType("vacation"); setStartDate(undefined); setEndDate(undefined); setHalfDay("none"); setReason(""); setShortNoticeConfirm(false);
  };

  const noticeDaysFromNow = (d: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const performSubmit = async () => {
    if (!user || !startDate || !endDate) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("time_off_requests").insert({
        user_id: user.id,
        requester_name: displayName ?? null,
        type,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        half_day: halfDay,
        reason: reason.trim() || null,
      });
      if (error) throw error;
      toast.success("Request submitted");
      resetForm(); setOpen(false); setShortNoticeConfirm(false); load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to submit"));
    } finally { setBusy(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!startDate || !endDate) {
      toast.error("Pick start and end dates"); return;
    }
    const parsed = formSchema.safeParse({ type, start_date: startDate, end_date: endDate, half_day: halfDay, reason });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid"); return; }

    // Notice check (vacation/personal only — sick & other are exempt)
    const enforceNotice = type === "vacation" || type === "personal";
    if (enforceNotice) {
      const days = noticeDaysFromNow(startDate);
      if (days < requiredNoticeDays) {
        setShortNoticeConfirm(true);
        return;
      }
    }
    await performSubmit();
  };

  const cancelMine = async (id: string) => {
    const { error } = await supabase.from("time_off_requests").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cancelled");
    load();
  };

  const findConflicts = (req: TimeOff) =>
    items.filter((r) =>
      r.id !== req.id &&
      r.user_id !== req.user_id &&
      r.status === "approved" &&
      datesOverlap(req.start_date, req.end_date, r.start_date, r.end_date),
    );

  const tryApprove = (req: TimeOff) => {
    const conflicts = findConflicts(req);
    if (conflicts.length > 0) {
      setConfirmApprove({ req, conflicts });
    } else {
      doApprove(req);
    }
  };

  const doApprove = async (req: TimeOff) => {
    setActingId(req.id);
    try {
      const { error } = await supabase.from("time_off_requests").update({
        status: "approved",
        decided_by: user?.id,
        decided_at: new Date().toISOString(),
        denial_reason: null,
      }).eq("id", req.id);
      if (error) throw error;
      toast.success("Approved");

      // Notify admins, foremen, and the current Equipment Manager
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
          const decidedBy = displayName ?? "Admin";
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

      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to approve"));
    } finally {
      setActingId(null);
      setConfirmApprove(null);
    }
  };

  const doDeny = async () => {
    if (!denyTarget) return;
    setActingId(denyTarget.id);
    try {
      const { error } = await supabase.from("time_off_requests").update({
        status: "denied",
        decided_by: user?.id,
        decided_at: new Date().toISOString(),
        denial_reason: denyReason.trim() || null,
      }).eq("id", denyTarget.id);
      if (error) throw error;
      toast.success("Denied");
      setDenyTarget(null); setDenyReason(""); load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to deny"));
    } finally { setActingId(null); }
  };

  const myItems = useMemo(() => items.filter((r) => r.user_id === user?.id), [items, user?.id]);
  const pending = useMemo(() => items.filter((r) => r.status === "pending"), [items]);
  const approved = useMemo(() => items.filter((r) => r.status === "approved"), [items]);

  const renderRange = (r: TimeOff) => {
    const s = parseISO(r.start_date);
    const e = parseISO(r.end_date);
    const same = r.start_date === r.end_date;
    const days = eachDayOfInterval({ start: s, end: e }).length;
    const halfTag = r.half_day !== "none" ? ` · ${r.half_day.toUpperCase()} half` : "";
    if (same) return `${format(s, "EEE, MMM d, yyyy")}${halfTag}`;
    return `${format(s, "MMM d")} → ${format(e, "MMM d, yyyy")} · ${days} days`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl uppercase tracking-wide flex items-center gap-2">
              <Palmtree className="h-6 w-6 text-primary" /> Time Off
            </h1>
            <p className="text-sm text-muted-foreground">Request days off — admin approves and the team is notified.</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Request</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>New time off request</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as Type)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_LABEL) as Type[]).map((t) => (
                        <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Start date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start font-normal", !startDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "MMM d, yyyy") : "Pick"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); if (d && (!endDate || endDate < d)) setEndDate(d); }} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>End date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start font-normal", !endDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "MMM d, yyyy") : "Pick"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={endDate} onSelect={setEndDate} disabled={(d) => !!startDate && d < startDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div>
                  <Label>Half day (single-day only)</Label>
                  <Select value={halfDay} onValueChange={(v) => setHalfDay(v as HalfDay)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Full day(s)</SelectItem>
                      <SelectItem value="am">Morning (AM) only</SelectItem>
                      <SelectItem value="pm">Afternoon (PM) only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Reason (optional)</Label>
                  <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. family vacation" />
                </div>

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Submitting…" : "Submit request"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-5">
          <TabsList className={cn("grid w-full", isAdmin ? "grid-cols-3" : "grid-cols-1")}>
            {isAdmin && (
              <TabsTrigger value="approvals">
                Approvals {pending.length > 0 && <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{pending.length}</span>}
              </TabsTrigger>
            )}
            <TabsTrigger value="mine">My Requests</TabsTrigger>
            {isAdmin && <TabsTrigger value="approved">Approved</TabsTrigger>}
          </TabsList>

          {isAdmin && (
            <TabsContent value="approvals" className="mt-4 space-y-2">
              {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!loading && pending.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <p className="text-sm text-muted-foreground">No pending requests.</p>
                </div>
              )}
              {pending.map((r) => {
                const conflicts = findConflicts(r);
                return (
                  <div key={r.id} className="rounded-xl border border-border bg-surface p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display text-base uppercase tracking-wide truncate">{r.requester_name ?? "Employee"}</p>
                        <p className="text-xs text-muted-foreground">{TYPE_LABEL[r.type]} · {renderRange(r)}</p>
                      </div>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                    </div>
                    {r.reason && <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{r.reason}</p>}
                    {conflicts.length > 0 && (
                      <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                        <span><strong>{conflicts.length}</strong> overlap{conflicts.length > 1 ? "s" : ""}: {conflicts.map((c) => c.requester_name ?? "Employee").join(", ")}</span>
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" className="flex-1" disabled={actingId === r.id} onClick={() => tryApprove(r)}>
                        {actingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-1 h-4 w-4" /> Approve</>}
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" disabled={actingId === r.id} onClick={() => { setDenyTarget(r); setDenyReason(""); }}>
                        <X className="mr-1 h-4 w-4" /> Deny
                      </Button>
                    </div>
                  </div>
                );
              })}
            </TabsContent>
          )}

          <TabsContent value="mine" className="mt-4 space-y-2">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && myItems.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">No requests yet — tap "Request" to submit one.</p>
              </div>
            )}
            {myItems.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-base uppercase tracking-wide">{TYPE_LABEL[r.type]}</p>
                    <p className="text-xs text-muted-foreground">{renderRange(r)}</p>
                  </div>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                </div>
                {r.reason && <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{r.reason}</p>}
                {r.status === "denied" && r.denial_reason && (
                  <p className="mt-2 text-xs text-destructive">Reason: {r.denial_reason}</p>
                )}
                {r.status === "pending" && (
                  <Button size="sm" variant="ghost" className="mt-2 h-7 text-xs text-muted-foreground" onClick={() => cancelMine(r.id)}>
                    Cancel request
                  </Button>
                )}
              </div>
            ))}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="approved" className="mt-4 space-y-2">
              {!loading && approved.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <p className="text-sm text-muted-foreground">No approved requests.</p>
                </div>
              )}
              {approved.map((r) => (
                <div key={r.id} className="rounded-xl border border-border bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-base uppercase tracking-wide truncate">{r.requester_name ?? "Employee"}</p>
                      <p className="text-xs text-muted-foreground">{TYPE_LABEL[r.type]} · {renderRange(r)}</p>
                    </div>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                  </div>
                  {r.invites_sent_at && <p className="mt-1 text-[10px] text-muted-foreground">Invites sent {format(parseISO(r.invites_sent_at), "MMM d, p")}</p>}
                </div>
              ))}
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Conflict confirm dialog */}
      <AlertDialog open={!!confirmApprove} onOpenChange={(v) => !v && setConfirmApprove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Conflict on these dates
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Other approved time off overlaps with this request:</p>
                <ul className="list-disc pl-5">
                  {confirmApprove?.conflicts.map((c) => (
                    <li key={c.id}>
                      <strong>{c.requester_name ?? "Employee"}</strong> — {renderRange(c)}
                    </li>
                  ))}
                </ul>
                <p>Approve anyway?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmApprove && doApprove(confirmApprove.req)}>
              Approve anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deny dialog */}
      <Dialog open={!!denyTarget} onOpenChange={(v) => !v && setDenyTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Deny request</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Denying {denyTarget?.requester_name ?? "this request"} for {denyTarget && renderRange(denyTarget)}.
            </p>
            <div>
              <Label>Reason (optional)</Label>
              <Textarea rows={3} value={denyReason} onChange={(e) => setDenyReason(e.target.value)} placeholder="Optional note for the employee" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doDeny} disabled={actingId === denyTarget?.id}>
              {actingId === denyTarget?.id ? "Denying…" : "Deny request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Short notice confirm */}
      <AlertDialog open={shortNoticeConfirm} onOpenChange={(v) => !v && setShortNoticeConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Short notice
            </AlertDialogTitle>
            <AlertDialogDescription>
              {notice.text} for vacation and personal days.
              {startDate && ` This request starts in ${noticeDaysFromNow(startDate)} day${noticeDaysFromNow(startDate) === 1 ? "" : "s"}.`} You can submit it anyway, but approval is not guaranteed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShortNoticeConfirm(false);
                performSubmit();
              }}
            >
              Submit anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TimeOffPage;
