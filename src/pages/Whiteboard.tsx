import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/BottomNav";
import { cn } from "@/lib/utils";

type Section = "jobs" | "crew" | "tasks";
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
};

type Job = { id: string; name: string; job_number: string | null };
type Profile = { user_id: string; display_name: string | null };

const SECTIONS: Array<{ key: Section; label: string; emptyHint: string }> = [
  { key: "jobs", label: "Jobs", emptyHint: "Drop job here" },
  { key: "crew", label: "Crew", emptyHint: "Drop crew here" },
  { key: "tasks", label: "Tasks", emptyHint: "Add task" },
];

const weekStartStr = (d: Date) => format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");

const Whiteboard = () => {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const canUse = role === "office" || role === "admin" || role === "foreman";

  const [weekStart, setWeekStart] = useState<string>(weekStartStr(new Date()));
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<{ day: number; text: string } | null>(null);
  

  const days = useMemo(() => {
    const start = parseISO(weekStart);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekStart]);

  const load = async () => {
    setLoading(true);
    const [tilesRes, jobsRes, profilesRes] = await Promise.all([
      supabase.from("whiteboard_tiles").select("*").eq("week_start", weekStart).order("sort_order"),
      supabase.from("jobs").select("id,name,job_number").eq("status", "active").order("name"),
      supabase.from("profiles").select("user_id,display_name").eq("is_active", true).order("display_name"),
    ]);
    if (tilesRes.error) toast({ title: "Couldn't load board", description: tilesRes.error.message, variant: "destructive" });
    setTiles(((tilesRes.data ?? []) as Tile[]));
    setJobs(((jobsRes.data ?? []) as Job[]));
    setProfiles(((profilesRes.data ?? []) as Profile[]).filter((p) => p.user_id));
    setLoading(false);
  };

  useEffect(() => {
    if (canUse) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, canUse]);

  // Realtime: refetch on any change to this week's tiles
  useEffect(() => {
    if (!canUse) return;
    const ch = supabase
      .channel(`wb-${weekStart}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whiteboard_tiles", filter: `week_start=eq.${weekStart}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, canUse]);

  const placedJobIds = useMemo(() => new Set(tiles.filter((t) => t.kind === "job").map((t) => t.ref_id)), [tiles]);
  const placedCrewIds = useMemo(() => new Set(tiles.filter((t) => t.kind === "crew").map((t) => t.ref_id)), [tiles]);
  const availableJobs = useMemo(() => jobs.filter((j) => !placedJobIds.has(j.id)), [jobs, placedJobIds]);
  const availableCrew = useMemo(
    () => profiles.filter((p) => !placedCrewIds.has(p.user_id)),
    [profiles, placedCrewIds],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const overId = e.over?.id?.toString();
    const dragId = e.active.id.toString();
    if (!overId) return;
    const m = overId.match(/^zone:(\d+):(jobs|crew|tasks)$/);
    if (!m) return;
    const day = parseInt(m[1], 10);
    const section = m[2] as Section;
    const maxSort = Math.max(0, ...tiles.filter((t) => t.day_index === day && t.section === section).map((t) => t.sort_order));

    if (dragId.startsWith("palette:")) {
      const [, pkind, refId] = dragId.split(":");
      if (pkind === "job" && section !== "jobs") {
        toast({ title: "Jobs go in the Jobs row", variant: "destructive" });
        return;
      }
      if (pkind === "crew" && section !== "crew") {
        toast({ title: "Crew go in the Crew row", variant: "destructive" });
        return;
      }
      let label = "";
      if (pkind === "job") {
        const j = jobs.find((x) => x.id === refId);
        if (!j) return;
        label = j.job_number ? `${j.job_number} · ${j.name}` : j.name;
      } else {
        const p = profiles.find((x) => x.user_id === refId);
        if (!p) return;
        label = p.display_name ?? "Unknown";
      }
      const { error } = await supabase.from("whiteboard_tiles").insert({
        week_start: weekStart,
        day_index: day,
        section,
        kind: pkind as Kind,
        ref_id: refId,
        label,
        sort_order: maxSort + 10,
        created_by: user?.id ?? null,
      });
      if (error) toast({ title: "Couldn't place tile", description: error.message, variant: "destructive" });
      return;
    }

    if (dragId.startsWith("tile:")) {
      const tileId = dragId.slice(5);
      const t = tiles.find((x) => x.id === tileId);
      if (!t) return;
      if (t.kind === "job" && section !== "jobs") return;
      if (t.kind === "crew" && section !== "crew") return;
      if (t.kind === "task" && section !== "tasks") return;
      if (t.day_index === day && t.section === section) return;
      const { error } = await supabase
        .from("whiteboard_tiles")
        .update({ day_index: day, section, sort_order: maxSort + 10 })
        .eq("id", t.id);
      if (error) toast({ title: "Move failed", description: error.message, variant: "destructive" });
    }
  };

  const removeTile = async (id: string) => {
    const { error } = await supabase.from("whiteboard_tiles").delete().eq("id", id);
    if (error) toast({ title: "Remove failed", description: error.message, variant: "destructive" });
  };

  const addTask = async (day: number, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setTaskDraft(null);
      return;
    }
    const maxSort = Math.max(0, ...tiles.filter((t) => t.day_index === day && t.section === "tasks").map((t) => t.sort_order));
    const { error } = await supabase.from("whiteboard_tiles").insert({
      week_start: weekStart,
      day_index: day,
      section: "tasks",
      kind: "task",
      ref_id: null,
      label: trimmed,
      sort_order: maxSort + 10,
      created_by: user?.id ?? null,
    });
    if (error) toast({ title: "Couldn't add task", description: error.message, variant: "destructive" });
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
  } else if (activeId?.startsWith("palette:")) {
    const [, pkind, refId] = activeId.split(":");
    if (pkind === "job") {
      const j = jobs.find((x) => x.id === refId);
      activeLabel = j ? (j.job_number ? `${j.job_number} · ${j.name}` : j.name) : null;
    } else if (pkind === "crew") {
      activeLabel = profiles.find((x) => x.user_id === refId)?.display_name ?? null;
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate("/schedule")} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Whiteboard</h1>
        <div className="ml-auto flex items-center gap-1">
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

      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveId(e.active.id.toString())}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {/* Palette */}
        <div className="border-b border-border bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2 pb-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Palette · drag onto a day</p>
            <label className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <input type="checkbox" checked={showOffice} onChange={(e) => setShowOffice(e.target.checked)} /> Office
            </label>
          </div>
          <div className="space-y-1.5">
            <PaletteRow
              label="Jobs"
              tiles={availableJobs.map((j) => ({
                id: `palette:job:${j.id}`,
                label: j.job_number ? `${j.job_number} · ${j.name}` : j.name,
                tone: "job" as const,
              }))}
            />
            <PaletteRow
              label="Crew"
              tiles={availableCrew.map((p) => ({
                id: `palette:crew:${p.user_id}`,
                label: p.display_name ?? "Unknown",
                tone: "crew" as const,
              }))}
            />
          </div>
        </div>

        {/* Week grid */}
        <main className="flex-1 overflow-x-auto px-2 py-2">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="flex gap-2 min-w-max pb-24">
              {days.map((d, idx) => (
                <DayColumn
                  key={idx}
                  day={d}
                  idx={idx}
                  tiles={tiles.filter((t) => t.day_index === idx)}
                  onRemove={removeTile}
                  taskDraft={taskDraft?.day === idx ? taskDraft : null}
                  setTaskDraft={setTaskDraft}
                  onAddTask={addTask}
                />
              ))}
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

const PaletteRow = ({
  label,
  tiles,
}: {
  label: string;
  tiles: { id: string; label: string; tone: "job" | "crew" }[];
}) => (
  <div className="flex items-start gap-2">
    <p className="w-10 shrink-0 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    <div className="flex flex-wrap gap-1">
      {tiles.length === 0 ? (
        <span className="pt-1 text-[11px] text-muted-foreground">All placed.</span>
      ) : (
        tiles.map((t) => <PaletteChip key={t.id} id={t.id} label={t.label} tone={t.tone} />)
      )}
    </div>
  </div>
);

const PaletteChip = ({ id, label, tone }: { id: string; label: string; tone: "job" | "crew" }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "max-w-[220px] truncate rounded-md border px-2 py-1 text-[11px] font-medium touch-none cursor-grab active:cursor-grabbing",
        tone === "job" ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background",
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
  onRemove,
  taskDraft,
  setTaskDraft,
  onAddTask,
}: {
  day: Date;
  idx: number;
  tiles: Tile[];
  onRemove: (id: string) => void;
  taskDraft: { day: number; text: string } | null;
  setTaskDraft: (v: { day: number; text: string } | null) => void;
  onAddTask: (day: number, text: string) => void;
}) => {
  const isToday = format(new Date(), "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
  return (
    <div className="w-[220px] shrink-0">
      <div
        className={cn(
          "mb-1 rounded-md border border-border bg-card px-2 py-1.5 text-center",
          isToday && "border-primary bg-primary/5",
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {format(day, "EEE")}
        </p>
        <p className={cn("text-sm font-bold", isToday && "text-primary")}>{format(day, "MMM d")}</p>
      </div>
      <div className="space-y-1.5">
        {SECTIONS.map((s) => (
          <Zone
            key={s.key}
            dayIdx={idx}
            section={s.key}
            title={s.label}
            emptyHint={s.emptyHint}
            tiles={tiles.filter((t) => t.section === s.key)}
            onRemove={onRemove}
            footer={
              s.key === "tasks" ? (
                taskDraft ? (
                  <div className="flex gap-1 pt-1">
                    <Input
                      autoFocus
                      value={taskDraft.text}
                      onChange={(e) => setTaskDraft({ day: idx, text: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onAddTask(idx, taskDraft.text);
                        if (e.key === "Escape") setTaskDraft(null);
                      }}
                      placeholder="Task…"
                      className="h-7 text-xs"
                    />
                    <Button size="sm" className="h-7 px-2 text-xs" onClick={() => onAddTask(idx, taskDraft.text)}>
                      Add
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setTaskDraft({ day: idx, text: "" })}
                    className="mt-1 w-full rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    <Plus className="mr-1 inline h-3 w-3" />
                    Task
                  </button>
                )
              ) : null
            }
          />
        ))}
      </div>
    </div>
  );
};

const Zone = ({
  dayIdx,
  section,
  title,
  emptyHint,
  tiles,
  onRemove,
  footer,
}: {
  dayIdx: number;
  section: Section;
  title: string;
  emptyHint: string;
  tiles: Tile[];
  onRemove: (id: string) => void;
  footer?: React.ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `zone:${dayIdx}:${section}` });
  const tone =
    section === "jobs"
      ? "bg-primary/5 border-primary/20"
      : section === "crew"
        ? "bg-secondary/40 border-border"
        : "bg-muted/40 border-border";
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[60px] rounded-lg border border-dashed p-1.5 transition-colors",
        tone,
        isOver && "ring-2 ring-primary border-primary",
      )}
    >
      <p className="px-1 pb-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <div className="space-y-1">
        {tiles
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((t) => (
            <TileCard key={t.id} tile={t} onRemove={onRemove} />
          ))}
        {tiles.length === 0 && !footer && (
          <p className="px-1 py-2 text-[10px] text-muted-foreground/60">{emptyHint}</p>
        )}
        {footer}
      </div>
    </div>
  );
};

const TileCard = ({ tile, onRemove }: { tile: Tile; onRemove: (id: string) => void }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `tile:${tile.id}` });
  const tone =
    tile.kind === "job"
      ? "bg-primary text-primary-foreground"
      : tile.kind === "crew"
        ? "bg-card border border-border text-foreground"
        : "bg-accent text-accent-foreground";
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium shadow-sm touch-none",
        tone,
        isDragging && "opacity-30",
      )}
    >
      <button
        {...listeners}
        {...attributes}
        className="min-w-0 flex-1 truncate text-left cursor-grab active:cursor-grabbing"
      >
        {tile.label}
      </button>
      <button onClick={() => onRemove(tile.id)} className="opacity-60 hover:opacity-100" aria-label="Remove">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};

export default Whiteboard;
