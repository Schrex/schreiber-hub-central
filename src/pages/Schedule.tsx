import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, addDays, startOfWeek, isToday, parseISO } from "date-fns";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Briefcase,
  Plus,
  Trash2,
  Users,
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

type Job = { id: string; name: string; address: string | null; job_number: string | null };
type Profile = { user_id: string; display_name: string | null };
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
};

const todayStr = () => format(new Date(), "yyyy-MM-dd");

const Schedule = () => {
  const { user, role, displayName } = useAuth();
  const navigate = useNavigate();
  const canEdit = role === "office" || role === "admin";

  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // form
  const [formJob, setFormJob] = useState<string>("");
  const [formUserIds, setFormUserIds] = useState<string[]>([]);
  const [formStart, setFormStart] = useState<string>("");
  const [formRole, setFormRole] = useState<string>("");
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
    const [{ data: a }, { data: j }, { data: p }] = await Promise.all([
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
      supabase.from("profiles").select("user_id,display_name").eq("is_active", true).order("display_name"),
    ]);

    const profMap = new Map((p ?? []).map((x) => [x.user_id, x.display_name]));
    const enriched: Assignment[] = (a ?? []).map((row: any) => ({
      ...row,
      profile_name: profMap.get(row.user_id) ?? "Unknown",
    }));
    setAssignments(enriched);
    setJobs(j ?? []);
    setProfiles(p ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

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

  const resetForm = () => {
    setFormJob("");
    setFormUserIds([]);
    setFormStart("");
    setFormRole("");
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
        role_on_job: formRole || null,
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

  const dateLabel = isToday(parseISO(selectedDate))
    ? "Today"
    : format(parseISO(selectedDate), "EEE, MMM d");

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
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" /> Assign
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign crew to job — {dateLabel}</DialogTitle>
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
                  <div>
                    <Label>Crew member</Label>
                    <Select value={formUser} onValueChange={setFormUser}>
                      <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                      <SelectContent>
                        {profiles.map((p) => (
                          <SelectItem key={p.user_id} value={p.user_id}>
                            {p.display_name ?? "Unnamed"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Start time</Label>
                      <Input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} />
                    </div>
                    <div>
                      <Label>Role on job</Label>
                      <Input placeholder="Foreman, Operator…" value={formRole} onChange={(e) => setFormRole(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea rows={2} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={submitAssignment}>Save assignment</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {/* Week strip */}
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-3">
          {weekDays.map((d) => {
            const ds = format(d, "yyyy-MM-dd");
            const active = ds === selectedDate;
            return (
              <button
                key={ds}
                onClick={() => setSelectedDate(ds)}
                className={`flex min-w-[56px] flex-col items-center rounded-lg border px-2 py-2 text-xs transition ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                <span className="uppercase tracking-wide opacity-80">{format(d, "EEE")}</span>
                <span className="text-base font-semibold">{format(d, "d")}</span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-5">
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
                    {a.role_on_job && <div><span className="text-muted-foreground">Role:</span> {a.role_on_job}</div>}
                    {a.notes && <div className="mt-1 text-muted-foreground">{a.notes}</div>}
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

        {/* All crews on this day */}
        <section>
          <h2 className="mb-2 font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
            All crews · {dateLabel}
          </h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : allByJob.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nothing scheduled.
            </Card>
          ) : (
            <div className="space-y-3">
              {allByJob.map(({ job, list, job_id }) => (
                <Card key={job_id} className="p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{job?.name}</div>
                      {job?.address && (
                        <div className="text-xs text-muted-foreground">{job.address}</div>
                      )}
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" /> {list.length}
                    </Badge>
                  </div>
                  <ul className="divide-y">
                    {list.map((a) => (
                      <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <div className="font-medium">{a.profile_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {a.start_time && <>{a.start_time.slice(0, 5)} · </>}
                            {a.role_on_job ?? "—"}
                          </div>
                        </div>
                        {canEdit && (
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
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Schedule;
