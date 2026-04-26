import { useEffect, useMemo, useState } from "react";
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
  Wrench,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { JOB_INFO, type JobInfo } from "./jobInfoData";

interface Props {
  jobNumber: string | null;
}

interface PhaseRow { id: string; code: string; name: string; sort_order: number }
interface CrewRow { id: string; code: string; description: string; size: number }
interface EquipRow { id: string; activity_id: string; code: string; description: string; share_of_shift: number }
interface ActivityRow {
  id: string;
  bid_item_id: string;
  crew_id: string | null;
  description: string;
  production_rate: number | null;
  production_unit: string | null;
  manhours: number;
  shifts: number;
  sort_order: number;
}
interface MaterialRow {
  id: string;
  bid_item_id: string;
  vendor: string | null;
  description: string;
  quantity: number;
  unit: string;
  sort_order: number;
}
interface BidItemRow {
  id: string;
  job_id: string;
  phase_id: string | null;
  item_code: string;
  description: string;
  quantity: number;
  unit: string;
  sort_order: number;
}

interface BidItemView extends BidItemRow {
  phase?: PhaseRow;
  activities: (ActivityRow & { crew?: CrewRow; equipment: EquipRow[] })[];
  materials: MaterialRow[];
}

export const JobInfoSection = ({ jobNumber }: Props) => {
  const [open, setOpen] = useState(false);
  const staticInfo: JobInfo | undefined = useMemo(() => {
    if (!jobNumber) return undefined;
    const raw = jobNumber.trim();
    const noJ = raw.replace(/^J/i, "");
    const withJ = `J${noJ}`;
    return JOB_INFO[raw] ?? JOB_INFO[withJ] ?? JOB_INFO[noJ];
  }, [jobNumber]);

  if (!staticInfo) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="flex-1 text-left">
            <span className="block text-sm font-semibold">Job Report</span>
            <span className="block text-[10px] font-normal text-muted-foreground">
              Bid items · activities · crews · materials
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
        <Body info={staticInfo} jobNumber={jobNumber!} open={open} />
      </DialogContent>
    </Dialog>
  );
};

