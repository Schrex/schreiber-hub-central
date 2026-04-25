import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentPositions, type CurrentPosition } from "@/lib/currentPositions";

interface Assignment {
  id: string;
  user_id: string;
  assignment_date: string;
  start_time: string | null;
  role_on_job: string | null;
}

interface ProfileLite {
  user_id: string;
  display_name: string | null;
}

const WEEKS = 3;
const DAYS = WEEKS * 7;

const todayLocal = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const fmtIsoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const dayLabel = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

const weekRangeLabel = (start: Date) => {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
};

export function JobLookahead({ jobId }: { jobId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());
  const [positions, setPositions] = useState<Map<string, CurrentPosition>>(new Map());
  const [loading, setLoading] = useState(true);

  const start = useMemo(() => todayLocal(), []);
  const end = useMemo(() => {
    const e = new Date(start);
    e.setDate(e.getDate() + DAYS - 1);
    return e;
  }, [start]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const startStr = fmtIsoDate(start);
      const endStr = fmtIsoDate(end);
      const { data, error } = await supabase
        .from("schedule_assignments")
        .select("id, user_id, assignment_date, start_time, role_on_job")
        .eq("job_id", jobId)
        .gte("assignment_date", startStr)
        .lte("assignment_date", endStr)
        .order("assignment_date")
        .order("start_time", { nullsFirst: true });

      if (cancelled) return;
      if (error) {
        setAssignments([]);
        setLoading(false);
        return;
      }
      const list = (data ?? []) as Assignment[];
      setAssignments(list);

      const userIds = Array.from(new Set(list.map((a) => a.user_id)));
      if (userIds.length > 0) {
        const [{ data: profs }, posMap] = await Promise.all([
          supabase.from("profiles").select("user_id, display_name").in("user_id", userIds),
          fetchCurrentPositions(userIds),
        ]);
        if (!cancelled) {
          setProfiles(new Map(((profs ?? []) as ProfileLite[]).map((p) => [p.user_id, p])));
          setPositions(posMap);
        }
      } else {
        setProfiles(new Map());
        setPositions(new Map());
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, start, end]);

  // Group by week → day
  const weeks = useMemo(() => {
    const byDate = new Map<string, Assignment[]>();
    assignments.forEach((a) => {
      const arr = byDate.get(a.assignment_date) ?? [];
      arr.push(a);
      byDate.set(a.assignment_date, arr);
    });

    const out: { weekStart: Date; days: { date: Date; iso: string; rows: Assignment[] }[] }[] = [];
    for (let w = 0; w < WEEKS; w++) {
      const weekStart = new Date(start);
      weekStart.setDate(weekStart.getDate() + w * 7);
      const days: { date: Date; iso: string; rows: Assignment[] }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const iso = fmtIsoDate(d);
        days.push({ date: d, iso, rows: byDate.get(iso) ?? [] });
      }
      out.push({ weekStart, days });
    }
    return out;
  }, [assignments, start]);

  const total = assignments.length;
  const todayIso = fmtIsoDate(start);

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
            3-Week Lookahead
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Crew scheduled for this job over the next 3 weeks.
          </p>
        </div>
        <Link
          to="/schedule"
          className="shrink-0 text-xs font-medium text-primary hover:underline"
        >
          Full schedule →
        </Link>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-6 text-center">
          <Calendar className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No crew scheduled in the next 3 weeks.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {weeks.map(({ weekStart, days }, wIdx) => {
            const weekTotal = days.reduce((sum, d) => sum + d.rows.length, 0);
            return (
              <div key={wIdx}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
                    Week {wIdx + 1} · {weekRangeLabel(weekStart)}
                  </h3>
                  <span className="text-[10px] text-muted-foreground">
                    {weekTotal} {weekTotal === 1 ? "shift" : "shifts"}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {days.map((d) => {
                    const isToday = d.iso === todayIso;
                    const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6;
                    return (
                      <div
                        key={d.iso}
                        className={`rounded-lg border px-3 py-2 ${
                          isToday
                            ? "border-primary/40 bg-primary/5"
                            : isWeekend
                              ? "border-border/60 bg-muted/30"
                              : "border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${isToday ? "text-primary" : ""}`}>
                              {dayLabel(d.date)}
                            </span>
                            {isToday && (
                              <span className="rounded bg-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-foreground">
                                Today
                              </span>
                            )}
                          </div>
                          {d.rows.length > 0 && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Users className="h-3 w-3" /> {d.rows.length}
                            </span>
                          )}
                        </div>
                        {d.rows.length === 0 ? (
                          <p className="mt-1 text-[11px] italic text-muted-foreground">No crew</p>
                        ) : (
                          <ul className="mt-1.5 space-y-0.5">
                            {d.rows.map((r) => {
                              const name = profiles.get(r.user_id)?.display_name ?? "Unknown";
                              const role =
                                r.role_on_job?.trim() ||
                                positions.get(r.user_id)?.title ||
                                null;
                              return (
                                <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                                  <span className="truncate">
                                    <span className="font-medium">{name}</span>
                                    {role && (
                                      <span className="text-muted-foreground"> · {role}</span>
                                    )}
                                  </span>
                                  {r.start_time && (
                                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                                      {r.start_time.slice(0, 5)}
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
