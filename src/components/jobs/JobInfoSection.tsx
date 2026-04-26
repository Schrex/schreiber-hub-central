import { useMemo, useState } from "react";
import {
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Clock,
  Truck,
  Package,
  HardHat,
  Users,
  AlertTriangle,
  CheckCircle2,
  Info,
  Lock,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { JOB_INFO, type JobInfo } from "./jobInfoData";

interface Props {
  jobNumber: string | null;
}

export const JobInfoSection = ({ jobNumber }: Props) => {
  const [open, setOpen] = useState(false);
  const info: JobInfo | undefined = useMemo(
    () => (jobNumber ? JOB_INFO[jobNumber] : undefined),
    [jobNumber],
  );
  if (!info) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="flex-1 text-left">
            <span className="block text-sm font-semibold">Job Report</span>
            <span className="block text-[10px] font-normal text-muted-foreground">
              Estimator data · scope · crews · materials
            </span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
            <Lock className="h-2.5 w-2.5" /> Foreman
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Job Report
          </DialogTitle>
        </DialogHeader>
        <Body info={info} />
      </DialogContent>
    </Dialog>
  );
};

const Body = ({ info }: { info: JobInfo }) => {
  const [open, setOpen] = useState<Record<string, boolean>>({
    schedule: true,
    scope: false,
    crew: false,
    materials: false,
    subs: false,
    notes: true,
  });
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const longestPhase = info.phases.reduce(
    (m, p) => Math.max(m, p.manhours),
    0,
  );

  return (
    <div>
      {/* Topline */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Manhours" value={info.totalManhours.toLocaleString()} />
        <Stat
          label="Shifts"
          value={info.totalShifts.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}
          hint={`${info.hoursPerShift}h/shift`}
        />
        <Stat label="Estimator" value={info.estimator.split(" ")[0]} hint={info.proposalDate} />
      </div>

      <p className="mt-2 text-[10px] text-muted-foreground">
        Plans used: {info.planSet}
      </p>

      {/* Schedule */}
      <Group
        id="schedule"
        title="Schedule by phase"
        icon={<Clock className="h-3.5 w-3.5" />}
        open={open.schedule}
        onToggle={toggle}
      >
        <ul className="space-y-1.5">
          {info.phases
            .slice()
            .sort((a, b) => b.manhours - a.manhours)
            .map((p) => {
              const pct = (p.manhours / longestPhase) * 100;
              return (
                <li key={p.code} className="text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      <span className="font-mono text-[10px] text-muted-foreground mr-1.5">
                        {p.code}
                      </span>
                      {p.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {p.manhours.toLocaleString()} mh ·{" "}
                      {p.shifts.toLocaleString(undefined, { maximumFractionDigits: 1 })} shifts
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
        </ul>
      </Group>

      {/* Scope */}
      <Group
        id="scope"
        title="Scope & quantities"
        icon={<Package className="h-3.5 w-3.5" />}
        open={open.scope}
        onToggle={toggle}
      >
        <div className="space-y-3">
          {info.scope.map((s) => (
            <div key={s.section}>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {s.section}
              </p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {s.items.map((it) => (
                  <li
                    key={`${s.section}-${it.code}-${it.desc}`}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-mono text-[10px] text-muted-foreground mr-1.5">
                        {it.code}
                      </span>
                      {it.desc}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums">
                      {it.qty.toLocaleString()} {it.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Group>

      {/* Crew & equipment */}
      <Group
        id="crew"
        title="Crews & equipment"
        icon={<HardHat className="h-3.5 w-3.5" />}
        open={open.crew}
        onToggle={toggle}
      >
        <div className="space-y-3">
          <div>
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Users className="h-3 w-3" /> Crews
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {info.crews.map((c) => (
                <li
                  key={c.code}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs"
                >
                  <span>
                    <span className="font-mono text-[10px] text-muted-foreground mr-1.5">
                      {c.code}
                    </span>
                    {c.desc}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {c.size} ppl
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Truck className="h-3 w-3" /> Key equipment
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {info.equipment.map((e) => (
                <li
                  key={e.code}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs"
                >
                  <span>
                    <span className="font-mono text-[10px] text-muted-foreground mr-1.5">
                      {e.code}
                    </span>
                    {e.desc}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {Math.round(e.shareOfShift * 100)}% of shift
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Group>

      {/* Materials */}
      <Group
        id="materials"
        title="Materials by vendor"
        icon={<Package className="h-3.5 w-3.5" />}
        open={open.materials}
        onToggle={toggle}
      >
        <div className="space-y-3">
          {info.materials.map((m) => (
            <div key={m.vendor}>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {m.vendor}
              </p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {m.lines.map((l) => (
                  <li
                    key={`${m.vendor}-${l.desc}`}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate">{l.desc}</span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums">
                      {l.qty.toLocaleString()} {l.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Group>

      {/* Subs */}
      <Group
        id="subs"
        title="Subcontractors"
        icon={<Users className="h-3.5 w-3.5" />}
        open={open.subs}
        onToggle={toggle}
      >
        <ul className="divide-y divide-border rounded-lg border border-border">
          {info.subs.map((s) => (
            <li
              key={s.scope}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs"
            >
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{s.scope}</span>
                {s.vendor && (
                  <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                    {s.vendor}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums">
                {s.qty.toLocaleString()} {s.unit}
              </span>
            </li>
          ))}
        </ul>
      </Group>

      {/* Notes / inclusions / exclusions */}
      <Group
        id="notes"
        title="What's in / out of scope"
        icon={<Info className="h-3.5 w-3.5" />}
        open={open.notes}
        onToggle={toggle}
      >
        <div className="space-y-3">
          <div>
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Included / clarifications
            </p>
            <ul className="space-y-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
              {info.inclusions.map((i, idx) => (
                <li key={idx} className="text-xs leading-relaxed">
                  • {i}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-destructive">
              <AlertTriangle className="h-3 w-3" /> Excluded — change order if needed
            </p>
            <ul className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
              {info.exclusions.map((e, idx) => (
                <li key={idx} className="text-xs leading-relaxed">
                  • {e}
                </li>
              ))}
            </ul>
          </div>
          {info.notes.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-border bg-background p-2.5">
              {info.notes.map((n, idx) => (
                <li key={idx} className="text-[11px] text-muted-foreground">
                  • {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Group>
    </section>
  );
};

const Stat = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) => (
  <div className="rounded-lg border border-border bg-background p-2">
    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
    <p className="font-display text-base font-bold leading-tight">{value}</p>
    {hint && <p className="text-[9px] text-muted-foreground">{hint}</p>}
  </div>
);

const Group = ({
  id,
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) => (
  <div className="mt-3 border-t border-border pt-3">
    <button
      type="button"
      onClick={() => onToggle(id)}
      className="flex w-full items-center justify-between gap-2 text-left"
    >
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
        {icon} {title}
      </span>
      {open ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
    {open && <div className="mt-2.5">{children}</div>}
  </div>
);