const Body = ({ info, jobNumber, open }: { info: JobInfo; jobNumber: string; open: boolean }) => {
  const [bidItems, setBidItems] = useState<BidItemView[] | null>(null);
  const [phases, setPhases] = useState<PhaseRow[]>([]);
  const [activePhase, setActivePhase] = useState<string | "ALL">("ALL");
  const [groups, setGroups] = useState<Record<string, boolean>>({
    bids: true,
    schedule: false,
    subs: false,
    notes: false,
  });
  const toggle = (k: string) => setGroups((g) => ({ ...g, [k]: !g[k] }));

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const cleanedNum = jobNumber.replace(/^J/i, "");
      const { data: jobRow } = await supabase
        .from("jobs")
        .select("id")
        .or(`job_number.eq.${jobNumber},job_number.eq.${cleanedNum}`)
        .maybeSingle();
      if (!jobRow || cancelled) { setBidItems([]); return; }

      const [phasesRes, crewsRes, itemsRes] = await Promise.all([
        supabase.from("bid_phases").select("*").order("sort_order"),
        supabase.from("crews").select("*"),
        supabase.from("bid_items").select("*").eq("job_id", jobRow.id).order("sort_order"),
      ]);
      const phaseList = (phasesRes.data ?? []) as PhaseRow[];
      const crewList = (crewsRes.data ?? []) as CrewRow[];
      const items = (itemsRes.data ?? []) as BidItemRow[];
      if (!items.length) { if (!cancelled) { setPhases(phaseList); setBidItems([]); } return; }
      const itemIds = items.map((i) => i.id);

      const [actRes, matRes] = await Promise.all([
        supabase.from("bid_item_activities").select("*").in("bid_item_id", itemIds).order("sort_order"),
        supabase.from("bid_item_materials").select("*").in("bid_item_id", itemIds).order("sort_order"),
      ]);
      const activities = (actRes.data ?? []) as ActivityRow[];
      const materials = (matRes.data ?? []) as MaterialRow[];

      const actIds = activities.map((a) => a.id);
      const equipRes = actIds.length
        ? await supabase.from("activity_equipment").select("*").in("activity_id", actIds).order("sort_order")
        : { data: [] as EquipRow[] };
      const equipment = (equipRes.data ?? []) as EquipRow[];

      const phaseById = new Map(phaseList.map((p) => [p.id, p]));
      const crewById = new Map(crewList.map((c) => [c.id, c]));
      const equipByAct = new Map<string, EquipRow[]>();
      equipment.forEach((e) => {
        const arr = equipByAct.get(e.activity_id) ?? [];
        arr.push(e); equipByAct.set(e.activity_id, arr);
      });
      const actByItem = new Map<string, ActivityRow[]>();
      activities.forEach((a) => {
        const arr = actByItem.get(a.bid_item_id) ?? [];
        arr.push(a); actByItem.set(a.bid_item_id, arr);
      });
      const matByItem = new Map<string, MaterialRow[]>();
      materials.forEach((m) => {
        const arr = matByItem.get(m.bid_item_id) ?? [];
        arr.push(m); matByItem.set(m.bid_item_id, arr);
      });

      const view: BidItemView[] = items.map((it) => ({
        ...it,
        phase: it.phase_id ? phaseById.get(it.phase_id) : undefined,
        activities: (actByItem.get(it.id) ?? []).map((a) => ({
          ...a,
          crew: a.crew_id ? crewById.get(a.crew_id) : undefined,
          equipment: equipByAct.get(a.id) ?? [],
        })),
        materials: matByItem.get(it.id) ?? [],
      }));

      if (!cancelled) {
        setPhases(phaseList);
        setBidItems(view);
      }
    })();
    return () => { cancelled = true; };
  }, [open, jobNumber]);

  const longestPhase = info.phases.reduce((m, p) => Math.max(m, p.manhours), 0);
  const visibleItems = (bidItems ?? []).filter(
    (it) => activePhase === "ALL" || it.phase?.id === activePhase,
  );

  return (
    <div>
      {/* Topline */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Manhours" value={info.totalManhours.toLocaleString()} />
        <Stat
          label="Shifts"
          value={info.totalShifts.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          hint={`${info.hoursPerShift}h/shift`}
        />
        <Stat label="Estimator" value={info.estimator.split(" ")[0]} hint={info.proposalDate} />
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">Plans used: {info.planSet}</p>

      {/* Bid Items drill-down */}
      <Group
        id="bids"
        title="Bid items"
        icon={<Layers className="h-3.5 w-3.5" />}
        open={groups.bids}
        onToggle={toggle}
      >
        {bidItems === null ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Loading bid items…</p>
        ) : bidItems.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No bid items yet for this job.
          </p>
        ) : (
          <>
            {/* Phase chips */}
            <div className="sticky top-0 -mx-1 mb-2 flex gap-1.5 overflow-x-auto bg-background/95 px-1 py-1 backdrop-blur">
              <PhaseChip label="All" active={activePhase === "ALL"} onClick={() => setActivePhase("ALL")} />
              {phases
                .filter((p) => bidItems.some((it) => it.phase?.id === p.id))
                .map((p) => (
                  <PhaseChip
                    key={p.id}
                    label={`${p.code} · ${p.name}`}
                    active={activePhase === p.id}
                    onClick={() => setActivePhase(p.id)}
                  />
                ))}
            </div>
            <ul className="space-y-2">
              {visibleItems.map((it) => (
                <BidItemCard key={it.id} item={it} />
              ))}
            </ul>
          </>
        )}
      </Group>

      {/* Schedule by phase */}
      <Group
        id="schedule"
        title="Schedule by phase"
        icon={<Clock className="h-3.5 w-3.5" />}
        open={groups.schedule}
        onToggle={toggle}
      >
        <ul className="space-y-1.5">
          {info.phases.slice().sort((a, b) => b.manhours - a.manhours).map((p) => {
            const pct = (p.manhours / longestPhase) * 100;
            return (
              <li key={p.code} className="text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    <span className="font-mono text-[10px] text-muted-foreground mr-1.5">{p.code}</span>
                    {p.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {p.manhours.toLocaleString()} mh ·{" "}
                    {p.shifts.toLocaleString(undefined, { maximumFractionDigits: 1 })} shifts
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Group>

      {/* Subs */}
      <Group
        id="subs"
        title="Subcontractors"
        icon={<Users className="h-3.5 w-3.5" />}
        open={groups.subs}
        onToggle={toggle}
      >
        <ul className="divide-y divide-border rounded-lg border border-border">
          {info.subs.map((s) => (
            <li key={s.scope} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{s.scope}</span>
                {s.vendor && (
                  <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{s.vendor}</span>
                )}
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums">
                {s.qty.toLocaleString()} {s.unit}
              </span>
            </li>
          ))}
        </ul>
      </Group>

      {/* In/out of scope */}
      <Group
        id="notes"
        title="What's in / out of scope"
        icon={<Info className="h-3.5 w-3.5" />}
        open={groups.notes}
        onToggle={toggle}
      >
        <div className="space-y-3">
          <div>
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Included / clarifications
            </p>
            <ul className="space-y-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
              {info.inclusions.map((i, idx) => (
                <li key={idx} className="text-xs leading-relaxed">• {i}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-destructive">
              <AlertTriangle className="h-3 w-3" /> Excluded — change order if needed
            </p>
            <ul className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
              {info.exclusions.map((e, idx) => (
                <li key={idx} className="text-xs leading-relaxed">• {e}</li>
              ))}
            </ul>
          </div>
          {info.notes.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-border bg-background p-2.5">
              {info.notes.map((n, idx) => (
                <li key={idx} className="text-[11px] text-muted-foreground">• {n}</li>
              ))}
            </ul>
          )}
        </div>
      </Group>
    </div>
  );
};

const BidItemCard = ({ item }: { item: BidItemView }) => {
  const [expanded, setExpanded] = useState(false);
  const totalMh = item.activities.reduce((s, a) => s + Number(a.manhours || 0), 0);
  return (
    <li className="overflow-hidden rounded-xl border border-border bg-background">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">{item.item_code}</span>
            {item.phase && (
              <span className="rounded bg-primary/10 px-1 py-px text-[9px] font-bold uppercase tracking-wider text-primary">
                {item.phase.code}
              </span>
            )}
          </span>
          <span className="block text-xs font-semibold leading-tight">{item.description}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-mono text-[11px] tabular-nums">
            {Number(item.quantity).toLocaleString()} {item.unit}
          </span>
          {totalMh > 0 && (
            <span className="block text-[9px] text-muted-foreground">{totalMh.toLocaleString()} mh</span>
          )}
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-border bg-muted/20 px-3 py-3">
          {/* Activities */}
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <HardHat className="h-3 w-3" /> Activities
            </p>
            {item.activities.length === 0 ? (
              <p className="text-[11px] italic text-muted-foreground">No activities defined.</p>
            ) : (
              <ul className="space-y-2">
                {item.activities.map((a) => (
                  <li key={a.id} className="rounded-lg border border-border bg-background p-2">
                    <p className="text-xs font-semibold">{a.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {a.crew && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span className="font-mono">{a.crew.code}</span>
                          <span>· {a.crew.size} ppl</span>
                        </span>
                      )}
                      {Number(a.manhours) > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Number(a.manhours).toLocaleString()} mh
                        </span>
                      )}
                      {a.production_rate && (
                        <span>
                          {a.production_rate} {a.production_unit ?? ""}
                        </span>
                      )}
                    </div>
                    {a.equipment.length > 0 && (
                      <div className="mt-1.5">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                          <Wrench className="mr-0.5 inline h-2.5 w-2.5" /> Resources
                        </p>
                        <ul className="mt-0.5 flex flex-wrap gap-1">
                          {a.equipment.map((e) => (
                            <li
                              key={e.id}
                              className="rounded-full border border-border bg-muted/50 px-1.5 py-0.5 text-[10px]"
                            >
                              <span className="font-mono text-muted-foreground">{e.code}</span>
                              <span className="ml-1">{e.description}</span>
                              <span className="ml-1 text-muted-foreground">
                                · {Math.round(Number(e.share_of_shift) * 100)}%
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Materials */}
          {item.materials.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Package className="h-3 w-3" /> Materials
              </p>
              <ul className="divide-y divide-border rounded-lg border border-border bg-background">
                {item.materials.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
                    <span className="min-w-0 flex-1">
                      {m.vendor && (
                        <span className="mr-1.5 font-mono text-[10px] text-muted-foreground">
                          {m.vendor}
                        </span>
                      )}
                      {m.description}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums">
                      {Number(m.quantity).toLocaleString()} {m.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
};

const PhaseChip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
      active
        ? "bg-primary text-primary-foreground"
        : "border border-border bg-background text-muted-foreground hover:bg-muted"
    }`}
  >
    {label}
  </button>
);

const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="rounded-lg border border-border bg-background p-2">
    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
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

// Truck import kept available if you re-add equipment summary in future
void Truck;
