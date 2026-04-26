import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, addDays, startOfWeek, isToday, parseISO, isBefore, startOfDay } from "date-fns";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Briefcase,
  Plus,
  Trash2,
  Users,
  ChevronLeft,
  ChevronRight,
  Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { WeekGrid } from "@/components/schedule/WeekGrid";
import { fetchCurrentPositions, type CurrentPosition } from "@/lib/currentPositions";

type Job = { id: string; name: string; address: string | null; job_number: string | null };
type Profile = {
  user_id: string | null;
  display_name: string | null;
  contact_id: string | null;
  has_login: boolean;
};
type Assignment = {
  id: string;
  job_id: string;
  user_id: string;
  assignment_date: string;
  start_time: string | null;
  role_on_job: string | null;
  notes: string | null;
  jobs?: Job | null;
  profile_name?: string | null;
  contact_id?: string | null;
};
type TimeOff = {
  user_id: string;
  type: "vacation" | "sick" | "personal" | "other";
  half_day: "none" | "am" | "pm";
};

const todayStr = () => format(new Date(), "yyyy-MM-dd");

const Schedule = () => {
  const { user, role, displayName } = useAuth();
  const navigate = useNavigate();
  const canEdit = role === "office" || role === "admin";

  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [weekAssignments, setWeekAssignments] = useState<Assignment[]>([]);
  const [weekTimeOff, setWeekTimeOff] = useState<Array<{ user_id: string; start_date: string; end_date: string; type: string; half_day: string }>>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [positionsByUser, setPositionsByUser] = useState<Map<string, CurrentPosition>>(new Map());
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"day" | "week">("day");

  // form
  const [formJob, setFormJob] = useState<string>("");
  const [formUserIds, setFormUserIds] = useState<string[]>([]);
  const [formStart, setFormStart] = useState<string>("07:00");
  
  const [formNotes, setFormNotes] = useState<string>("");
  const [formStartDate, setFormStartDate] = useState<string>(todayStr());
  const [formEndDate, setFormEndDate] = useState<string>(todayStr());
  const [formSkipWeekends, setFormSkipWeekends] = useState<boolean>(true);

  const weekDays = useMemo(() => {
    const start = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: a }, { data: j }, { data: c }, { data: pr }, { data: t }] = await Promise.all([
      supabase
        .from("schedule_assignments")
        .select("*, jobs(id,name,address,job_number)")
        .eq("assignment_date", selectedDate)
        .order("start_time", { ascending: true, nullsFirst: false }),
      supabase
        .from("jobs")
        .select("id,name,address,job_number")
        .eq("status", "active")
        .order("name"),
      supabase
        .from("employee_contacts")
        .select("id,name,converted_user_id,is_active")
        .eq("is_active", true)
        .order("name"),
      // Pull profiles too so we still capture any active login that has no contact yet
      supabase.from("profiles").select("user_id,display_name,contact_id").eq("is_active", true),
      supabase
        .from("time_off_requests")
        .select("user_id,type,half_day")
        .eq("status", "approved")
        .lte("start_date", selectedDate)
        .gte("end_date", selectedDate),
    ]);

    // Build a unified employee list: every active contact + any active profile not already linked
    const linkedUserIds = new Set(
      (c ?? []).map((row) => row.converted_user_id).filter((x): x is string => !!x),
    );
    const fromContacts: Profile[] = (c ?? []).map((row) => ({
      contact_id: row.id,
      user_id: row.converted_user_id ?? null,
      display_name: row.name,
      has_login: !!row.converted_user_id,
    }));
    const orphanProfiles: Profile[] = (pr ?? [])
      .filter((p) => !p.contact_id && !linkedUserIds.has(p.user_id))
      .map((p) => ({
        contact_id: null,
        user_id: p.user_id,
        display_name: p.display_name,
        has_login: true,
      }));
    const unified = [...fromContacts, ...orphanProfiles].sort((x, y) =>
      (x.display_name ?? "").localeCompare(y.display_name ?? ""),
    );

    // Lookup by user_id for enriching assignment rows
    const byUserId = new Map(
      unified.filter((u) => u.user_id).map((u) => [u.user_id as string, u] as const),
    );
    const enriched: Assignment[] = (a ?? []).map((row: any) => ({
      ...row,
      profile_name: byUserId.get(row.user_id)?.display_name ?? "Unknown",
      contact_id: byUserId.get(row.user_id)?.contact_id ?? null,
    }));
    setAssignments(enriched);
    setJobs(j ?? []);
    setProfiles(unified);
    setTimeOff((t ?? []) as TimeOff[]);
    // Pull current positions for everyone with a login
    const userIds = unified.filter((u) => u.user_id).map((u) => u.user_id as string);
    const posMap = await fetchCurrentPositions(userIds);
    setPositionsByUser(posMap);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Load full-week data when manager week view is active
  useEffect(() => {
    if (viewMode !== "week" || !canEdit) return;
    const weekStart = format(weekDays[0], "yyyy-MM-dd");
    const weekEnd = format(weekDays[6], "yyyy-MM-dd");
    (async () => {
      const [{ data: a }, { data: t }] = await Promise.all([
        supabase
          .from("schedule_assignments")
          .select("*, jobs(id,name,address,job_number)")
          .gte("assignment_date", weekStart)
          .lte("assignment_date", weekEnd),
        supabase
          .from("time_off_requests")
          .select("user_id,start_date,end_date,type,half_day")
          .eq("status", "approved")
          .lte("start_date", weekEnd)
          .gte("end_date", weekStart),
      ]);
      setWeekAssignments((a ?? []) as Assignment[]);
      setWeekTimeOff((t ?? []) as typeof weekTimeOff);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, selectedDate, canEdit]);

  const myAssignments = assignments.filter((a) => a.user_id === user?.id);
  const allByJob = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    assignments.forEach((a) => {
      const arr = map.get(a.job_id) ?? [];
      arr.push(a);
      map.set(a.job_id, arr);
    });
    return Array.from(map.entries()).map(([job_id, list]) => ({
      job: list[0].jobs!,
      list,
      job_id,
    }));
  }, [assignments]);

  // Per-employee roster: assigned (with jobs), off (approved time-off), unassigned, or no-login
  const roster = useMemo(() => {
    const offMap = new Map<string, TimeOff>();
    timeOff.forEach((t) => offMap.set(t.user_id, t));
    const asgMap = new Map<string, Assignment[]>();
    assignments.forEach((a) => {
      const arr = asgMap.get(a.user_id) ?? [];
      arr.push(a);
      asgMap.set(a.user_id, arr);
    });
    return profiles.map((p) => {
      const off = p.user_id ? offMap.get(p.user_id) : undefined;
      const asg = p.user_id ? asgMap.get(p.user_id) ?? [] : [];
      let status: "assigned" | "off" | "unassigned" | "no_login";
      if (!p.has_login) status = "no_login";
      else if (off && asg.length === 0) status = "off";
      else if (asg.length > 0) status = "assigned";
      else status = "unassigned";
      return { profile: p, off, assignments: asg, status };
    });
  }, [profiles, assignments, timeOff]);

  const counts = useMemo(() => {
    return roster.reduce(
      (acc, r) => {
        acc[r.status]++;
        return acc;
      },
      { assigned: 0, off: 0, unassigned: 0, no_login: 0 } as Record<string, number>,
    );
  }, [roster]);

  const resetForm = () => {
    setFormJob("");
    setFormUserIds([]);
    setFormStart("07:00");
    
    setFormNotes("");
    setFormStartDate(selectedDate);
    setFormEndDate(selectedDate);
  };

  const buildDateRange = (start: string, end: string, skipWeekends: boolean): string[] => {
    const out: string[] = [];
    let d = parseISO(start);
    const e = parseISO(end);
    if (e < d) return out;
    while (d <= e) {
      const dow = d.getDay();
      if (!skipWeekends || (dow !== 0 && dow !== 6)) {
        out.push(format(d, "yyyy-MM-dd"));
      }
      d = addDays(d, 1);
    }
    return out;
  };

  const submitAssignment = async () => {
    if (!formJob || formUserIds.length === 0) {
      toast({ title: "Pick a job and at least one crew member", variant: "destructive" });
      return;
    }
    const dates = buildDateRange(formStartDate, formEndDate, formSkipWeekends);
    if (dates.length === 0) {
      toast({ title: "Date range is empty", variant: "destructive" });
      return;
    }
    const rows = dates.flatMap((dt) =>
      formUserIds.map((uid) => ({
        job_id: formJob,
        user_id: uid,
        assignment_date: dt,
        start_time: formStart || null,
        notes: formNotes || null,
        created_by: user?.id ?? null,
      })),
    );
    const { error } = await supabase
      .from("schedule_assignments")
      .upsert(rows, { onConflict: "job_id,user_id,assignment_date", ignoreDuplicates: true });
    if (error) {
      toast({ title: "Could not assign", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Assigned",
      description: `${formUserIds.length} × ${dates.length} day${dates.length > 1 ? "s" : ""}`,
    });
    resetForm();
    setDialogOpen(false);
    loadAll();
  };

  const removeAssignment = async (id: string) => {
    const { error } = await supabase.from("schedule_assignments").delete().eq("id", id);
    if (error) {
      toast({ title: "Could not remove", description: error.message, variant: "destructive" });
      return;
    }
    loadAll();
  };

  const today = startOfDay(new Date());
  const todayIso = format(today, "yyyy-MM-dd");
  const isPastDay = isBefore(parseISO(selectedDate), today);
  const dateLabel = isToday(parseISO(selectedDate))
    ? "Today"
    : format(parseISO(selectedDate), "EEE, MMM d");

  const shiftWeek = (dir: -1 | 1) => {
    setSelectedDate(format(addDays(parseISO(selectedDate), dir * 7), "yyyy-MM-dd"));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-lg font-semibold">Schedule</h1>
            <p className="text-xs text-muted-foreground">Crews assigned to jobs</p>
          </div>
          {canEdit && (
            <div className="mr-1 inline-flex rounded-md border bg-muted/40 p-0.5 text-xs">
              <button
                onClick={() => setViewMode("day")}
                className={`rounded px-2.5 py-1 font-medium transition ${
                  viewMode === "day" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setViewMode("week")}
                className={`rounded px-2.5 py-1 font-medium transition ${
                  viewMode === "week" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Week
              </button>
            </div>
          )}
          {canEdit && !isPastDay && (
            <Dialog
              open={dialogOpen}
              onOpenChange={(o) => {
                setDialogOpen(o);
                if (o) {
                  const base = isBefore(parseISO(selectedDate), today) ? todayIso : selectedDate;
                  setFormStartDate(base);
                  setFormEndDate(base);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" /> Assign
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Assign crew to job</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Job</Label>
                    <Select value={formJob} onValueChange={setFormJob}>
                      <SelectTrigger><SelectValue placeholder="Select job" /></SelectTrigger>
                      <SelectContent>
                        {jobs.map((j) => (
                          <SelectItem key={j.id} value={j.id}>
                            {j.job_number ? `#${j.job_number} · ` : ""}{j.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Start date</Label>
                      <Input
                        type="date"
                        min={todayIso}
                        value={formStartDate}
                        onChange={(e) => {
                          setFormStartDate(e.target.value);
                          if (parseISO(e.target.value) > parseISO(formEndDate)) {
                            setFormEndDate(e.target.value);
                          }
                        }}
                      />
                    </div>
                    <div>
                      <Label>End date</Label>
                      <Input
                        type="date"
                        min={formStartDate < todayIso ? todayIso : formStartDate}
                        value={formEndDate}
                        onChange={(e) => setFormEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={formSkipWeekends}
                      onCheckedChange={(v) => setFormSkipWeekends(!!v)}
                    />
                    Skip weekends
                  </label>

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <Label>Crew members</Label>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          const assignableIds = profiles
                            .filter((p) => p.has_login && p.user_id)
                            .map((p) => p.user_id as string);
                          setFormUserIds(
                            formUserIds.length === assignableIds.length ? [] : assignableIds,
                          );
                        }}
                      >
                        {formUserIds.length ===
                        profiles.filter((p) => p.has_login).length
                          ? "Clear all"
                          : "Select all"}
                      </button>
                    </div>
                    <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-2">
                      {profiles.map((p) => {
                        const disabled = !p.has_login || !p.user_id;
                        const checked = !disabled && formUserIds.includes(p.user_id as string);
                        return (
                          <label
                            key={p.contact_id ?? p.user_id ?? p.display_name}
                            className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                              disabled
                                ? "cursor-not-allowed opacity-60"
                                : "cursor-pointer hover:bg-muted"
                            }`}
                            title={disabled ? "Contact has no app login yet" : undefined}
                          >
                            <Checkbox
                              disabled={disabled}
                              checked={checked}
                              onCheckedChange={(v) => {
                                if (disabled || !p.user_id) return;
                                setFormUserIds((prev) =>
                                  v
                                    ? [...prev, p.user_id as string]
                                    : prev.filter((x) => x !== p.user_id),
                                );
                              }}
                            />
                            <span className="flex-1">{p.display_name ?? "Unnamed"}</span>
                            {disabled && (
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                no login
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {formUserIds.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formUserIds.length} selected ·{" "}
                        {buildDateRange(formStartDate, formEndDate, formSkipWeekends).length} day(s) ={" "}
                        {formUserIds.length *
                          buildDateRange(formStartDate, formEndDate, formSkipWeekends).length}{" "}
                        assignments
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Start time</Label>
                    <Input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea rows={2} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={submitAssignment}>Save assignments</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {/* Week strip with prev/next nav */}
        <div className="mx-auto flex max-w-3xl items-center gap-1 px-2 pb-3">
          <Button variant="ghost" size="icon" onClick={() => shiftWeek(-1)} aria-label="Previous week">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-1 gap-1 overflow-x-auto px-1">
            {weekDays.map((d) => {
              const ds = format(d, "yyyy-MM-dd");
              const active = ds === selectedDate;
              const past = isBefore(d, today);
              return (
                <button
                  key={ds}
                  onClick={() => setSelectedDate(ds)}
                  className={`flex min-w-[56px] flex-col items-center rounded-lg border px-2 py-2 text-xs transition ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : past
                      ? "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <span className="uppercase tracking-wide opacity-80">{format(d, "EEE")}</span>
                  <span className="text-base font-semibold">{format(d, "d")}</span>
                </button>
              );
            })}
          </div>
          <Button variant="ghost" size="icon" onClick={() => shiftWeek(1)} aria-label="Next week">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        {isPastDay && (
          <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            History — this day is locked and cannot be edited
            <button
              onClick={() => setSelectedDate(todayIso)}
              className="ml-2 text-primary hover:underline"
            >
              Jump to today
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-5">
        {viewMode === "week" && canEdit && (
          <WeekGrid
            weekDays={weekDays}
            profiles={profiles
              .filter((p) => p.has_login && p.user_id)
              .map((p) => ({ user_id: p.user_id as string, display_name: p.display_name }))}
            assignments={weekAssignments}
            timeOff={weekTimeOff}
            onCellClick={(ds) => {
              setSelectedDate(ds);
              setViewMode("day");
            }}
          />
        )}

        {viewMode === "day" && (
        <>
        {/* My today card */}
        <section>
          <h2 className="mb-2 font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {isToday(parseISO(selectedDate)) ? "Your day" : `Your ${dateLabel}`}
          </h2>
          {myAssignments.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              <CalendarIcon className="mx-auto mb-2 h-6 w-6 opacity-50" />
              No assignments for {displayName ?? "you"} on this day.
            </Card>
          ) : (
            <div className="space-y-3">
              {myAssignments.map((a) => (
                <Card key={a.id} className="overflow-hidden">
                  <div className="bg-primary/10 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-primary" />
                        <span className="font-semibold">{a.jobs?.name}</span>
                      </div>
                      {a.start_time && (
                        <Badge variant="secondary" className="gap-1">
                          <Clock className="h-3 w-3" />
                          {a.start_time.slice(0, 5)}
                        </Badge>
                      )}
                    </div>
                    {a.jobs?.address && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {a.jobs.address}
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-3 text-sm">
                    {a.notes && <div className="text-muted-foreground">{a.notes}</div>}
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => navigate(`/jobs/${a.job_id}`)}
                    >
                      View job
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* All crews on this day — grouped by job */}
        <section>
          <div className="mb-2 flex items-end justify-between">
            <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Jobs · {dateLabel}
            </h2>
            {!loading && allByJob.length > 0 && (
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {allByJob.length} job{allByJob.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : allByJob.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nothing scheduled.
            </Card>
          ) : (
            <div className="space-y-3">
              {allByJob.map(({ job, list, job_id }) => {
                const foremen = list.filter((a) =>
                  (positionsByUser.get(a.user_id)?.title ?? "").toLowerCase().includes("foreman"),
                );
                const crew = list.filter(
                  (a) => !(positionsByUser.get(a.user_id)?.title ?? "").toLowerCase().includes("foreman"),
                );
                const earliest = list
                  .map((a) => a.start_time)
                  .filter((t): t is string => !!t)
                  .sort()[0];
                return (
                  <Card key={job_id} className="overflow-hidden">
                    {/* Clickable job header */}
                    <button
                      onClick={() => navigate(`/jobs/${job_id}`)}
                      className="group flex w-full items-start justify-between gap-3 bg-primary/5 px-4 py-3 text-left transition hover:bg-primary/10"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {(job as Job)?.job_number && (
                            <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                              #{(job as Job).job_number}
                            </span>
                          )}
                          <span className="truncate font-semibold group-hover:underline">
                            {job?.name}
                          </span>
                        </div>
                        {(job as Job)?.address && (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{(job as Job).address}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge variant="secondary" className="gap-1">
                          <Users className="h-3 w-3" /> {list.length}
                        </Badge>
                        {earliest && (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <Clock className="h-3 w-3" /> {earliest.slice(0, 5)}
                          </Badge>
                        )}
                      </div>
                    </button>

                    {/* Foreman highlight */}
                    {foremen.length > 0 && (
                      <div className="border-b bg-amber-500/5 px-4 py-2">
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                          Foreman
                        </div>
                        <ul className="space-y-1">
                          {foremen.map((a) => (
                            <li
                              key={a.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                {a.contact_id ? (
                                  <button
                                    onClick={() => navigate(`/employee-contacts?focus=${a.contact_id}`)}
                                    className="font-semibold hover:text-primary hover:underline"
                                  >
                                    {a.profile_name}
                                  </button>
                                ) : (
                                  <span className="font-semibold">{a.profile_name}</span>
                                )}
                                {a.start_time && (
                                  <span className="text-xs text-muted-foreground">
                                    · {a.start_time.slice(0, 5)}
                                  </span>
                                )}
                              </div>
                              {canEdit && !isPastDay && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => removeAssignment(a.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Crew list */}
                    {crew.length > 0 && (
                      <ul className="divide-y">
                        {crew.map((a) => (
                          <li
                            key={a.id}
                            className="flex items-center justify-between px-4 py-2 text-sm"
                          >
                            <div>
                              {a.contact_id ? (
                                <button
                                  onClick={() => navigate(`/employee-contacts?focus=${a.contact_id}`)}
                                  className="font-medium hover:text-primary hover:underline"
                                >
                                  {a.profile_name}
                                </button>
                              ) : (
                                <div className="font-medium">{a.profile_name}</div>
                              )}
                              <div className="text-xs text-muted-foreground">
                                {a.start_time && <>{a.start_time.slice(0, 5)} · </>}
                                {positionsByUser.get(a.user_id)?.title ?? "—"}
                              </div>
                            </div>
                            {canEdit && !isPastDay && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeAssignment(a.id)}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Everyone roster — office/admin only */}
        {canEdit && (
          <section>
            <div className="mb-2 flex items-end justify-between">
              <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Everyone · {dateLabel}
              </h2>
              <div className="flex gap-2 text-[10px] uppercase tracking-wider">
                <span className="rounded bg-primary/10 px-2 py-0.5 text-primary">
                  {counts.assigned} assigned
                </span>
                <span className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-600 dark:text-amber-400">
                  {counts.off} off
                </span>
                <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
                  {counts.unassigned} unassigned
                </span>
                {counts.no_login > 0 && (
                  <span className="rounded bg-destructive/10 px-2 py-0.5 text-destructive">
                    {counts.no_login} no login
                  </span>
                )}
              </div>
            </div>
            <Card className="divide-y">
              {roster.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No active employees.
                </div>
              ) : (
                roster.map(({ profile, off, assignments: asg, status }) => (
                  <div
                    key={profile.contact_id ?? profile.user_id ?? profile.display_name ?? Math.random()}
                    className="flex items-start justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        {profile.contact_id ? (
                          <button
                            onClick={() => navigate(`/employee-contacts?focus=${profile.contact_id}`)}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {profile.display_name ?? "Unnamed"}
                          </button>
                        ) : (
                          <div className="font-medium">{profile.display_name ?? "Unnamed"}</div>
                        )}
                        {profile.user_id && positionsByUser.get(profile.user_id) && (
                          <span className="text-[11px] text-muted-foreground">
                            {positionsByUser.get(profile.user_id)!.title}
                          </span>
                        )}
                      </div>
                      {status === "assigned" && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {asg
                            .map((a) =>
                              `${a.jobs?.name ?? "Job"}${
                                a.start_time ? ` · ${a.start_time.slice(0, 5)}` : ""
                              }`,
                            )
                            .join(" / ")}
                        </div>
                      )}
                      {status === "off" && off && (
                        <div className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                          Off — {off.type}
                          {off.half_day !== "none" ? ` (${off.half_day.toUpperCase()} only)` : ""}
                        </div>
                      )}
                      {status === "unassigned" && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Not assigned
                        </div>
                      )}
                      {status === "no_login" && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Contact only — no app login yet
                        </div>
                      )}
                    </div>
                    <Badge
                      variant={status === "assigned" ? "default" : "outline"}
                      className={
                        status === "off"
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          : status === "no_login"
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : status === "unassigned"
                          ? "text-muted-foreground"
                          : ""
                      }
                    >
                      {status === "assigned"
                        ? `${asg.length} job${asg.length > 1 ? "s" : ""}`
                        : status === "off"
                        ? "Off"
                        : status === "no_login"
                        ? "No login"
                        : "Open"}
                    </Badge>
                  </div>
                ))
              )}
            </Card>
          </section>
        )}
        </>
        )}
      </main>
    </div>
  );
};

export default Schedule;
