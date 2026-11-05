import { todayInNewYork } from "@/lib/jobs";
import { formatWeekSpan, rollingLookaheadWindow, weekdayLabel } from "@/lib/lookaheadGrid";
import { cn } from "@/lib/utils";

export interface LookaheadWeekTask {
  id: string;
  name: string;
  groupName: string;
  contractorName: string;
  days: string[];
}

const taskCol =
  "sticky left-0 z-20 w-32 min-w-32 max-w-32 bg-surface px-2 text-left sm:w-40 sm:min-w-40 sm:max-w-40";
const whoCol =
  "sticky left-32 z-20 w-16 min-w-16 max-w-16 bg-surface px-1 text-left sm:left-40 sm:w-24 sm:min-w-24 sm:max-w-24";

export function LookaheadWeeks({
  tasks,
  holidays,
  asOf,
}: {
  tasks: LookaheadWeekTask[];
  holidays: ReadonlyMap<string, string>;
  asOf?: string;
}) {
  const today = asOf ?? todayInNewYork();
  const window = rollingLookaheadWindow(today);
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground">X marks a working day. HOL is a holiday.</p>
      <WeekBlock
        title="This week"
        range={formatWeekSpan(window.thisWeek[0], window.thisWeek[window.thisWeek.length - 1])}
        columns={window.thisWeek}
        tasks={tasks.filter((task) => task.days.some((day) => window.thisWeek.includes(day)))}
        holidays={holidays}
        today={today}
        empty="No work scheduled this week."
      />
      <WeekBlock
        title="Next 3 weeks"
        range={formatWeekSpan(window.nextWeeks[0], window.nextWeeks[window.nextWeeks.length - 1])}
        columns={window.nextWeeks}
        tasks={tasks.filter((task) => task.days.some((day) => window.nextWeeks.includes(day)))}
        holidays={holidays}
        today={today}
        empty="No work scheduled in the next 3 weeks."
        scrollId="lookahead-scroll"
      />
    </div>
  );
}

function WeekBlock({
  title,
  range,
  columns,
  tasks,
  holidays,
  today,
  empty,
  scrollId,
}: {
  title: string;
  range: string;
  columns: string[];
  tasks: LookaheadWeekTask[];
  holidays: ReadonlyMap<string, string>;
  today: string;
  empty: string;
  scrollId?: string;
}) {
  const weeks: string[][] = [];
  for (let index = 0; index < columns.length; index += 5) weeks.push(columns.slice(index, index + 5));
  let lastGroup = "";

  return (
    <section className="space-y-2" data-testid={title === "This week" ? "lookahead-this-week" : "lookahead-next-weeks"}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider">
        {title}
        <span className="ml-2 font-medium normal-case tracking-normal text-muted-foreground">{range}</span>
      </h3>
      <div className="overflow-x-auto" data-testid={scrollId}>
        <table className="w-max min-w-full border-collapse text-xs">
          <caption className="sr-only">{title}, Monday through Friday</caption>
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
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={2 + columns.length} className="px-2 py-3 text-muted-foreground">{empty}</td>
              </tr>
            ) : tasks.map((task) => {
              const group = task.groupName.trim();
              const showGroup = group.length > 0 && group !== lastGroup;
              if (showGroup) lastGroup = group;
              const marks = new Set(task.days);
              return (
                <TaskRows
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
    </section>
  );
}

function TaskRows({
  task,
  columns,
  marks,
  holidays,
  today,
  showGroup,
  group,
}: {
  task: LookaheadWeekTask;
  columns: string[];
  marks: Set<string>;
  holidays: ReadonlyMap<string, string>;
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
          <span className="block truncate">{task.contractorName}</span>
        </td>
        {columns.map((date) => {
          const holiday = holidays.get(date);
          const text = holiday ? "HOL" : marks.has(date) ? "X" : "";
          return (
            <td
              key={date}
              data-testid="lookahead-cell"
              data-task={task.name}
              data-date={date}
              className={cn(
                "w-8 min-w-8 border-l border-border px-0 py-2 text-center font-semibold",
                holiday && "bg-warning/30",
                date === today && !holiday && "bg-primary/20",
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
