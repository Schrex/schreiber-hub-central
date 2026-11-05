import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LookaheadWeeks, type LookaheadWeekTask } from "@/components/jobs/lookahead/LookaheadWeeks";

interface PlanRow {
  id: string;
  published_at: string | null;
}

interface TaskRow {
  id: string;
  name: string;
  group_name: string | null;
  contractor_name: string;
  sort_order: number;
}

interface DayRow {
  task_id: string;
  work_date: string;
}

interface HolidayRow {
  holiday_date: string;
  label: string;
}

function publishedLabel(publishedAt: string | null): string {
  if (!publishedAt) return "Published";
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return "Published";
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  }).format(date);
  return `Published ${label}`;
}

export function LookaheadGrid({
  jobId,
  jobName,
  jobNumber,
}: {
  jobId: string;
  jobName: string;
  jobNumber: string | null;
}) {
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [tasks, setTasks] = useState<LookaheadWeekTask[]>([]);
  const [holidays, setHolidays] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFailed(false);
      const planResult = await supabase
        .from("lookahead_plans")
        .select("id, published_at")
        .eq("job_id", jobId)
        .eq("status", "published")
        .maybeSingle();
      if (cancelled) return;
      if (planResult.error) {
        setFailed(true);
        setLoading(false);
        return;
      }
      const published = planResult.data as PlanRow | null;
      setPlan(published);
      if (!published) {
        setTasks([]);
        setHolidays(new Map());
        setLoading(false);
        return;
      }

      const [taskResult, holidayResult] = await Promise.all([
        supabase
          .from("lookahead_tasks")
          .select("id, name, group_name, contractor_name, sort_order")
          .eq("plan_id", published.id)
          .order("sort_order"),
        supabase
          .from("lookahead_plan_holidays")
          .select("holiday_date, label")
          .eq("plan_id", published.id),
      ]);
      if (cancelled) return;
      if (taskResult.error || holidayResult.error) {
        setFailed(true);
        setLoading(false);
        return;
      }
      const taskRows = (taskResult.data ?? []) as TaskRow[];
      const holidayRows = (holidayResult.data ?? []) as HolidayRow[];
      setHolidays(new Map(holidayRows.map((row) => [row.holiday_date, row.label])));
      if (taskRows.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }
      const dayResult = await supabase
        .from("lookahead_task_days")
        .select("task_id, work_date")
        .in("task_id", taskRows.map((row) => row.id));
      if (cancelled) return;
      if (dayResult.error) {
        setFailed(true);
        setLoading(false);
        return;
      }
      const daysByTask = new Map<string, string[]>();
      for (const row of (dayResult.data ?? []) as DayRow[]) {
        const list = daysByTask.get(row.task_id) ?? [];
        list.push(row.work_date);
        daysByTask.set(row.task_id, list);
      }
      setTasks(taskRows.map((row) => ({
        id: row.id,
        name: row.name,
        groupName: row.group_name ?? "",
        contractorName: row.contractor_name,
        days: daysByTask.get(row.id) ?? [],
      })));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const title = jobNumber ? `${jobName} (${jobNumber})` : jobName;

  return (
    <section
      aria-label="Task look-ahead"
      data-testid="lookahead-grid"
      className="space-y-3 rounded-2xl border border-border bg-surface p-3 sm:p-4"
    >
      <div>
        <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Look ahead
        </h2>
        <p className="mt-1 text-sm font-medium">{title}</p>
        {plan && <p className="text-xs text-muted-foreground">{publishedLabel(plan.published_at)}</p>}
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : failed ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Couldn&apos;t load the look-ahead.</p>
      ) : !plan ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No published look-ahead for this job.</p>
      ) : (
        <LookaheadWeeks tasks={tasks} holidays={holidays} />
      )}
    </section>
  );
}
