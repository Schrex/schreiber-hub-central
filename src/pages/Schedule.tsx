import { useEffect, useMemo, useRef, useState } from "react";
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
import { DayBoard, type BoardAssignment, type BoardCrew, type BoardJob } from "@/components/schedule/DayBoard";
import { fetchCurrentPositions, type CurrentPosition } from "@/lib/currentPositions";

type Job = { id: string; name: string; address: string | null; job_number: string | null };
type Profile = {
  user_id: string | null;
  display_name: string | null;
  contact_id: string | null;
  has_login: boolean;
  is_office: boolean;
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
  const { user, role: realRole, effectiveRole, displayName } = useAuth();
  const role = effectiveRole ?? realRole;
  const navigate = useNavigate();
  const canEdit = role === "office" || role === "admin";
  const canEditNotes = canEdit || role === "foreman";

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
  const [viewMode, setViewMode] = useState<"day" | "week" | "board">("day");
  const [boardExtraJobIds, setBoardExtraJobIds] = useState<string[]>([]);
  const [showOffice, setShowOffice] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("schedule.showOffice") === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("schedule.showOffice", showOffice ? "1" : "0");
    }
  }, [showOffice]);

  // form
  const [formJob, setFormJob] = useState<string>("");
  const [formUserIds, setFormUserIds] = useState<string[]>([]);
  const [formStart, setFormStart] = useState<string>("07:00");
  
  const [formNotes, setFormNotes] = useState<string>("");
  const [formStartDate, setFormStartDate] = useState<string>(todayStr());
  const [formEndDate, setFormEndDate] = useState<string>(todayStr());
  const [formSkipWeekends, setFormSkipWeekends] = useState<boolean>(true);
  const [crewSuggestions, setCrewSuggestions] = useState<
    { user_ids: string[]; days: number; source: "this-job" | "recent" }[]
  >([]);

  // Suggest crews recently scheduled together (last 30 days). Prefer same job.
  useEffect(() => {
    if (!dialogOpen) return;
    let cancelled = false;
    (async () => {
      const since = format(addDays(new Date(), -30), "yyyy-MM-dd");
      const baseQuery = supabase
        .from("schedule_assignments")
        .select("job_id, assignment_date, user_id")
        .gte("assignment_date", since);
      const { data: rows } = formJob
        ? await baseQuery.eq("job_id", formJob)
        : await baseQuery;
      if (cancelled) return;

      // Group user_ids by (job_id|date)
      const byKey = new Map<string, Set<string>>();
      (rows ?? []).forEach((r: { job_id: string; assignment_date: string; user_id: string }) => {
        const key = `${r.job_id}|${r.assignment_date}`;
        const set = byKey.get(key) ?? new Set<string>();
        set.add(r.user_id);
        byKey.set(key, set);
      });

      // Count crew signatures (sorted user_ids joined)
      const counts = new Map<string, { user_ids: string[]; days: number }>();
      byKey.forEach((set) => {
        if (set.size < 2) return; // singletons aren't a "crew"
        const ids = Array.from(set).sort();
        const sig = ids.join(",");
        const cur = counts.get(sig);
        if (cur) cur.days += 1;
        else counts.set(sig, { user_ids: ids, days: 1 });
      });

      // Filter active known users with logins (so apply works)
      const validIds = new Set(
        profiles.filter((p) => p.has_login && p.user_id).map((p) => p.user_id as string),
      );
      const suggestions = Array.from(counts.values())
        .map((c) => ({
          ...c,
          user_ids: c.user_ids.filter((id) => validIds.has(id)),
        }))
        .filter((c) => c.user_ids.length >= 2 && c.days >= 3)
        .sort((a, b) => b.days - a.days || b.user_ids.length - a.user_ids.length)
        .slice(0, 3)
        .map((c) => ({ ...c, source: formJob ? ("this-job" as const) : ("recent" as const) }));

      setCrewSuggestions(suggestions);
    })();
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, formJob, profiles]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const autoFilledRef = useRef<Set<string>>(new Set());

  const loadAll = async () => {
    setLoading(true);
    let [{ data: a }, { data: j }, { data: c }, { data: pr }, { data: t }, { data: rolesData }] = await Promise.all([
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
      supabase.rpc("list_employee_directory"),
      // Pull profiles too so we still capture any active login that has no contact yet
      supabase.from("profiles").select("user_id,display_name,contact_id").eq("is_active", true),
      supabase
        .from("time_off_requests")
        .select("user_id,type,half_day")
        .eq("status", "approved")
        .lte("start_date", selectedDate)
        .gte("end_date", selectedDate),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    // Auto carry-forward: if this day has no assignments and is today/future,
    // copy the most recent prior day's assignments forward (once per session per date).
    const todayIsoLocal = format(startOfDay(new Date()), "yyyy-MM-dd");
    const isFutureOrToday = selectedDate >= todayIsoLocal;
    if ((a?.length ?? 0) === 0 && isFutureOrToday && !autoFilledRef.current.has(selectedDate) && canEdit) {
      autoFilledRef.current.add(selectedDate);
      // Look back up to 14 days for the most recent date with any assignments.
      const sinceIso = format(addDays(parseISO(selectedDate), -14), "yyyy-MM-dd");
      const beforeIso = format(addDays(parseISO(selectedDate), -1), "yyyy-MM-dd");
      const { data: priorRows } = await supabase
        .from("schedule_assignments")
        .select("job_id,user_id,start_time,role_on_job,notes,assignment_date")
        .gte("assignment_date", sinceIso)
        .lte("assignment_date", beforeIso)
        .order("assignment_date", { ascending: false });
      const mostRecent = priorRows?.[0]?.assignment_date;
      const sourceRows = mostRecent ? priorRows!.filter((r) => r.assignment_date === mostRecent) : [];
      if (sourceRows.length > 0) {
        const newRows = sourceRows.map((r) => ({
          job_id: r.job_id,
          user_id: r.user_id,
          assignment_date: selectedDate,
          start_time: r.start_time,
          role_on_job: r.role_on_job,
          notes: r.notes,
          created_by: user?.id ?? null,
        }));
        const { error: copyErr } = await supabase
          .from("schedule_assignments")
          .upsert(newRows, { onConflict: "job_id,user_id,assignment_date", ignoreDuplicates: true });
        if (!copyErr) {
          const { data: refetched } = await supabase
            .from("schedule_assignments")
            .select("*, jobs(id,name,address,job_number)")
            .eq("assignment_date", selectedDate)
            .order("start_time", { ascending: true, nullsFirst: false });
          a = refetched;
          toast({
            title: "Carried forward",
            description: `Filled ${newRows.length} assignment${newRows.length === 1 ? "" : "s"} from ${format(parseISO(mostRecent!), "EEE, MMM d")}.`,
          });
        }
      }
    }

    // Build a per-user role set; "office staff" = office or admin AND not foreman/employee
    const rolesByUser = new Map<string, Set<string>>();
    (rolesData ?? []).forEach((r: { user_id: string; role: string }) => {
      const set = rolesByUser.get(r.user_id) ?? new Set<string>();
      set.add(r.role);
      rolesByUser.set(r.user_id, set);
    });
    const isOffice = (uid: string | null) => {
      if (!uid) return false;
      const s = rolesByUser.get(uid);
      if (!s) return false;
      const fieldRole = s.has("foreman") || s.has("employee");
      return (s.has("office") || s.has("admin")) && !fieldRole;
    };

    // Build a unified employee list: every active contact + any active profile not already linked
    const linkedUserIds = new Set(
      (c ?? []).map((row) => row.converted_user_id).filter((x): x is string => !!x),
    );
    const fromContacts: Profile[] = (c ?? []).map((row) => ({
      contact_id: row.id,
      user_id: row.converted_user_id ?? null,
      display_name: row.name,
      has_login: !!row.converted_user_id,
      is_office: isOffice(row.converted_user_id ?? null),
    }));
    const orphanProfiles: Profile[] = (pr ?? [])
      .filter((p) => !linkedUserIds.has(p.user_id))
      .map((p) => ({
        contact_id: null,
        user_id: p.user_id,
        display_name: p.display_name,
        has_login: true,
        is_office: isOffice(p.user_id),
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

  // Hide office staff from schedule lists unless toggle is on
  const visibleProfiles = useMemo(
    () => (showOffice ? profiles : profiles.filter((p) => !p.is_office)),
    [profiles, showOffice],
  );

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
    return visibleProfiles.map((p) => {
      const off = p.user_id ? offMap.get(p.user_id) : undefined;
      const asg = p.user_id ? asgMap.get(p.user_id) ?? [] : [];
      let status: "assigned" | "off" | "unassigned" | "no_login";
      if (!p.has_login) status = "no_login";
      else if (off && asg.length === 0) status = "off";
      else if (asg.length > 0) status = "assigned";
      else status = "unassigned";
      return { profile: p, off, assignments: asg, status };
    });
  }, [visibleProfiles, assignments, timeOff]);

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
      const startD = parseISO(formStartDate);
      const endD = parseISO(formEndDate);
      const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
      const allWeekend = isWeekend(startD) && isWeekend(endD) && formSkipWeekends;
      toast({
        title: allWeekend ? "Range is weekend-only" : "Date range is empty",
        description: allWeekend
          ? "Your start and end dates fall on weekends. Uncheck 'Skip weekends' or pick weekday dates."
          : "End date must be on or after start date.",
        variant: "destructive",
      });
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

  // --- Drag & drop board handlers (optimistic, no full reload) ---
  const boardAssign = async (jobId: string, userId: string) => {
    // Skip if already assigned to that job for the day
    if (assignments.some((a) => a.job_id === jobId && a.user_id === userId)) return;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const job = jobs.find((j) => j.id === jobId) ?? null;
    const profile = profiles.find((p) => p.user_id === userId);
    const optimistic: Assignment = {
      id: tempId,
      job_id: jobId,
      user_id: userId,
      assignment_date: selectedDate,
      start_time: "07:00",
      role_on_job: null,
      notes: null,
      jobs: job,
      profile_name: profile?.display_name ?? "Unknown",
      contact_id: profile?.contact_id ?? null,
    };
    setAssignments((prev) => [...prev, optimistic]);
    const { data, error } = await supabase
      .from("schedule_assignments")
      .upsert(
        [
          {
            job_id: jobId,
            user_id: userId,
            assignment_date: selectedDate,
            start_time: "07:00",
            created_by: user?.id ?? null,
          },
        ],
        { onConflict: "job_id,user_id,assignment_date", ignoreDuplicates: false },
      )
      .select("id")
      .maybeSingle();
    if (error) {
      setAssignments((prev) => prev.filter((a) => a.id !== tempId));
      toast({ title: "Could not assign", description: error.message, variant: "destructive" });
      return;
    }
    if (data?.id) {
      setAssignments((prev) => prev.map((a) => (a.id === tempId ? { ...a, id: data.id } : a)));
    }
  };

  const boardMove = async (assignmentId: string, newJobId: string) => {
    const prev = assignments;
    const moved = prev.find((a) => a.id === assignmentId);
    if (!moved) return;
    if (moved.job_id === newJobId) return;
    // If the user is already on the destination job, treat as unassign from source
    const dupe = prev.find((a) => a.user_id === moved.user_id && a.job_id === newJobId);
    const newJob = jobs.find((j) => j.id === newJobId) ?? null;
    const next = dupe
      ? prev.filter((a) => a.id !== assignmentId)
      : prev.map((a) => (a.id === assignmentId ? { ...a, job_id: newJobId, jobs: newJob } : a));
    setAssignments(next);
    if (dupe) {
      const { error } = await supabase.from("schedule_assignments").delete().eq("id", assignmentId);
      if (error) {
        setAssignments(prev);
        toast({ title: "Could not move", description: error.message, variant: "destructive" });
      }
      return;
    }
    const { error } = await supabase
      .from("schedule_assignments")
      .update({ job_id: newJobId })
      .eq("id", assignmentId);
    if (error) {
      setAssignments(prev);
      toast({ title: "Could not move", description: error.message, variant: "destructive" });
    }
  };

  const boardUnassign = async (assignmentId: string) => {
    const prev = assignments;
    setAssignments((cur) => cur.filter((a) => a.id !== assignmentId));
    const { error } = await supabase.from("schedule_assignments").delete().eq("id", assignmentId);
    if (error) {
      setAssignments(prev);
      toast({ title: "Could not remove", description: error.message, variant: "destructive" });
    }
  };


  const updateAssignmentNotes = async (id: string, notes: string) => {
    const value = notes.trim() ? notes.trim() : null;
    const { error } = await supabase
      .from("schedule_assignments")
      .update({ notes: value })
      .eq("id", id);
    if (error) {
      toast({ title: "Could not save note", description: error.message, variant: "destructive" });
      return false;
    }
    setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, notes: value } : a)));
    toast({ title: "Note saved" });
    return true;
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
          {(role === "office" || role === "admin" || role === "foreman") && (
            <Button
              variant="outline"
              size="sm"
              className="mr-1 h-7 px-2 text-xs"
              onClick={() => navigate("/schedule/whiteboard")}
            >
              Whiteboard
            </Button>
          )}
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
              <button
                onClick={() => setViewMode("board")}
                className={`rounded px-2.5 py-1 font-medium transition ${
                  viewMode === "board" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Board
              </button>
            </div>
          )}
          {canEdit && !isPastDay && (
          <Dialog
              open={dialogOpen}
              onOpenChange={(o) => {
                setDialogOpen(o);
                if (o) {
                  let base = isBefore(parseISO(selectedDate), today) ? today : parseISO(selectedDate);
                  // If skip-weekends is on and base lands on a weekend, advance to Monday
                  if (formSkipWeekends) {
                    while (base.getDay() === 0 || base.getDay() === 6) {
                      base = addDays(base, 1);
                    }
                  }
                  const baseIso = format(base, "yyyy-MM-dd");
                  setFormStartDate(baseIso);
                  setFormEndDate(baseIso);
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

                  {crewSuggestions.length > 0 && (
                    <div className="rounded-md border border-primary/30 bg-primary/5 p-2">
                      <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                        <Users className="h-3 w-3" /> Suggested crews
                      </div>
                      <ul className="space-y-1">
                        {crewSuggestions.map((s, i) => {
                          const names = s.user_ids
                            .map((id) => profiles.find((p) => p.user_id === id)?.display_name ?? "?")
                            .join(", ");
                          return (
                            <li key={i} className="flex items-start justify-between gap-2 text-xs">
                              <div className="min-w-0 flex-1">
                                <div className="truncate">{names}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {s.user_ids.length} people · {s.days} day{s.days === 1 ? "" : "s"} together
                                  {s.source === "this-job" ? " on this job" : " recently"}
                                </div>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 shrink-0 px-2 text-[10px]"
                                onClick={() => {
                                  setFormUserIds((prev) =>
                                    Array.from(new Set([...prev, ...s.user_ids])),
                                  );
                                  toast({ title: "Crew added" });
                                }}
                              >
                                Use crew
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <Label>Crew members</Label>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          const assignableIds = visibleProfiles
                            .filter((p) => p.has_login && p.user_id)
                            .map((p) => p.user_id as string);
                          setFormUserIds(
                            formUserIds.length === assignableIds.length ? [] : assignableIds,
                          );
                        }}
                      >
                        {formUserIds.length ===
                        visibleProfiles.filter((p) => p.has_login).length
                          ? "Clear all"
                          : "Select all"}
                      </button>
                    </div>
                    <label className="mb-1 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={showOffice}
                        onCheckedChange={(v) => setShowOffice(v === true)}
                      />
                      Include office staff
                    </label>
                    <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-2">
                      {visibleProfiles.map((p) => {
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

      <main className={`mx-auto space-y-6 px-4 py-5 ${viewMode === "board" ? "max-w-6xl" : "max-w-3xl"}`}>
        {viewMode === "week" && canEdit && (
          <WeekGrid
            weekDays={weekDays}
            profiles={visibleProfiles
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

        {viewMode === "board" && canEdit && (
          <section className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Scheduling board · {dateLabel}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Tap a name, then tap Place here on a job. You can still press and drag names between jobs.
                </p>
              </div>
            </div>
            {isPastDay ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                <Lock className="mx-auto mb-2 h-5 w-5 opacity-50" />
                Past days are locked.
              </Card>
            ) : (
              <DayBoard
                allActiveJobs={jobs as BoardJob[]}
                jobs={(() => {
                  const base = allByJob.map((g) => g.job).filter(Boolean) as BoardJob[];
                  const shop = jobs.find((j) => j.name?.toLowerCase() === "shop");
                  if (shop && !base.some((b) => b.id === shop.id)) {
                    return [shop as BoardJob, ...base];
                  }
                  return base;
                })()}
                extraJobIds={boardExtraJobIds}
                onAddJob={(id) =>
                  setBoardExtraJobIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                }
                onRemoveJobFromBoard={(id) =>
                  setBoardExtraJobIds((prev) => prev.filter((x) => x !== id))
                }
                crew={visibleProfiles
                  .filter((p) => p.has_login && p.user_id)
                  .map<BoardCrew>((p) => {
                    const off = timeOff.find((t) => t.user_id === p.user_id);
                    return {
                      user_id: p.user_id as string,
                      display_name: p.display_name ?? "Unnamed",
                      position: positionsByUser.get(p.user_id as string)?.title ?? null,
                      status: off ? "off" : "available",
                      off_label: off
                        ? `${off.type}${off.half_day !== "none" ? ` (${off.half_day.toUpperCase()})` : ""}`
                        : null,
                    };
                  })}
                assignments={assignments.map<BoardAssignment>((a) => ({
                  id: a.id,
                  job_id: a.job_id,
                  user_id: a.user_id,
                  display_name: a.profile_name ?? "Unknown",
                  start_time: a.start_time,
                  position: positionsByUser.get(a.user_id)?.title ?? null,
                }))}
                onAssign={boardAssign}
                onMove={boardMove}
                onUnassign={boardUnassign}
              />
            )}
          </section>
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
                         <ul className="space-y-2">
                          {foremen.map((a) => (
                            <li
                              key={a.id}
                              className="rounded border border-amber-500/20 bg-background/40 p-2"
                            >
                              <div className="flex items-center justify-between gap-2 text-sm">
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
                              </div>
                              <DayNoteEditor
                                assignmentId={a.id}
                                initialNote={a.notes}
                                canEdit={canEditNotes && !isPastDay}
                                onSave={updateAssignmentNotes}
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Crew list */}
                    {crew.length > 0 && (
                      <ul className="divide-y">
                        {crew.map((a) => (
                          <li key={a.id} className="px-4 py-2 text-sm">
                            <div className="flex items-center justify-between">
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
                            </div>
                            <DayNoteEditor
                              assignmentId={a.id}
                              initialNote={a.notes}
                              canEdit={canEditNotes && !isPastDay}
                              onSave={updateAssignmentNotes}
                            />
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
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={showOffice}
                onCheckedChange={(v) => setShowOffice(v === true)}
              />
              Include office staff in schedule
            </label>
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

function DayNoteEditor({
  assignmentId,
  initialNote,
  canEdit,
  onSave,
}: {
  assignmentId: string;
  initialNote: string | null;
  canEdit: boolean;
  onSave: (id: string, notes: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(initialNote ?? "");
  }, [initialNote, assignmentId]);

  if (!editing) {
    return (
      <div className="mt-1 flex items-start gap-2">
        {initialNote ? (
          <p className="flex-1 whitespace-pre-wrap rounded bg-muted/40 px-2 py-1 text-xs text-foreground/80">
            {initialNote}
          </p>
        ) : (
          <p className="flex-1 text-xs italic text-muted-foreground">No note for this day</p>
        )}
        {canEdit && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] uppercase tracking-wider"
            onClick={() => setEditing(true)}
          >
            {initialNote ? "Edit" : "Add note"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1 space-y-1">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Today's note for this person…"
        rows={2}
        className="text-xs"
        autoFocus
      />
      <div className="flex justify-end gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          disabled={saving}
          onClick={() => {
            setValue(initialNote ?? "");
            setEditing(false);
          }}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 px-3"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            const ok = await onSave(assignmentId, value);
            setSaving(false);
            if (ok) setEditing(false);
          }}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

export default Schedule;
