import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, X, Users, Moon, Copy, Truck } from "lucide-react";
import { CopyForwardDialog } from "@/components/whiteboard/CopyForwardDialog";
import { format, addDays, startOfWeek, parseISO } from "date-fns";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/BottomNav";
import { cn } from "@/lib/utils";

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

type Job = { id: string; name: string; job_number: string | null };
type Profile = { user_id: string; display_name: string | null; is_office: boolean };
type Dispatch = {
  id: string;
  dispatch_date: string;
  driver_user_id: string | null;
  driver_name: string | null;
  truck_number: string | null;
};

const dateAt = (weekStart: string, dayIdx: number) =>
  format(addDays(parseISO(weekStart), dayIdx), "yyyy-MM-dd");

const weekStartStr = (d: Date) => format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");

const Whiteboard = () => {
  const navigate = useNavigate();
  const { role: realRole, effectiveRole, user } = useAuth();
  const role = effectiveRole ?? realRole;
  const canUse = role === "office" || role === "admin" || role === "foreman";

  const [weekStart, setWeekStart] = useState<string>(weekStartStr(new Date()));
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<{ day: number; text: string } | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const tempCounter = useRef(0);
  const ignoreRealtimeUntilRef = useRef(0);
  const [showOffice, setShowOffice] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("schedule.showOffice") === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === "schedule.showOffice") setShowOffice(e.newValue === "1");
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      if (typeof detail === "boolean") setShowOffice(detail);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("schedule-show-office-changed", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("schedule-show-office-changed", onCustom as EventListener);
    };
  }, []);
  const updateShowOffice = (v: boolean) => {
    setShowOffice(v);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("schedule.showOffice", v ? "1" : "0");
      window.dispatchEvent(new CustomEvent("schedule-show-office-changed", { detail: v }));
    }
  };
  const days = useMemo(() => {
    const start = parseISO(weekStart);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekStart]);

  const markLocalChange = () => {
    ignoreRealtimeUntilRef.current = Date.now() + 2500;
  };

  const load = async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
    if (showLoading) setLoading(true);
    const weekEnd = format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd");
    const [tilesRes, jobsRes, profilesRes, rolesRes, dispatchRes] = await Promise.all([
      supabase.from("whiteboard_tiles").select("*").eq("week_start", weekStart).order("sort_order"),
      supabase.from("jobs").select("id,name,job_number").eq("status", "active").order("name"),
      supabase.from("profiles").select("user_id,display_name").eq("is_active", true).order("display_name"),
      supabase.from("user_roles").select("user_id,role"),
      supabase
        .from("dispatch_orders")
        .select("id,dispatch_date,driver_user_id,driver_name,truck_number")
        .gte("dispatch_date", weekStart)
        .lte("dispatch_date", weekEnd),
    ]);
    if (tilesRes.error) toast({ title: "Couldn't load board", description: tilesRes.error.message, variant: "destructive" });

    const rolesByUser = new Map<string, Set<string>>();
    ((rolesRes.data ?? []) as { user_id: string; role: string }[]).forEach((r) => {
      const s = rolesByUser.get(r.user_id) ?? new Set<string>();
      s.add(r.role);
      rolesByUser.set(r.user_id, s);
    });
    const isOffice = (uid: string) => {
      const s = rolesByUser.get(uid);
      if (!s) return false;
      const fieldRole = s.has("foreman") || s.has("employee");
      return (s.has("office") || s.has("admin")) && !fieldRole;
    };

    setTiles(((tilesRes.data ?? []) as Tile[]));
    setJobs(((jobsRes.data ?? []) as Job[]));
    setProfiles(
      ((profilesRes.data ?? []) as { user_id: string; display_name: string | null }[])
        .filter((p) => p.user_id)
        .map((p) => ({ ...p, is_office: isOffice(p.user_id) })),
    );
    setDispatches(((dispatchRes.data ?? []) as Dispatch[]));
    setLoading(false);
  };

  useEffect(() => {
    if (canUse) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, canUse]);

  // Realtime: background refresh on external changes, but don't refetch after our own optimistic moves.
  useEffect(() => {
    if (!canUse) return;
    const ch = supabase
      .channel(`wb-${weekStart}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whiteboard_tiles", filter: `week_start=eq.${weekStart}` },
        () => {
          if (Date.now() < ignoreRealtimeUntilRef.current) return;
          void load({ showLoading: false });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, canUse]);

  const placedJobIds = useMemo(() => new Set(tiles.filter((t) => t.kind === "job").map((t) => t.ref_id)), [tiles]);
  const availableJobs = useMemo(() => jobs.filter((j) => !placedJobIds.has(j.id)), [jobs, placedJobIds]);

  // Field employees (and optionally office staff). These auto-appear as unassigned per day
  // unless they're placed under a job or in Off Work for that day.
  const fieldEmployees = useMemo(
    () => (showOffice ? profiles : profiles.filter((p) => !p.is_office)),
    [profiles, showOffice],
  );

  const placedUserIdsByDay = useMemo(() => {
    const map = new Map<number, Set<string>>();
    for (let d = 0; d < 7; d++) map.set(d, new Set());
    tiles.forEach((t) => {
      if (t.kind === "crew" && t.ref_id && (t.section === "crew" || t.section === "off-work") && t.parent_tile_id) {
        // crew under a job
        map.get(t.day_index)!.add(t.ref_id);
      } else if (t.kind === "crew" && t.ref_id && t.section === "off-work") {
        map.get(t.day_index)!.add(t.ref_id);
      }
    });
    // Simpler: anything with kind=crew and ref_id is "placed" (job-assigned or off-work)
    return map;
  }, [tiles]);

  const dispatchesByDay = useMemo(() => {
    const map = new Map<number, Dispatch[]>();
    for (let d = 0; d < 7; d++) map.set(d, []);
    dispatches.forEach((d) => {
      const idx = days.findIndex((x) => format(x, "yyyy-MM-dd") === d.dispatch_date);
      if (idx >= 0) map.get(idx)!.push(d);
    });
    return map;
  }, [dispatches, days]);

  const placedUserIdsByDaySimple = useMemo(() => {
    const map = new Map<number, Set<string>>();
    for (let d = 0; d < 7; d++) map.set(d, new Set());
    tiles.forEach((t) => {
      if (t.kind === "crew" && t.ref_id) map.get(t.day_index)!.add(t.ref_id);
    });
    dispatchesByDay.forEach((list, idx) => {
      list.forEach((d) => {
        if (d.driver_user_id) map.get(idx)!.add(d.driver_user_id);
      });
    });
    return map;
  }, [tiles, dispatchesByDay]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const sortFor = (day: number, section: Section, parent: string | null) =>
    Math.max(
      0,
      ...tiles
        .filter((t) => t.day_index === day && t.section === section && (t.parent_tile_id ?? null) === parent)
        .map((t) => t.sort_order),
    );

  const jobRefForParent = (parentId: string | null): string | null => {
    if (!parentId) return null;
    const p = tiles.find((t) => t.id === parentId);
    return p && p.kind === "job" ? p.ref_id : null;
  };

  const syncAddAssignment = async (jobId: string, userId: string, dayIdx: number) => {
    const date = dateAt(weekStart, dayIdx);
    const { error } = await supabase
      .from("schedule_assignments")
      .upsert(
        [{ job_id: jobId, user_id: userId, assignment_date: date, start_time: "07:00", created_by: user?.id ?? null }],
        { onConflict: "job_id,user_id,assignment_date", ignoreDuplicates: true },
      );
    if (error) {
      toast({ title: "Schedule sync failed", description: error.message, variant: "destructive" });
    }
  };

  const syncRemoveAssignment = async (jobId: string, userId: string, dayIdx: number) => {
    const date = dateAt(weekStart, dayIdx);
    await supabase
      .from("schedule_assignments")
      .delete()
      .eq("job_id", jobId)
      .eq("user_id", userId)
      .eq("assignment_date", date);
  };

  const optimisticInsert = async (row: Omit<Tile, "id">) => {
    markLocalChange();
    const tempId = `tmp-${++tempCounter.current}`;
    const optimistic: Tile = { ...row, id: tempId };
    setTiles((prev) => [...prev, optimistic]);
    const { data, error } = await supabase
      .from("whiteboard_tiles")
      .insert({
        week_start: row.week_start,
        day_index: row.day_index,
        section: row.section,
        kind: row.kind,
        ref_id: row.ref_id,
        label: row.label,
        sort_order: row.sort_order,
        parent_tile_id: row.parent_tile_id,
        created_by: user?.id ?? null,
      })
      .select("*")
      .maybeSingle();
    if (error || !data) {
      setTiles((prev) => prev.filter((t) => t.id !== tempId));
      toast({ title: "Couldn't place tile", description: error?.message ?? "Unknown error", variant: "destructive" });
      return null;
    }
    setTiles((prev) => prev.map((t) => (t.id === tempId ? (data as Tile) : t)));
    // Mirror crew-under-job placements into the regular schedule
    if (row.kind === "crew" && row.section === "crew" && row.ref_id) {
      const jobId = jobRefForParent(row.parent_tile_id);
      if (jobId) await syncAddAssignment(jobId, row.ref_id, row.day_index);
    }
    return data as Tile;
  };

  const optimisticUpdate = async (id: string, patch: Partial<Tile>) => {
    const prevTile = tiles.find((t) => t.id === id);
    if (!prevTile) return;
    markLocalChange();
    setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    if (id.startsWith("tmp-")) return;
    const { error } = await supabase.from("whiteboard_tiles").update(patch).eq("id", id);
    if (error) {
      setTiles((prev) => prev.map((t) => (t.id === id ? prevTile : t)));
      toast({ title: "Move failed", description: error.message, variant: "destructive" });
      return;
    }
    // Sync schedule_assignments when a crew tile changes job/day
    if (prevTile.kind === "crew" && prevTile.ref_id) {
      const newSection = patch.section ?? prevTile.section;
      const newParent = patch.parent_tile_id !== undefined ? patch.parent_tile_id : prevTile.parent_tile_id;
      const newDay = patch.day_index ?? prevTile.day_index;
      const oldJobId = prevTile.section === "crew" ? jobRefForParent(prevTile.parent_tile_id) : null;
      const newJobId = newSection === "crew" ? jobRefForParent(newParent) : null;
      const sameSpot =
        oldJobId === newJobId && prevTile.day_index === newDay;
      if (!sameSpot) {
        if (oldJobId) await syncRemoveAssignment(oldJobId, prevTile.ref_id, prevTile.day_index);
        if (newJobId) await syncAddAssignment(newJobId, prevTile.ref_id, newDay);
      }
    }
  };

  const optimisticDelete = async (id: string) => {
    markLocalChange();
    const prev = tiles;
    const target = tiles.find((t) => t.id === id);
    const childCrew = tiles.filter((t) => t.parent_tile_id === id && t.kind === "crew");
    setTiles((p) => p.filter((t) => t.id !== id && t.parent_tile_id !== id));
    if (id.startsWith("tmp-")) return;
    const { error } = await supabase.from("whiteboard_tiles").delete().eq("id", id);
    if (error) {
      setTiles(prev);
      toast({ title: "Remove failed", description: error.message, variant: "destructive" });
      return;
    }
    // Sync schedule_assignments removal
    if (target?.kind === "crew" && target.ref_id && target.section === "crew") {
      const jobId = jobRefForParent(target.parent_tile_id);
      if (jobId) await syncRemoveAssignment(jobId, target.ref_id, target.day_index);
    }
    if (target?.kind === "job" && target.ref_id) {
      // Job tile removed → drop all mirrored assignments for its child crew
      for (const c of childCrew) {
        if (c.ref_id) await syncRemoveAssignment(target.ref_id, c.ref_id, c.day_index);
      }
    }
  };

  const optimisticAddDispatch = async (dayIdx: number, userId: string, label: string) => {
    const date = dateAt(weekStart, dayIdx);
    if (dispatches.some((d) => d.dispatch_date === date && d.driver_user_id === userId)) return;
    const tempId = `tmp-disp-${++tempCounter.current}`;
    const optimistic: Dispatch = {
      id: tempId,
      dispatch_date: date,
      driver_user_id: userId,
      driver_name: label,
      truck_number: null,
    };
    setDispatches((p) => [...p, optimistic]);
    const { data, error } = await supabase
      .from("dispatch_orders")
      .insert({
        dispatch_date: date,
        driver_user_id: userId,
        driver_name: label,
        status: "scheduled",
        created_by: user?.id ?? null,
      })
      .select("id,dispatch_date,driver_user_id,driver_name,truck_number")
      .maybeSingle();
    if (error || !data) {
      setDispatches((p) => p.filter((d) => d.id !== tempId));
      toast({ title: "Couldn't add to dispatch", description: error?.message ?? "Unknown", variant: "destructive" });
      return;
    }
    setDispatches((p) => p.map((d) => (d.id === tempId ? (data as Dispatch) : d)));
  };

  const optimisticDeleteDispatch = async (id: string) => {
    const prev = dispatches;
    setDispatches((p) => p.filter((d) => d.id !== id));
    if (id.startsWith("tmp-")) return;
    const { error } = await supabase.from("dispatch_orders").delete().eq("id", id);
    if (error) {
      setDispatches(prev);
      toast({ title: "Remove failed", description: error.message, variant: "destructive" });
    }
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const overId = e.over?.id?.toString();
    const dragId = e.active.id.toString();
    if (!overId) return;

    // Trucking drop zone — adds/moves crew into a real dispatch order for that day
    if (overId.startsWith("truckzone:")) {
      const day = parseInt(overId.slice("truckzone:".length), 10);
      let userId: string | null = null;
      let label = "";
      if (dragId.startsWith("virtual:")) {
        const [, dayStr, uid] = dragId.split(":");
        if (parseInt(dayStr, 10) !== day) {
          toast({ title: "Drop within the same day", variant: "destructive" });
          return;
        }
        const p = profiles.find((x) => x.user_id === uid);
        if (!p) return;
        userId = uid;
        label = p.display_name ?? "Unknown";
      } else if (dragId.startsWith("tile:")) {
        const t = tiles.find((x) => x.id === dragId.slice(5));
        if (!t || t.kind !== "crew" || !t.ref_id) return;
        if (t.day_index !== day) {
          toast({ title: "Drop within the same day", variant: "destructive" });
          return;
        }
        userId = t.ref_id;
        label = t.label;
        await optimisticDelete(t.id);
      } else {
        return;
      }
      await optimisticAddDispatch(day, userId, label);
      return;
    }

    // Targets
    let target:
      | { day: number; section: Section; parent: string | null }
      | null = null;

    const m = overId.match(/^zone:(\d+):(jobs|tasks|unassigned|off-work)$/);
    if (m) {
      const day = parseInt(m[1], 10);
      const sec = m[2];
      const section: Section =
        sec === "jobs" ? "jobs" : sec === "tasks" ? "tasks" : sec === "off-work" ? "off-work" : "crew";
      target = { day, section, parent: null };
    } else if (overId.startsWith("crewzone:")) {
      const parent = overId.slice("crewzone:".length);
      const parentTile = tiles.find((t) => t.id === parent);
      if (!parentTile) return;
      target = { day: parentTile.day_index, section: "crew", parent };
    }
    if (!target) return;

    // Drag from job palette
    if (dragId.startsWith("palette:job:")) {
      if (target.section !== "jobs") {
        toast({ title: "Drop jobs into the Jobs row", variant: "destructive" });
        return;
      }
      const refId = dragId.slice("palette:job:".length);
      const j = jobs.find((x) => x.id === refId);
      if (!j) return;
      await optimisticInsert({
        week_start: weekStart,
        day_index: target.day,
        section: "jobs",
        kind: "job",
        ref_id: refId,
        label: j.job_number ? `${j.job_number} · ${j.name}` : j.name,
        color: null,
        sort_order: sortFor(target.day, "jobs", null) + 10,
        parent_tile_id: null,
      });
      return;
    }

    // Drag a virtual unassigned crew chip → must land in a job or off-work
    if (dragId.startsWith("virtual:")) {
      const [, dayStr, userId] = dragId.split(":");
      const srcDay = parseInt(dayStr, 10);
      if (target.day !== srcDay) {
        toast({ title: "Drop within the same day", variant: "destructive" });
        return;
      }
      if (target.section !== "crew" && target.section !== "off-work") {
        toast({ title: "Drop crew onto a job or Off Work", variant: "destructive" });
        return;
      }
      const p = profiles.find((x) => x.user_id === userId);
      if (!p) return;
      await optimisticInsert({
        week_start: weekStart,
        day_index: target.day,
        section: target.section,
        kind: "crew",
        ref_id: userId,
        label: p.display_name ?? "Unknown",
        color: null,
        sort_order: sortFor(target.day, target.section, target.parent) + 10,
        parent_tile_id: target.parent,
      });
      return;
    }

    // Drag an existing tile
    if (dragId.startsWith("tile:")) {
      const tileId = dragId.slice(5);
      const t = tiles.find((x) => x.id === tileId);
      if (!t) return;
      if (t.kind === "job" && target.section !== "jobs") return;
      if (t.kind === "task" && target.section !== "tasks") return;
      if (t.kind === "crew") {
        // Crew dropped on "unassigned" zone → delete (return to virtual list)
        if (target.section === "crew" && target.parent === null && overId.endsWith(":unassigned")) {
          await optimisticDelete(t.id);
          return;
        }
        if (target.section !== "crew" && target.section !== "off-work") return;
      }
      const sameSpot =
        t.day_index === target.day &&
        t.section === target.section &&
        (t.parent_tile_id ?? null) === target.parent;
      if (sameSpot) return;
      await optimisticUpdate(t.id, {
        day_index: target.day,
        section: target.section,
        parent_tile_id: target.parent,
        sort_order: sortFor(target.day, target.section, target.parent) + 10,
      });
    }
  };

  const addTask = async (day: number, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setTaskDraft(null);
      return;
    }
    await optimisticInsert({
      week_start: weekStart,
      day_index: day,
      section: "tasks",
      kind: "task",
      ref_id: null,
      label: trimmed,
      color: null,
      sort_order: sortFor(day, "tasks", null) + 10,
      parent_tile_id: null,
    });
    setTaskDraft(null);
  };

  if (!canUse) {
    return (
      <div className="min-h-screen bg-background p-6">
        <p className="text-sm text-muted-foreground">You don't have access to the planning whiteboard.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>Back</Button>
      </div>
    );
  }

  let activeLabel: string | null = null;
  if (activeId?.startsWith("tile:")) {
    activeLabel = tiles.find((t) => t.id === activeId.slice(5))?.label ?? null;
  } else if (activeId?.startsWith("palette:job:")) {
    const refId = activeId.slice("palette:job:".length);
    const j = jobs.find((x) => x.id === refId);
    activeLabel = j ? (j.job_number ? `${j.job_number} · ${j.name}` : j.name) : null;
  } else if (activeId?.startsWith("virtual:")) {
    const [, , uid] = activeId.split(":");
    activeLabel = profiles.find((p) => p.user_id === uid)?.display_name ?? null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate("/schedule")} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Whiteboard</h1>
        <div className="ml-auto flex items-center gap-1">
          <label className="mr-1 hidden cursor-pointer items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <Checkbox
              checked={showOffice}
              onCheckedChange={(v) => updateShowOffice(v === true)}
            />
            Include office staff
          </label>
          <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={() => setCopyOpen(true)}>
            <Copy className="h-3.5 w-3.5" /> Copy forward
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setWeekStart(weekStartStr(addDays(parseISO(weekStart), -7)))} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            onClick={() => setWeekStart(weekStartStr(new Date()))}
            className="rounded-md px-2 py-1 text-xs font-medium hover:bg-muted"
          >
            {format(parseISO(weekStart), "MMM d")} – {format(addDays(parseISO(weekStart), 6), "MMM d")}
          </button>
          <Button size="icon" variant="ghost" onClick={() => setWeekStart(weekStartStr(addDays(parseISO(weekStart), 7)))} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <CopyForwardDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        weekStart={weekStart}
        sourceTiles={tiles}
        fieldEmployees={fieldEmployees}
        onCopied={load}
      />

      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveId(e.active.id.toString())}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {/* Job palette */}
        <div className="border-b border-border bg-muted/30 px-3 py-2">
          <p className="pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Jobs · drag onto a day
          </p>
          <div className="flex flex-wrap gap-1">
            {availableJobs.length === 0 ? (
              <span className="pt-1 text-[11px] text-muted-foreground">All placed.</span>
            ) : (
              availableJobs.map((j) => (
                <PaletteChip
                  key={j.id}
                  id={`palette:job:${j.id}`}
                  label={j.job_number ? `${j.job_number} · ${j.name}` : j.name}
                />
              ))
            )}
          </div>
        </div>

        {/* Week grid */}
        <main className="flex-1 overflow-x-auto px-2 py-2">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="flex gap-2 min-w-max pb-24">
              {days.map((d, idx) => {
                const placedSet = placedUserIdsByDaySimple.get(idx) ?? new Set<string>();
                const unassignedField = fieldEmployees.filter((p) => !placedSet.has(p.user_id));
                return (
                  <DayColumn
                    key={idx}
                    day={d}
                    idx={idx}
                    tiles={tiles.filter((t) => t.day_index === idx)}
                    unassignedField={unassignedField}
                    dispatches={dispatchesByDay.get(idx) ?? []}
                    onDelete={optimisticDelete}
                    onDeleteDispatch={optimisticDeleteDispatch}
                    taskDraft={taskDraft?.day === idx ? taskDraft : null}
                    setTaskDraft={setTaskDraft}
                    onAddTask={addTask}
                  />
                );
              })}
            </div>
          )}
        </main>

        <DragOverlay>
          {activeId && activeLabel ? (
            <div className="rounded-md bg-foreground/90 px-2 py-1 text-xs font-medium text-background shadow-lg">
              {activeLabel}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <BottomNav />
    </div>
  );
};

const PaletteChip = ({ id, label }: { id: string; label: string }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "max-w-[220px] truncate rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary touch-none cursor-grab active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      {label}
    </button>
  );
};

const DayColumn = ({
  day,
  idx,
  tiles,
  unassignedField,
  dispatches,
  onDelete,
  onDeleteDispatch,
  taskDraft,
  setTaskDraft,
  onAddTask,
}: {
  day: Date;
  idx: number;
  tiles: Tile[];
  unassignedField: Profile[];
  dispatches: Dispatch[];
  onDelete: (id: string) => void;
  onDeleteDispatch: (id: string) => void;
  taskDraft: { day: number; text: string } | null;
  setTaskDraft: (v: { day: number; text: string } | null) => void;
  onAddTask: (day: number, text: string) => void;
}) => {
  const isToday = format(new Date(), "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
  const jobTiles = tiles
    .filter((t) => t.section === "jobs")
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  const taskTiles = tiles.filter((t) => t.section === "tasks");
  const offWorkTiles = tiles
    .filter((t) => t.section === "off-work")
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  const crewByJob = (jobTileId: string) =>
    tiles
      .filter((t) => t.section === "crew" && t.parent_tile_id === jobTileId)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="w-[172px] shrink-0">
      <div
        className={cn(
          "mb-1 rounded-md border border-border bg-card px-1.5 py-1 text-center",
          isToday && "border-primary bg-primary/5",
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {format(day, "EEE")}
        </p>
        <p className={cn("text-sm font-bold", isToday && "text-primary")}>{format(day, "MMM d")}</p>
      </div>

      <div className="space-y-2">
        <JobsZone dayIdx={idx} hasJobs={jobTiles.length > 0}>
          {jobTiles.map((j) => (
            <JobGroup key={j.id} job={j} crew={crewByJob(j.id)} onDelete={onDelete} />
          ))}
        </JobsZone>

        <TruckingZone dayIdx={idx} dispatches={dispatches} onDeleteDispatch={onDeleteDispatch} />

        <UnassignedCrewZone dayIdx={idx} field={unassignedField} />

        <OffWorkZone dayIdx={idx} tiles={offWorkTiles} onDelete={onDelete} />

        <TaskSection
          dayIdx={idx}
          tasks={taskTiles}
          onDelete={onDelete}
          taskDraft={taskDraft}
          setTaskDraft={setTaskDraft}
          onAddTask={onAddTask}
        />
      </div>
    </div>
  );
};

const TruckingZone = ({
  dayIdx,
  dispatches,
  onDeleteDispatch,
}: {
  dayIdx: number;
  dispatches: Dispatch[];
  onDeleteDispatch: (id: string) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `truckzone:${dayIdx}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border border-amber-400/40 bg-amber-50/40 p-1.5 transition-colors dark:bg-amber-950/20",
        isOver && "ring-2 ring-amber-500 border-amber-500",
      )}
    >
      <p className="flex items-center gap-1 px-1 pb-1 text-[9px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
        <Truck className="h-3 w-3" /> Trucking
      </p>
      <div className="space-y-1">
        {dispatches.length === 0 ? (
          <p className="px-1 py-1 text-[10px] text-muted-foreground/60">Drop crew to dispatch</p>
        ) : (
          dispatches.map((d) => (
            <div key={d.id} className="flex items-center gap-1 rounded-md border border-amber-400/30 bg-card px-2 py-1">
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
                {d.driver_name ?? "Driver"}
                {d.truck_number ? <span className="text-muted-foreground"> · {d.truck_number}</span> : null}
              </span>
              <button
                onClick={() => onDeleteDispatch(d.id)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Remove dispatch"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const JobsZone = ({
  dayIdx,
  hasJobs,
  children,
}: {
  dayIdx: number;
  hasJobs: boolean;
  children: React.ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `zone:${dayIdx}:jobs` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border border-dashed border-primary/20 bg-primary/5 p-1.5 transition-colors",
        isOver && "ring-2 ring-primary border-primary",
      )}
    >
      <p className="px-1 pb-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Jobs</p>
      <div className="space-y-2">
        {children}
        {!hasJobs && <p className="px-1 py-2 text-[10px] text-muted-foreground/60">Drop a job here</p>}
      </div>
    </div>
  );
};

const JobGroup = ({
  job,
  crew,
  onDelete,
}: {
  job: Tile;
  crew: Tile[];
  onDelete: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `tile:${job.id}` });
  const drop = useDroppable({ id: `crewzone:${job.id}` });
  return (
    <div className={cn("rounded-md border border-primary/30 bg-card overflow-hidden", isDragging && "opacity-40")}>
      <div className="flex items-center gap-1 bg-primary px-2 py-1 text-primary-foreground">
        <button
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          className="min-w-0 flex-1 truncate text-left text-[11px] font-semibold cursor-grab active:cursor-grabbing"
        >
          {job.label}
        </button>
        <button onClick={() => onDelete(job.id)} className="opacity-70 hover:opacity-100" aria-label="Remove job">
          <X className="h-3 w-3" />
        </button>
      </div>
      <div
        ref={drop.setNodeRef}
        className={cn(
          "min-h-[44px] space-y-1 px-1.5 py-1.5 transition-colors",
          drop.isOver && "bg-primary/10 ring-2 ring-primary ring-inset",
        )}
      >
        {crew.length === 0 ? (
          <p className="px-1 py-1 text-[10px] text-muted-foreground/60">Drop crew here</p>
        ) : (
          crew.map((c) => <PlacedCrewCard key={c.id} tile={c} />)
        )}
      </div>
    </div>
  );
};

const UnassignedCrewZone = ({ dayIdx, field }: { dayIdx: number; field: Profile[] }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `zone:${dayIdx}:unassigned` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border border-dashed border-border bg-secondary/30 p-1.5 transition-colors",
        isOver && "ring-2 ring-primary border-primary",
      )}
    >
      <p className="flex items-center gap-1 px-1 pb-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
        <Users className="h-3 w-3" /> Unassigned crew
      </p>
      <div className="flex flex-wrap gap-1">
        {field.length === 0 ? (
          <p className="px-1 py-1 text-[10px] text-muted-foreground/60">Everyone is placed.</p>
        ) : (
          field.map((p) => <VirtualCrewChip key={p.user_id} dayIdx={dayIdx} userId={p.user_id} label={p.display_name ?? "Unknown"} />)
        )}
      </div>
    </div>
  );
};

