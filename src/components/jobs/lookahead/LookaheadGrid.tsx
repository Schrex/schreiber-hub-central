import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { todayInNewYork } from "@/lib/jobs";
import { formatMdYy, formatWeekSpan, planColumns, weekdayLabel } from "@/lib/lookaheadGrid";
import { cn } from "@/lib/utils";

interface PlanRow {
  id: string;
  week_start: string;
  weeks: number;
  status: string;
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

const taskCol =
  "sticky left-0 z-20 w-32 min-w-32 max-w-32 bg-surface px-2 text-left sm:w-40 sm:min-w-40 sm:max-w-40";
const whoCol =
  "sticky left-32 z-20 w-16 min-w-16 max-w-16 bg-surface px-1 text-left sm:left-40 sm:w-24 sm:min-w-24 sm:max-w-24";

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
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [marks, setMarks] = useState<Set<string>>(new Set());
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
        .select("id, week_start, weeks, status, published_at")
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
        setMarks(new Set());
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
      setTasks(taskRows);
      setHolidays(new Map(holidayRows.map((row) => [row.holiday_date, row.label])));

      if (taskRows.length === 0) {
        setMarks(new Set());
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
      const dayRows = (dayResult.data ?? []) as DayRow[];
      setMarks(new Set(dayRows.map((row) => `${row.task_id}|${row.work_date}`)));
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
        {plan && (
          <p className="text-xs text-muted-foreground">
            Week of {formatMdYy(plan.week_start)} ({plan.weeks} wks) · {publishedLabel(plan.published_at)}
          </p>
        )}
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : failed ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Couldn&apos;t load the look-ahead.</p>
      ) : !plan ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No published look-ahead for this job.</p>
      ) : (
        <Grid plan={plan} tasks={tasks} marks={marks} holidays={holidays} />
      )}
    </section>
  );
}

function Grid({
  plan,
  tasks,
  marks,
  holidays,
}: {
  plan: PlanRow;
  tasks: TaskRow[];
  marks: Set<string>;
  holidays: Map<string, string>;
}) {
  const columns = planColumns(plan.week_start, plan.weeks);
  const today = todayInNewYork();
  const weeks: string[][] = [];
  for (let index = 0; index < columns.length; index += 5) weeks.push(columns.slice(index, index + 5));
  let lastGroup = "";

  return (
    <>
      <p className="text-[11px] text-muted-foreground">X marks a working day. HOL is a holiday.</p>
      <div className="overflow-x-auto" data-testid="lookahead-scroll">
        <table className="w-max min-w-full border-collapse text-xs">
          <caption className="sr-only">Task look-ahead, Monday through Friday</caption>
          <thead>
            <tr>
              <th className={cn(taskCol, "z-30 bg-surface")} scope="col" />
              <th className={cn(whoCol, "z-30 bg-surface")} scope="col" />
              {weeks.map((week) => (
                <th
                  key={week[0]}
                  colSpan={week.length}
                  scope="colgroup"
                  className="border-b border-l border-border px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {formatWeekSpan(week[0], week[week.length - 1])}
                </th>
              ))}
            </tr>
            <tr className="border-b border-border">
              <th className={cn(taskCol, "z-30 bg-surface py-1 text-[10px] font-semibold uppercase tracking-wider")} scope="col">
                Task
              </th>
              <th className={cn(whoCol, "z-30 bg-surface py-1 text-[10px] font-semibold uppercase tracking-wider")} scope="col">
                Who
              </th>
              {columns.map((date) => {
                const holiday = holidays.has(date);
                const isToday = date === today && !holiday;
                return (
                  <th
                    key={date}
                    scope="col"
                    className={cn(
                      "w-8 min-w-8 border-l border-border px-0 py-1 text-center font-medium",
                      holiday && "bg-warning/30",
                      isToday && "bg-primary/20",
                    )}
                  >
                    <span className="block text-[10px] text-muted-foreground">{weekdayLabel(date)}</span>
                    <span className="block">{Number(date.slice(8))}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const group = task.group_name?.trim() ?? "";
              const showGroup = group.length > 0 && group !== lastGroup;
              if (showGroup) lastGroup = group;
              return (
                <GroupAndRow
                  key={task.id}
                  task={task}
                  columns={columns}
                  marks={marks}
                  holidays={holidays}
                  today={today}
                  showGroup={showGroup}
                  group={group}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function GroupAndRow({
  task,
  columns,
  marks,
  holidays,
  today,
  showGroup,
  group,
}: {
  task: TaskRow;
  columns: string[];
  marks: Set<string>;
  holidays: Map<string, string>;
  today: string;
  showGroup: boolean;
  group: string;
}) {
  return (
    <>
      {showGroup && (
        <tr>
          <th
            colSpan={2 + columns.length}
            data-testid="lookahead-group"
            className="bg-muted px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider"
          >
            <span className="sticky left-2">{group}</span>
          </th>
        </tr>
      )}
      <tr className="border-b border-border/70">
        <th className={cn(taskCol, "py-2 font-medium")} scope="row">
          <span className="block truncate" title={task.name}>{task.name}</span>
        </th>
        <td className={cn(whoCol, "py-2 text-[11px] text-muted-foreground")} data-testid="lookahead-who">
          <span className="block truncate">{task.contractor_name}</span>
        </td>
        {columns.map((date) => {
          const holiday = holidays.get(date);
          const marked = marks.has(`${task.id}|${date}`);
          const isToday = date === today && !holiday;
          const text = holiday ? "HOL" : marked ? "X" : "";
          return (
            <td
              key={date}
              data-testid="lookahead-cell"
              data-task={task.name}
              data-date={date}
              className={cn(
                "w-8 min-w-8 border-l border-border px-0 py-2 text-center font-semibold",
                holiday && "bg-warning/30",
                isToday && "bg-primary/20",
              )}
              title={holiday ?? undefined}
            >
              {text}
            </td>
          );
        })}
      </tr>
    </>
  );
}
