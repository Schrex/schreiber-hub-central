import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown, ChevronRight, Search, Users, Wrench, Package, Clock, Hash, X,
  Filter, Briefcase, Truck, ListChecks, AlertTriangle, FileText, DollarSign,
  Target, ShieldAlert, Info, Calendar, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { EstimateUploads } from "./EstimateUploads";

interface Props { jobNumber: string | null }

interface Phase { id: string; code: string; name: string; short_label: string | null; color: string }
interface Crew { id: string; code: string; description: string; size: number }
interface Activity {
  id: string; bid_item_id: string; crew_id: string | null;
  code: string; description: string; qty: number; unit: string;
  rate: number | null; rate_by: string; manhours: number | null; equipment: string[];
  sort_order: number;
}
interface Material {
  id: string; bid_item_id: string; vendor: string | null;
  description: string; quantity: number; unit: string; sort_order: number;
}
interface BidItemRow {
  id: string; phase_id: string | null; item_code: string; description: string;
  quantity: number; unit: string; sub: string | null; sort_order: number;
}
interface BidItem extends BidItemRow {
  phase: Phase | null;
  activities: (Activity & { crew: Crew | null })[];
  materials: Material[];
}
interface Note { id: string; body: string; sort_order: number }
interface UnitPrice { id: string; code: string; name: string; unit: string; price: number; sort_order: number }

// ===== helpers (ported from prototype) =====
const fmtNum = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (Number.isInteger(n)) return n.toString();
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
};
const fmtMoney = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtHrs = (h: number | null | undefined) => {
  if (h == null || h === 0) return "—";
  const totalMins = Math.round(h * 60);
  if (totalMins <= 0) return "<1 min";
  if (totalMins < 60) return `${totalMins} min`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins === 0 ? `${hrs} hr` : `${hrs} hr ${mins} min`;
};

const computeActivity = (act: Activity & { crew: Crew | null }) => {
  const crewSize = act.crew?.size ?? 1;
  const isSub = act.crew?.code === "SUB";
  if (isSub || !act.rate || act.rate === 0) {
    return { crewHrs: 0, manHrs: 0, prodDisplay: isSub ? "Subcontracted" : "—", target: null as number | null, targetUnit: act.unit, shifts: null as number | null };
  }
  let crewHrs = 0; let prodDisplay = "";
  if (act.rate_by === "hr") { crewHrs = act.qty / act.rate; prodDisplay = `${fmtNum(act.rate)} ${act.unit}/hr`; }
  else if (act.rate_by === "shift") { crewHrs = (act.qty / act.rate) * 9; prodDisplay = `${fmtNum(act.rate)} ${act.unit}/shift`; }
  else if (act.rate_by === "invHr") { crewHrs = act.qty * act.rate; prodDisplay = `${fmtNum(act.rate)} hr/${act.unit}`; }
  const manHrs = crewHrs * crewSize;
  const shifts = crewHrs / 9;
  return { crewHrs, manHrs, prodDisplay, target: shifts > 0 ? act.qty / shifts : 0, targetUnit: act.unit, shifts };
};
const rollupItem = (item: BidItem) => {
  let crewHrs = 0, manHrs = 0, shifts = 0;
  item.activities.forEach((a) => { const c = computeActivity(a); crewHrs += c.crewHrs; manHrs += c.manHrs; shifts += c.shifts || 0; });
  return { crewHrs, manHrs, shifts };
};

export const JobInfoSection = ({ jobNumber }: Props) => {
  const [open, setOpen] = useState(false);
  if (!jobNumber) return null;
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
      <DialogContent className="max-h-[95vh] max-w-md overflow-y-auto p-0 bg-stone-100">
        <ForemanReport jobNumber={jobNumber} open={open} />
      </DialogContent>
    </Dialog>
  );
};

