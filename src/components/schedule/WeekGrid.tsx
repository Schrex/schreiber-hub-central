import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Profile = { user_id: string; display_name: string | null };
type Job = { id: string; name: string; job_number: string | null };
type Assignment = {
  id: string;
  job_id: string;
  user_id: string;
  assignment_date: string;
  start_time: string | null;
  jobs?: Job | null;
};
type WeekTimeOff = {
  user_id: string;
  start_date: string;
  end_date: string;
  type: string;
  half_day: string;
};

interface Props {
  weekDays: Date[];
  profiles: Profile[];
  assignments: Assignment[];
  timeOff: WeekTimeOff[];
  onCellClick: (dateStr: string) => void;
}

// Stable color per job from a small palette of design tokens
const JOB_PALETTE = [
  "bg-primary/15 text-primary border-primary/30",
  "bg-accent/20 text-accent-foreground border-accent/40",
  "bg-role-foreman/15 text-foreground border-role-foreman/40",
  "bg-role-office/15 text-foreground border-role-office/40",
  "bg-role-employee/15 text-foreground border-role-employee/40",
  "bg-role-admin/15 text-foreground border-role-admin/40",
];
const colorForJob = (id: string, jobIds: string[]) => {
  const idx = jobIds.indexOf(id);
  return JOB_PALETTE[idx % JOB_PALETTE.length];
};

export const WeekGrid = ({ weekDays, profiles, assignments, timeOff, onCellClick }: Props) => {
  const dayKeys = weekDays.map((d) => format(d, "yyyy-MM-dd"));
  const jobIds = Array.from(new Set(assignments.map((a) => a.job_id)));

  // Index assignments by user|date
  const cellMap = new Map<string, Assignment[]>();
  assignments.forEach((a) => {
    const k = `${a.user_id}|${a.assignment_date}`;
    const arr = cellMap.get(k) ?? [];
    arr.push(a);
    cellMap.set(k, arr);
  });
  const offMap = new Map<string, WeekTimeOff>();
  timeOff.forEach((t) => {
    dayKeys.forEach((d) => {
      if (d >= t.start_date && d <= t.end_date) offMap.set(`${t.user_id}|${d}`, t);
    });
  });

  // Stats per day
  const dayStats = dayKeys.map((d) => {
    let assigned = 0,
      off = 0;
    profiles.forEach((p) => {
      const k = `${p.user_id}|${d}`;
      if (cellMap.has(k)) assigned++;
      else if (offMap.has(k)) off++;
    });
    return { date: d, assigned, off, open: profiles.length - assigned - off };
  });

  return (
    <section>
      <div className="mb-2 flex items-end justify-between">
        <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Week overview · {format(weekDays[0], "MMM d")} – {format(weekDays[6], "MMM d")}
        </h2>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {profiles.length} crew
        </span>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-xs">
          <thead className="sticky top-0 bg-muted/40">
            <tr>
              <th className="sticky left-0 z-10 min-w-[140px] border-b border-r bg-muted/40 px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">
                Employee
              </th>
              {weekDays.map((d, i) => (
                <th
                  key={dayKeys[i]}
                  className="cursor-pointer border-b px-2 py-2 text-center font-semibold hover:bg-muted"
                  onClick={() => onCellClick(dayKeys[i])}
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {format(d, "EEE")}
                  </div>
                  <div className="text-sm">{format(d, "d")}</div>
                  <div className="mt-0.5 flex justify-center gap-1 text-[9px] font-normal">
                    <span className="text-primary">{dayStats[i].assigned}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-amber-600 dark:text-amber-400">{dayStats[i].off}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-muted-foreground">{dayStats[i].open}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.user_id} className="border-b last:border-b-0">
                <td className="sticky left-0 z-10 border-r bg-background px-3 py-2 font-medium">
                  {p.display_name ?? "Unnamed"}
                </td>
                {dayKeys.map((d) => {
                  const cellAsg = cellMap.get(`${p.user_id}|${d}`) ?? [];
                  const off = offMap.get(`${p.user_id}|${d}`);
                  return (
                    <td
                      key={d}
                      className="cursor-pointer border-l px-1.5 py-1.5 align-top hover:bg-muted/40"
                      onClick={() => onCellClick(d)}
                    >
                      {cellAsg.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {cellAsg.map((a) => (
                            <div
                              key={a.id}
                              className={cn(
                                "truncate rounded border px-1.5 py-0.5 text-[10px] font-medium",
                                colorForJob(a.job_id, jobIds),
                              )}
                              title={`${a.jobs?.name ?? ""}${a.start_time ? " · " + a.start_time.slice(0, 5) : ""}`}
                            >
                              {a.jobs?.job_number ? `#${a.jobs.job_number} ` : ""}
                              {a.jobs?.name ?? "Job"}
                            </div>
                          ))}
                        </div>
                      ) : off ? (
                        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-center text-[10px] font-medium text-amber-700 dark:text-amber-300">
                          {off.type}
                          {off.half_day !== "none" ? ` (${off.half_day.toUpperCase()})` : ""}
                        </div>
                      ) : (
                        <div className="text-center text-[10px] text-muted-foreground/50">—</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
        Tap any cell or day header to jump to that day
      </p>
    </section>
  );
};
