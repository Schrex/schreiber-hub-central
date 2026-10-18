import { errorMessage } from "@/lib/errorMessage";
import { useMemo, useState } from "react";
import { format, addDays, parseISO } from "date-fns";
import { Copy, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Section = "jobs" | "crew" | "tasks" | "off-work";
type Kind = "job" | "crew" | "task";
type Tile = {
  id: string;
  week_start: string;
  day_index: number;
  section: Section;
  kind: Kind;
  ref_id: string | null;
  label: string;
  color: string | null;
  sort_order: number;
  parent_tile_id: string | null;
};
type Profile = { user_id: string; display_name: string | null };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  weekStart: string;
  sourceTiles: Tile[];
  fieldEmployees: Profile[];
  onCopied: () => void;
};

type Scope = "all" | "job" | "crew";
type Unit = "day" | "week" | "month";

export function CopyForwardDialog({
  open,
  onOpenChange,
  weekStart,
  sourceTiles,
  fieldEmployees,
  onCopied,
}: Props) {
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>("all");
  const [jobTileId, setJobTileId] = useState<string>("");
  const [crewUserId, setCrewUserId] = useState<string>("");
  const [unit, setUnit] = useState<Unit>("week");
  const [count, setCount] = useState<number>(1);
  const [busy, setBusy] = useState(false);

  // Job options come from job tiles in the source week (deduped by ref_id, latest label wins)
  const jobOptions = useMemo(() => {
    const map = new Map<string, { ref_id: string; label: string; tileIds: string[] }>();
    sourceTiles
      .filter((t) => t.section === "jobs" && t.kind === "job" && t.ref_id)
      .forEach((t) => {
        const existing = map.get(t.ref_id!);
        if (existing) existing.tileIds.push(t.id);
        else map.set(t.ref_id!, { ref_id: t.ref_id!, label: t.label, tileIds: [t.id] });
      });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [sourceTiles]);

  // Crew options = field employees who have any tile in the source week
  const crewOptions = useMemo(() => {
    const placedIds = new Set(
      sourceTiles.filter((t) => t.kind === "crew" && t.ref_id).map((t) => t.ref_id as string),
    );
    return fieldEmployees.filter((p) => placedIds.has(p.user_id));
  }, [sourceTiles, fieldEmployees]);

  const previewSummary = useMemo(() => {
    const n = Math.max(1, Math.floor(count || 1));
    const totalDays = unit === "day" ? n : unit === "week" ? n * 7 : n * 28;
    const last = format(addDays(parseISO(weekStart), totalDays + 6), "MMM d");
    return `Through ~${last}`;
  }, [count, unit, weekStart]);

  const handleCopy = async () => {
    const n = Math.max(1, Math.floor(count || 1));
    if (scope === "job" && !jobTileId) {
      toast({ title: "Pick a job to copy", variant: "destructive" });
      return;
    }
    if (scope === "crew" && !crewUserId) {
      toast({ title: "Pick a crew member to copy", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      // Build the list of source tiles to consider
      let pool: Tile[] = sourceTiles;
      if (scope === "job") {
        const refId = jobOptions.find((j) => j.tileIds.includes(jobTileId))?.ref_id;
        if (!refId) throw new Error("Job not found");
        // All job tiles in the week with this ref_id, plus any crew under those tiles
        const jobTiles = sourceTiles.filter(
          (t) => t.section === "jobs" && t.ref_id === refId,
        );
        const jobTileIds = new Set(jobTiles.map((t) => t.id));
        const crewUnder = sourceTiles.filter(
          (t) => t.section === "crew" && t.parent_tile_id && jobTileIds.has(t.parent_tile_id),
        );
        pool = [...jobTiles, ...crewUnder];
      } else if (scope === "crew") {
        // Crew tiles for that user (assigned + off-work) and the parent jobs they sit under
        const crewTiles = sourceTiles.filter(
          (t) => t.kind === "crew" && t.ref_id === crewUserId,
        );
        const parentIds = new Set(
          crewTiles.map((t) => t.parent_tile_id).filter((x): x is string => !!x),
        );
        const parentJobs = sourceTiles.filter((t) => t.section === "jobs" && parentIds.has(t.id));
        pool = [...parentJobs, ...crewTiles];
      }

      // Determine destination "operations": list of (destWeekStart, dayOffset)
      // - day: a single op per day shift, accumulating
      // - week: n ops, one per week +1..+n
      // - month: n*4 ops, one per week +1..+4n
      type Op = { destWeek: string; dayOffset: number };
      const ops: Op[] = [];
      if (unit === "day") {
        for (let i = 1; i <= n; i++) {
          ops.push({ destWeek: weekStart, dayOffset: i });
        }
      } else {
        const weeks = unit === "week" ? n : n * 4;
        for (let i = 1; i <= weeks; i++) {
          const dest = format(addDays(parseISO(weekStart), i * 7), "yyyy-MM-dd");
          ops.push({ destWeek: dest, dayOffset: 0 });
        }
      }

      // Resolve overflow when shifting by days: if dayIdx + offset > 6, roll into next week.
      const shift = (
        weekStartIso: string,
        dayIdx: number,
        offset: number,
      ): { week_start: string; day_index: number } => {
        const total = dayIdx + offset;
        const weekJump = Math.floor(total / 7);
        const newDay = ((total % 7) + 7) % 7;
        const newWeek = format(addDays(parseISO(weekStartIso), weekJump * 7), "yyyy-MM-dd");
        return { week_start: newWeek, day_index: newDay };
      };

      // Pre-fetch destination weeks to dedupe (jobs & crew by ref_id per day; tasks by label)
      const destWeeks = new Set<string>();
      for (const op of ops) {
        for (const t of pool) {
          const { week_start } = shift(op.destWeek, t.day_index, op.dayOffset);
          destWeeks.add(week_start);
        }
      }
      const { data: existing, error: exErr } = await supabase
        .from("whiteboard_tiles")
        .select("week_start,day_index,section,kind,ref_id,label,parent_tile_id")
        .in("week_start", Array.from(destWeeks));
      if (exErr) throw exErr;
      const dedupeKey = (t: {
        week_start: string;
        day_index: number;
        section: string;
        kind: string;
        ref_id: string | null;
        label: string;
      }) =>
        t.kind === "task"
          ? `${t.week_start}|${t.day_index}|task|${t.label}`
          : `${t.week_start}|${t.day_index}|${t.section}|${t.ref_id ?? ""}`;
      const existingKeys = new Set((existing ?? []).map(dedupeKey));

      let inserted = 0;
      for (const op of ops) {
        // Phase 1: insert jobs first; collect map oldTileId → newTileId for that op
        const jobIdMap = new Map<string, string>();
        const jobTilesInPool = pool.filter((t) => t.section === "jobs");
        for (const t of jobTilesInPool) {
          const dest = shift(op.destWeek, t.day_index, op.dayOffset);
          const key = dedupeKey({ ...dest, section: t.section, kind: t.kind, ref_id: t.ref_id, label: t.label });
          // If a job with same ref_id already at dest day, reuse its id as the parent target
          const dupe = (existing ?? []).find(
            (e) =>
              e.week_start === dest.week_start &&
              e.day_index === dest.day_index &&
              e.section === "jobs" &&
              e.ref_id === t.ref_id,
          ) as { id?: string } | undefined;
          if (dupe && existingKeys.has(key)) {
            // We need its real id; fetch
            const { data: row } = await supabase
              .from("whiteboard_tiles")
              .select("id")
              .eq("week_start", dest.week_start)
              .eq("day_index", dest.day_index)
              .eq("section", "jobs")
              .eq("ref_id", t.ref_id!)
              .maybeSingle();
            if (row?.id) jobIdMap.set(t.id, row.id as string);
            continue;
          }
          const { data: ins, error: insErr } = await supabase
            .from("whiteboard_tiles")
            .insert({
              week_start: dest.week_start,
              day_index: dest.day_index,
              section: t.section,
              kind: t.kind,
              ref_id: t.ref_id,
              label: t.label,
              sort_order: t.sort_order,
              parent_tile_id: null,
              created_by: user?.id ?? null,
            })
            .select("id")
            .maybeSingle();
          if (insErr) throw insErr;
          if (ins?.id) {
            jobIdMap.set(t.id, ins.id as string);
            existingKeys.add(key);
            inserted++;
          }
        }

        // Phase 2: insert crew, tasks, off-work
        for (const t of pool) {
          if (t.section === "jobs") continue;
          const dest = shift(op.destWeek, t.day_index, op.dayOffset);
          const key = dedupeKey({ ...dest, section: t.section, kind: t.kind, ref_id: t.ref_id, label: t.label });
          if (existingKeys.has(key)) continue;
          const newParent = t.parent_tile_id ? jobIdMap.get(t.parent_tile_id) ?? null : null;
          // If original tile was under a job but the parent didn't carry over, skip (no place to put it)
          if (t.parent_tile_id && !newParent) continue;
          const { error: insErr } = await supabase.from("whiteboard_tiles").insert({
            week_start: dest.week_start,
            day_index: dest.day_index,
            section: t.section,
            kind: t.kind,
            ref_id: t.ref_id,
            label: t.label,
            sort_order: t.sort_order,
            parent_tile_id: newParent,
            created_by: user?.id ?? null,
          });
          if (insErr) throw insErr;
          existingKeys.add(key);
          inserted++;
        }
      }

      toast({
        title: "Copied forward",
        description: `${inserted} tile${inserted === 1 ? "" : "s"} created.`,
      });
      onCopied();
      onOpenChange(false);
    } catch (e: unknown) {
      toast({ title: "Copy failed", description: errorMessage(e, String(e)), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4" /> Copy schedule forward
          </DialogTitle>
          <DialogDescription>
            Copy from week of {format(parseISO(weekStart), "MMM d, yyyy")}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>What to copy</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)} className="space-y-1">
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="all" /> Entire schedule (jobs, crew, tasks, off-work)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="job" /> A specific job (and its assigned crew)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="crew" /> A specific crew member
              </label>
            </RadioGroup>
          </div>

          {scope === "job" && (
            <div className="space-y-1">
              <Label>Job</Label>
              <Select value={jobTileId} onValueChange={setJobTileId}>
                <SelectTrigger><SelectValue placeholder="Choose a job from this week" /></SelectTrigger>
                <SelectContent>
                  {jobOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No jobs on this week.</div>
                  ) : (
                    jobOptions.map((j) => (
                      <SelectItem key={j.ref_id} value={j.tileIds[0]}>{j.label}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {scope === "crew" && (
            <div className="space-y-1">
              <Label>Crew member</Label>
              <Select value={crewUserId} onValueChange={setCrewUserId}>
                <SelectTrigger><SelectValue placeholder="Choose a crew member placed this week" /></SelectTrigger>
                <SelectContent>
                  {crewOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No crew placed on this week.</div>
                  ) : (
                    crewOptions.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.display_name ?? "Unknown"}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>How far forward</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={52}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value || "1", 10))}
                className="w-20"
              />
              <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">day(s)</SelectItem>
                  <SelectItem value="week">week(s)</SelectItem>
                  <SelectItem value="month">month(s) (~4 weeks)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">{previewSummary}. Existing tiles won't be duplicated.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleCopy} disabled={busy}>
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Copying…</> : "Copy forward"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