const OffWorkZone = ({
  dayIdx,
  tiles,
  onDelete,
}: {
  dayIdx: number;
  tiles: Tile[];
  onDelete: (id: string) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `zone:${dayIdx}:off-work` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-1.5 transition-colors",
        isOver && "ring-2 ring-primary border-primary",
      )}
    >
      <p className="flex items-center gap-1 px-1 pb-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
        <Moon className="h-3 w-3" /> Off work
      </p>
      <div className="space-y-1">
        {tiles.length === 0 ? (
          <p className="px-1 py-1 text-[10px] text-muted-foreground/60">Drop crew here when off</p>
        ) : (
          tiles.map((t) => (
            <div key={t.id} className="flex items-center gap-1">
              <PlacedCrewCard tile={t} muted />
              <button onClick={() => onDelete(t.id)} className="text-muted-foreground hover:text-foreground" aria-label="Remove">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const VirtualCrewChip = ({
  dayIdx,
  userId,
  label,
}: {
  dayIdx: number;
  userId: string;
  label: string;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `virtual:${dayIdx}:${userId}` });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "max-w-[150px] truncate rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium touch-none cursor-grab active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      {label}
    </button>
  );
};

const PlacedCrewCard = ({ tile, muted }: { tile: Tile; muted?: boolean }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `tile:${tile.id}` });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex-1 truncate rounded-md px-2 py-1 text-[11px] font-medium shadow-sm touch-none cursor-grab active:cursor-grabbing",
        muted ? "bg-muted text-muted-foreground" : "bg-card border border-border text-foreground",
        isDragging && "opacity-30",
      )}
    >
      {tile.label}
    </div>
  );
};