const ForemanReport = ({ jobNumber, open }: { jobNumber: string; open: boolean }) => {
  const [tab, setTab] = useState<"items" | "scope">("items");
  const [activePhase, setActivePhase] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bidItems, setBidItems] = useState<BidItem[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [exclusions, setExclusions] = useState<Note[]>([]);
  const [pricing, setPricing] = useState<UnitPrice[]>([]);
  const [jobName, setJobName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const cleaned = jobNumber.replace(/^J/i, "");
      const { data: jobRow } = await supabase.from("jobs").select("id,name")
        .or(`job_number.eq.${jobNumber},job_number.eq.${cleaned}`).maybeSingle();
      if (!jobRow || cancelled) { setLoading(false); return; }
      setJobName(jobRow.name);

      const [phRes, cRes, biRes, nRes, eRes, pRes] = await Promise.all([
        supabase.from("bid_phases").select("*").order("sort_order"),
        supabase.from("crews").select("*"),
        supabase.from("bid_items").select("*").eq("job_id", jobRow.id).order("sort_order"),
        supabase.from("job_notes").select("*").eq("job_id", jobRow.id).order("sort_order"),
        supabase.from("job_exclusions").select("*").eq("job_id", jobRow.id).order("sort_order"),
        supabase.from("job_unit_pricing").select("*").eq("job_id", jobRow.id).order("sort_order"),
      ]);
      const phaseList = (phRes.data ?? []) as Phase[];
      const crewList = (cRes.data ?? []) as Crew[];
      const items = (biRes.data ?? []) as BidItemRow[];
      const itemIds = items.map((i) => i.id);

      let activities: Activity[] = [];
      let materials: Material[] = [];
      if (itemIds.length) {
        const [aRes, mRes] = await Promise.all([
          supabase.from("bid_item_activities").select("*").in("bid_item_id", itemIds).order("sort_order"),
          supabase.from("bid_item_materials").select("*").in("bid_item_id", itemIds).order("sort_order"),
        ]);
        activities = (aRes.data ?? []) as Activity[];
        materials = (mRes.data ?? []) as Material[];
      }

      const phaseById = new Map(phaseList.map((p) => [p.id, p]));
      const crewById = new Map(crewList.map((c) => [c.id, c]));
      const actByItem = new Map<string, (Activity & { crew: Crew | null })[]>();
      activities.forEach((a) => {
        const arr = actByItem.get(a.bid_item_id) ?? [];
        arr.push({ ...a, crew: a.crew_id ? crewById.get(a.crew_id) ?? null : null });
        actByItem.set(a.bid_item_id, arr);
      });
      const matByItem = new Map<string, Material[]>();
      materials.forEach((m) => {
        const arr = matByItem.get(m.bid_item_id) ?? []; arr.push(m); matByItem.set(m.bid_item_id, arr);
      });

      if (cancelled) return;
      setPhases(phaseList);
      setBidItems(items.map((it) => ({
        ...it,
        phase: it.phase_id ? phaseById.get(it.phase_id) ?? null : null,
        activities: actByItem.get(it.id) ?? [],
        materials: matByItem.get(it.id) ?? [],
      })));
      setNotes((nRes.data ?? []) as Note[]);
      setExclusions((eRes.data ?? []) as Note[]);
      setPricing((pRes.data ?? []) as UnitPrice[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, jobNumber]);

  const totals = useMemo(() => {
    let manHrs = 0, crewHrs = 0, maxItemMh = 0;
    bidItems.forEach((b) => { const r = rollupItem(b); manHrs += r.manHrs; crewHrs += r.crewHrs; if (r.manHrs > maxItemMh) maxItemMh = r.manHrs; });
    return { manHrs, crewHrs, maxItemMh };
  }, [bidItems]);

  const phaseCounts = useMemo(() => {
    const c: Record<string, number> = {};
    bidItems.forEach((b) => { if (b.phase) c[b.phase.code] = (c[b.phase.code] || 0) + 1; });
    return c;
  }, [bidItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bidItems.filter((b) => {
      if (activePhase !== "ALL" && b.phase?.code !== activePhase) return false;
      if (!q) return true;
      return b.description.toLowerCase().includes(q) || b.item_code.includes(q)
        || b.activities.some((a) => a.description.toLowerCase().includes(q) || a.code.includes(q))
        || b.materials.some((m) => m.description.toLowerCase().includes(q));
    });
  }, [bidItems, activePhase, search]);

  const phaseList = phases.filter((p) => phaseCounts[p.code]);

  return (
    <div className="bg-stone-100 min-h-[80vh] pb-20" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 border-b border-stone-200">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F5C418' }}>
              <Truck size={18} className="text-stone-900" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-500">Schreiber</div>
              <div className="text-[11px] -mt-0.5 font-bold text-stone-900">J{jobNumber.replace(/^J/i, "")} · {jobName}</div>
            </div>
          </div>
        </div>

        {tab === "items" ? (
          <>
            <h1 className="text-2xl font-black text-stone-900 leading-none mb-3 tracking-tight">Bid Items</h1>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Stat label="Items" value={bidItems.length.toString()} />
              <Stat label="Crew Hrs" value={fmtNum(totals.crewHrs)} />
              <Stat label="Man Hrs" value={fmtNum(totals.manHrs)} />
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bid item, activity, material…"
                className="w-full bg-stone-100 border border-stone-200 rounded-lg pl-9 pr-9 py-2.5 text-[13px] text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-stone-200 rounded">
                  <X size={14} className="text-stone-500" />
                </button>
              )}
            </div>
          </>
        ) : (
          <h1 className="text-2xl font-black text-stone-900 leading-none tracking-tight">Scope & Pricing</h1>
        )}
      </div>

      {/* Phase chips */}
      {tab === "items" && (
        <div className="bg-white border-b border-stone-200 px-3 py-3 sticky top-0 z-10">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            <PhaseChip label="All" color="#F5C418" active={activePhase === "ALL"} count={bidItems.length} onClick={() => setActivePhase("ALL")} />
            {phaseList.map((p) => (
              <PhaseChip key={p.id} label={p.name} color={p.color} active={activePhase === p.code} count={phaseCounts[p.code]} onClick={() => setActivePhase(p.code)} />
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      {tab === "items" ? (
        <div className="px-3 py-3 space-y-2">
          {loading ? (
            <div className="text-center py-12 text-stone-400 text-sm">Loading bid items…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm">
              <Filter size={32} className="mx-auto mb-2 opacity-40" />
              No bid items match your filter.
            </div>
          ) : (
            filtered.map((item) => (
              <BidItemCard key={item.id} item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                totalManHrs={totals.maxItemMh} />
            ))
          )}
        </div>
      ) : (
        <ScopeCard notes={notes} exclusions={exclusions} pricing={pricing} />
      )}

      {/* Bottom tabs */}
      <div className="sticky bottom-0 bg-white border-t border-stone-200 grid grid-cols-2 z-20">
        <TabBtn active={tab === "items"} onClick={() => setTab("items")} icon={<ListChecks size={20} strokeWidth={tab === "items" ? 2.5 : 2} />} label="Bid Items" />
        <TabBtn active={tab === "scope"} onClick={() => setTab("scope")} icon={<ShieldAlert size={20} strokeWidth={tab === "scope" ? 2.5 : 2} />} label="Scope Card" />
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-stone-50 rounded-xl p-2.5 text-center border border-stone-200/60">
    <div className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-0.5">{label}</div>
    <div className="text-xl font-black text-stone-900 tabular-nums leading-none">{value}</div>
  </div>
);

const PhaseChip = ({ label, color, active, count, onClick }: { label: string; color: string; active: boolean; count: number; onClick: () => void }) => (
  <button onClick={onClick}
    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase transition-all border ${active ? "text-white shadow-sm" : "text-stone-700 bg-white border-stone-200 hover:border-stone-300"}`}
    style={active ? { backgroundColor: color, borderColor: color } : {}}>
    {label} <span className={`ml-1 ${active ? "opacity-80" : "text-stone-400"}`}>{count}</span>
  </button>
);

const TabBtn = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-0.5 py-2.5 transition-colors relative ${active ? "text-stone-900" : "text-stone-400"}`}>
    {icon}
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    {active && <div className="absolute top-0 w-12 h-0.5 rounded-full" style={{ backgroundColor: "#F5C418" }} />}
  </button>
);

const ActivityRow = ({ act }: { act: Activity & { crew: Crew | null } }) => {
  const { prodDisplay, target, targetUnit, shifts, crewHrs, manHrs } = computeActivity(act);
  const isSub = act.crew?.code === "SUB";
  return (
    <div className="border-l-2 border-amber-400 pl-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono font-bold text-stone-400 tabular-nums mb-0.5">{act.code}</div>
          <div className="font-semibold text-stone-900 text-[14px] leading-tight">{act.description}</div>
        </div>
        <div className="text-right tabular-nums flex-shrink-0">
          <div className="text-sm font-bold text-stone-900">{fmtNum(act.qty)} <span className="text-stone-500 font-normal text-xs">{act.unit}</span></div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
        <div className="flex items-center gap-1.5 text-stone-700">
          <Users size={12} className="text-stone-400 flex-shrink-0" />
          {isSub ? <span className="text-stone-600 italic font-medium">Subcontracted</span>
            : act.crew ? <><span className="font-mono font-bold text-stone-900">{act.crew.code}</span><span className="text-stone-500 truncate">· {act.crew.size}-man</span></>
            : <span className="text-stone-400">—</span>}
        </div>
        <div className="flex items-center gap-1.5 text-stone-700">
          <Clock size={12} className="text-stone-400 flex-shrink-0" />
          <span className="tabular-nums font-semibold">{prodDisplay}</span>
        </div>
        {!isSub && (
          <div className="flex items-center gap-1.5 text-stone-700 col-span-2 flex-wrap">
            <span className="text-stone-400 text-[10px] font-bold uppercase tracking-wider">Crew</span>
            <span className="tabular-nums font-bold text-stone-900">{fmtHrs(crewHrs)}</span>
            <span className="text-stone-300 mx-1">·</span>
            <span className="text-stone-400 text-[10px] font-bold uppercase tracking-wider">Man</span>
            <span className="tabular-nums font-bold text-stone-900">{fmtHrs(manHrs)}</span>
          </div>
        )}
      </div>
      {target !== null && !isSub && shifts !== null && shifts > 0 && (
        <div className="mt-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
          <Target size={13} className="text-amber-700 flex-shrink-0" />
          <div className="flex-1 flex items-baseline gap-1.5 text-[12px] flex-wrap">
            {shifts >= 1 ? (
              <>
                <span className="font-black text-stone-900 tabular-nums">{fmtNum(Math.round(target * 10) / 10)}</span>
                <span className="text-stone-700 font-semibold">{targetUnit}/shift</span>
                <span className="text-stone-300 mx-0.5">·</span>
                <span className="font-black text-stone-900 tabular-nums">{fmtNum(Math.round(shifts * 10) / 10)}</span>
                <span className="text-stone-600">shifts total</span>
              </>
            ) : (
              <><span className="font-black text-stone-900">{fmtHrs(crewHrs)}</span><span className="text-stone-600">total · finishes in part of a shift</span></>
            )}
          </div>
        </div>
      )}
      {act.equipment && act.equipment.length > 0 && (
        <div className="mt-2 flex items-start gap-1.5">
          <Wrench size={11} className="text-stone-400 mt-0.5 flex-shrink-0" />
          <div className="flex flex-wrap gap-1">
            {act.equipment.map((e, i) => (
              <span key={i} className="text-[10px] bg-stone-100 text-stone-700 rounded px-1.5 py-0.5 font-medium">{e}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const MaterialRow = ({ mat }: { mat: Material }) => (
  <div className="flex items-baseline justify-between gap-2 py-1.5 border-b border-stone-100 last:border-0">
    <div className="flex-1 min-w-0">
      <div className="text-[13px] font-medium text-stone-800 leading-tight">{mat.description}</div>
      {mat.vendor && <div className="text-[10px] uppercase tracking-wider text-stone-400 font-bold mt-0.5">{mat.vendor}</div>}
    </div>
    <div className="text-right flex-shrink-0">
      <div className="text-sm font-bold text-stone-900 tabular-nums">
        {fmtNum(mat.quantity)} <span className="text-stone-500 text-[11px] font-normal">{mat.unit}</span>
      </div>
    </div>
  </div>
);

const BidItemCard = ({ item, expanded, onToggle, totalManHrs }: { item: BidItem; expanded: boolean; onToggle: () => void; totalManHrs: number }) => {
  const rollup = useMemo(() => rollupItem(item), [item]);
  const pct = totalManHrs > 0 ? Math.min(100, (rollup.manHrs / totalManHrs) * 100) : 0;
  const phaseColor = item.phase?.color || "#6B7280";
  const phaseShort = item.phase?.short_label || item.phase?.code || "—";

  return (
    <div className={`bg-white rounded-2xl overflow-hidden transition-all ${expanded ? "shadow-md ring-1 ring-stone-200" : "shadow-sm"}`}>
      <button onClick={onToggle} className="w-full p-4 text-left active:bg-stone-50 transition-colors">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-1 self-stretch rounded-full mt-0.5" style={{ backgroundColor: phaseColor }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[11px] font-mono font-bold text-stone-400 tabular-nums">{item.item_code}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: phaseColor }}>{phaseShort}</span>
              {item.sub && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-200 text-stone-700">SUB</span>}
            </div>
            <div className="font-bold text-stone-900 text-[15px] leading-tight pr-2">{item.description}</div>
            <div className="mt-2 flex items-center gap-3 text-[11px] tabular-nums flex-wrap">
              <div className="flex items-center gap-1"><Hash size={11} className="text-stone-400" /><span className="font-bold text-stone-700">{fmtNum(item.quantity)}</span><span className="text-stone-400">{item.unit}</span></div>
              <div className="text-stone-300">·</div>
              <div className="flex items-center gap-1"><Clock size={11} className="text-stone-400" /><span className="text-stone-400">man</span><span className="font-bold text-stone-700">{fmtHrs(rollup.manHrs)}</span></div>
              {rollup.shifts >= 0.1 && (
                <>
                  <div className="text-stone-300">·</div>
                  <div className="flex items-center gap-1"><Calendar size={11} className="text-stone-400" /><span className="font-bold text-stone-700">{rollup.shifts < 0.5 ? "<½" : fmtNum(Math.round(rollup.shifts * 10) / 10)}</span><span className="text-stone-400">shifts</span></div>
                </>
              )}
            </div>
            <div className="mt-2.5 h-1 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: "#F5C418" }} />
            </div>
          </div>
          <div className="flex-shrink-0 self-center">
            {expanded ? <ChevronDown size={20} className="text-stone-400" /> : <ChevronRight size={20} className="text-stone-400" />}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-stone-100 bg-stone-50/40">
          {item.sub && (
            <div className="mx-4 mt-3 px-3 py-2 bg-stone-200/60 rounded-lg flex items-start gap-2">
              <Info size={13} className="text-stone-600 flex-shrink-0 mt-0.5" />
              <div className="text-[12px] text-stone-700 leading-tight"><span className="font-bold">Subcontracted to:</span> {item.sub}</div>
            </div>
          )}
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center gap-1.5 mb-2">
              <Briefcase size={12} className="text-stone-500" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-500">Activities · Crew · Production</h4>
            </div>
            <div className="space-y-0">{item.activities.map((a) => <ActivityRow key={a.id} act={a} />)}</div>
          </div>
          <div className="px-4 pt-3 pb-4 mt-2 border-t border-stone-100">
            <div className="flex items-center gap-1.5 mb-2">
              <Package size={12} className="text-stone-500" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-500">Materials {item.materials.length > 0 && <span className="text-stone-400">· {item.materials.length}</span>}</h4>
            </div>
            {item.materials.length === 0 ? (
              <div className="text-[12px] text-stone-400 italic py-2">No permanent materials for this bid item.</div>
            ) : (
              <div>{item.materials.map((m) => <MaterialRow key={m.id} mat={m} />)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ScopeCard = ({ notes, exclusions, pricing }: { notes: Note[]; exclusions: Note[]; pricing: UnitPrice[] }) => (
  <div className="px-3 py-3 space-y-3">
    <div className="bg-stone-900 text-white rounded-2xl p-4 shadow-md">
      <div className="flex items-center gap-2 mb-1">
        <ShieldAlert size={18} className="text-amber-400" />
        <h2 className="text-lg font-black tracking-tight">Scope Card</h2>
      </div>
      <p className="text-[12px] text-stone-300 leading-tight">When the GC asks for something, check here first. If it's in <span className="font-bold text-amber-400">Exclusions</span>, it's a change order.</p>
    </div>

    {notes.length > 0 && (
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2">
          <FileText size={15} className="text-stone-700" />
          <h3 className="font-black text-stone-900 text-sm tracking-tight uppercase">Job Notes</h3>
        </div>
        <div className="px-4 py-3 space-y-2.5">
          {notes.map((n, i) => (
            <div key={n.id} className="flex gap-2.5">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-400 text-stone-900 text-[11px] font-black flex items-center justify-center tabular-nums">{i + 1}</div>
              <div className="text-[13px] text-stone-800 leading-snug pt-0.5">{n.body}</div>
            </div>
          ))}
        </div>
      </div>
    )}

    {exclusions.length > 0 && (
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden ring-2 ring-red-100">
        <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
          <AlertTriangle size={15} className="text-red-600" />
          <h3 className="font-black text-red-700 text-sm tracking-tight uppercase">Not Included</h3>
          <span className="ml-auto text-[10px] font-bold text-red-500">Change Order Required</span>
        </div>
        <div className="px-4 py-3 space-y-2">
          {exclusions.map((e) => (
            <div key={e.id} className="flex items-start gap-2 py-1 border-b border-stone-100 last:border-0">
              <X size={14} className="text-red-500 flex-shrink-0 mt-0.5" strokeWidth={3} />
              <div className="text-[13px] text-stone-800 leading-snug font-medium">{e.body}</div>
            </div>
          ))}
        </div>
      </div>
    )}

    {pricing.length > 0 && (
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2">
          <DollarSign size={15} className="text-emerald-700" />
          <h3 className="font-black text-stone-900 text-sm tracking-tight uppercase">Change Order Rates</h3>
        </div>
        <div className="divide-y divide-stone-100">
          {pricing.map((u) => (
            <div key={u.id} className="px-4 py-2.5 flex items-baseline justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono font-bold text-stone-400 tabular-nums">{u.code}</div>
                <div className="text-[13px] font-semibold text-stone-900 leading-tight">{u.name}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-base font-black text-stone-900 tabular-nums">{fmtMoney(Number(u.price))}</div>
                <div className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">per {u.unit}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);