const TaskSection = ({
  dayIdx,
  tasks,
  onDelete,
  taskDraft,
  setTaskDraft,
  onAddTask,
}: {
  dayIdx: number;
  tasks: Tile[];
  onDelete: (id: string) => void;
  taskDraft: { day: number; text: string } | null;
  setTaskDraft: (v: { day: number; text: string } | null) => void;
  onAddTask: (day: number, text: string) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `zone:${dayIdx}:tasks` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[60px] rounded-lg border border-dashed border-border bg-muted/40 p-1.5 transition-colors",
        isOver && "ring-2 ring-primary border-primary",
      )}
    >
      <p className="px-1 pb-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Tasks</p>
      <div className="space-y-1">
        {tasks
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((t) => (
            <TaskCard key={t.id} tile={t} onDelete={onDelete} />
          ))}
        {taskDraft ? (
          <div className="flex gap-1 pt-1">
            <Input
              autoFocus
              value={taskDraft.text}
              onChange={(e) => setTaskDraft({ day: dayIdx, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddTask(dayIdx, taskDraft.text);
                if (e.key === "Escape") setTaskDraft(null);
              }}
              placeholder="Task…"
              className="h-7 text-xs"
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => onAddTask(dayIdx, taskDraft.text)}>
              Add
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setTaskDraft({ day: dayIdx, text: "" })}
            className="mt-1 w-full rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
          >
            <Plus className="mr-1 inline h-3 w-3" />
            Task
          </button>
        )}
      </div>
    </div>
  );
};

const TaskCard = ({ tile, onDelete }: { tile: Tile; onDelete: (id: string) => void }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `tile:${tile.id}` });
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-accent-foreground shadow-sm touch-none",
        isDragging && "opacity-30",
      )}
    >
      <button
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className="min-w-0 flex-1 truncate text-left cursor-grab active:cursor-grabbing"
      >
        {tile.label}
      </button>
      <button onClick={() => onDelete(tile.id)} className="opacity-60 hover:opacity-100" aria-label="Remove">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};

export default Whiteboard;
