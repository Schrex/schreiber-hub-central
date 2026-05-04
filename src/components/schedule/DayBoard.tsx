import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Briefcase, GripVertical, MapPin, Plus, Trash2, UserMinus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type BoardJob = {
  id: string;
  name: string;
  job_number: string | null;
  address: string | null;
};
export type BoardCrew = {
  user_id: string;
  display_name: string;
  position?: string | null;
  status: "available" | "off";
  off_label?: string | null;
};
export type BoardAssignment = {
  id: string;
  job_id: string;
  user_id: string;
  display_name: string;
  start_time: string | null;
  position?: string | null;
};

const UNASSIGNED_ID = "__unassigned__";

interface Props {
  jobs: BoardJob[];
  allActiveJobs: BoardJob[];
  crew: BoardCrew[];
  assignments: BoardAssignment[];
  extraJobIds: string[];
  onAddJob: (jobId: string) => void;
  onRemoveJobFromBoard: (jobId: string) => void;
  onAssign: (jobId: string, userId: string) => Promise<void>;
  onMove: (assignmentId: string, newJobId: string) => Promise<void>;
  onUnassign: (assignmentId: string) => Promise<void>;
}

type DraggedItem =
  | { kind: "crew"; user_id: string; name: string; position?: string | null }
  | { kind: "assignment"; id: string; user_id: string; name: string; from_job_id: string };

function CrewChip({
  crew,
  dragging,
}: {
  crew: BoardCrew;
  dragging?: boolean;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, isDragging } = useDraggable({
    id: `crew:${crew.user_id}`,
    data: {
      kind: "crew",
      user_id: crew.user_id,
      name: crew.display_name,
      position: crew.position,
    } satisfies DraggedItem,
    disabled: crew.status === "off",
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex select-none items-center gap-2 rounded-md border px-2 py-2 text-xs",
        crew.status === "off"
          ? "cursor-not-allowed border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-border bg-background hover:border-primary/40 hover:bg-primary/5",
        (isDragging || dragging) && "opacity-40",
      )}
    >
      {crew.status !== "off" && (
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          style={{ touchAction: "none" }}
          className="-my-1 -ml-1 flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-primary/10 hover:text-primary active:cursor-grabbing"
          aria-label={`Drag ${crew.display_name}`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium leading-tight">{crew.display_name}</div>
        <div className="truncate text-[10px] leading-tight text-muted-foreground">
          {crew.status === "off"
            ? `Off${crew.off_label ? ` · ${crew.off_label}` : ""}`
            : crew.position ?? "—"}
        </div>
      </div>
    </div>
  );
}

function AssignmentChip({
  a,
  dragging,
}: {
  a: BoardAssignment;
  dragging?: boolean;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, isDragging } = useDraggable({
    id: `asg:${a.id}`,
    data: {
      kind: "assignment",
      id: a.id,
      user_id: a.user_id,
      name: a.display_name,
      from_job_id: a.job_id,
    } satisfies DraggedItem,
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group flex select-none items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-2 py-2 text-xs",
        (isDragging || dragging) && "opacity-40",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        style={{ touchAction: "none" }}
        className="-my-1 -ml-1 flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded text-primary/70 hover:bg-primary/10 hover:text-primary active:cursor-grabbing"
        aria-label={`Drag ${a.display_name}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium leading-tight">{a.display_name}</div>
        <div className="truncate text-[10px] leading-tight text-muted-foreground">
          {a.start_time ? `${a.start_time.slice(0, 5)} · ` : ""}
          {a.position ?? "—"}
        </div>
      </div>
    </div>
  );
}

function JobDropZone({
  job,
  assignments,
  onRemoveBoard,
  removable,
}: {
  job: BoardJob;
  assignments: BoardAssignment[];
  onRemoveBoard?: () => void;
  removable: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `job:${job.id}` });
  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "overflow-hidden transition-colors",
        isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <div className="flex items-start justify-between gap-2 bg-primary/5 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5 shrink-0 text-primary" />
            {job.job_number && (
              <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                #{job.job_number}
              </span>
            )}
            <span className="truncate text-sm font-semibold">{job.name}</span>
          </div>
          {job.address && (
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{job.address}</span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {assignments.length}
          </Badge>
          {removable && assignments.length === 0 && onRemoveBoard && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={onRemoveBoard}
              aria-label="Remove from board"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>
      <div className="min-h-[60px] space-y-1 p-2">
        {assignments.length === 0 ? (
          <div
            className={cn(
              "flex h-[60px] items-center justify-center rounded border border-dashed text-[11px] italic text-muted-foreground",
              isOver ? "border-primary bg-primary/5 text-primary" : "border-border",
            )}
          >
            Drop crew here
          </div>
        ) : (
          assignments.map((a) => <AssignmentChip key={a.id} a={a} />)
        )}
      </div>
    </Card>
  );
}

function UnassignedZone({
  available,
  off,
}: {
  available: BoardCrew[];
  off: BoardCrew[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_ID });
  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "overflow-hidden transition-colors",
        isOver && "ring-2 ring-destructive ring-offset-2 ring-offset-background",
      )}
    >
      <div className="flex items-center justify-between bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <UserMinus className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Available
          </span>
        </div>
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          {available.length}
        </Badge>
      </div>
      <div className="space-y-1 p-2">
        {available.length === 0 ? (
          <div
            className={cn(
              "rounded border border-dashed py-3 text-center text-[11px] italic",
              isOver
                ? "border-destructive bg-destructive/5 text-destructive"
                : "border-border text-muted-foreground",
            )}
          >
            {isOver ? "Drop to unassign" : "Everyone's assigned"}
          </div>
        ) : (
          available.map((c) => <CrewChip key={c.user_id} crew={c} />)
        )}
        {off.length > 0 && (
          <>
            <div className="mt-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Off ({off.length})
            </div>
            {off.map((c) => (
              <CrewChip key={c.user_id} crew={c} />
            ))}
          </>
        )}
      </div>
    </Card>
  );
}

export function DayBoard({
  jobs,
  allActiveJobs,
  crew,
  assignments,
  extraJobIds,
  onAddJob,
  onRemoveJobFromBoard,
  onAssign,
  onMove,
  onUnassign,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const [active, setActive] = useState<DraggedItem | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const assignedUserIds = useMemo(
    () => new Set(assignments.map((a) => a.user_id)),
    [assignments],
  );
  const available = useMemo(
    () => crew.filter((c) => c.status === "available" && !assignedUserIds.has(c.user_id)),
    [crew, assignedUserIds],
  );
  const off = useMemo(() => crew.filter((c) => c.status === "off"), [crew]);

  const asgByJob = useMemo(() => {
    const map = new Map<string, BoardAssignment[]>();
    assignments.forEach((a) => {
      const arr = map.get(a.job_id) ?? [];
      arr.push(a);
      map.set(a.job_id, arr);
    });
    return map;
  }, [assignments]);

  const jobsToShow = useMemo(() => {
    const ids = new Set(jobs.map((j) => j.id));
    extraJobIds.forEach((id) => ids.add(id));
    const byId = new Map(allActiveJobs.map((j) => [j.id, j]));
    return Array.from(ids)
      .map((id) => byId.get(id))
      .filter((j): j is BoardJob => !!j)
      .sort((a, b) => {
        const an = a.job_number ?? "";
        const bn = b.job_number ?? "";
        return an.localeCompare(bn) || a.name.localeCompare(b.name);
      });
  }, [jobs, extraJobIds, allActiveJobs]);

  const addableJobs = useMemo(() => {
    const shown = new Set(jobsToShow.map((j) => j.id));
    return allActiveJobs.filter((j) => !shown.has(j.id));
  }, [allActiveJobs, jobsToShow]);

  const handleStart = (e: DragStartEvent) => {
    const data = e.active.data.current as DraggedItem | undefined;
    if (data) setActive(data);
  };

  const handleEnd = async (e: DragEndEvent) => {
    setActive(null);
    const item = e.active.data.current as DraggedItem | undefined;
    const overId = e.over?.id;
    if (!item || !overId || typeof overId !== "string") return;

    if (overId === UNASSIGNED_ID) {
      if (item.kind === "assignment") {
        await onUnassign(item.id);
      }
      return;
    }
    if (overId.startsWith("job:")) {
      const jobId = overId.slice(4);
      if (item.kind === "crew") {
        await onAssign(jobId, item.user_id);
      } else if (item.kind === "assignment") {
        if (item.from_job_id !== jobId) await onMove(item.id, jobId);
      }
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleStart} onDragEnd={handleEnd}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_1fr]">
        <div className="space-y-3 lg:sticky lg:top-[180px] lg:self-start">
          <UnassignedZone available={available} off={off} />
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {addableJobs.length > 0 ? (
              <Select
                value=""
                onValueChange={(v) => {
                  if (v) onAddJob(v);
                }}
                open={pickerOpen}
                onOpenChange={setPickerOpen}
              >
                <SelectTrigger className="h-8 w-full text-xs sm:w-[280px]">
                  <SelectValue placeholder="+ Add job to board" />
                </SelectTrigger>
                <SelectContent>
                  {addableJobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.job_number ? `#${j.job_number} · ` : ""}
                      {j.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">All active jobs are on the board.</p>
            )}
          </div>

          {jobsToShow.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              <Plus className="mx-auto mb-2 h-5 w-5 opacity-50" />
              Add a job to start scheduling crew for this day.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {jobsToShow.map((j) => (
                <JobDropZone
                  key={j.id}
                  job={j}
                  assignments={asgByJob.get(j.id) ?? []}
                  removable={extraJobIds.includes(j.id)}
                  onRemoveBoard={() => onRemoveJobFromBoard(j.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <DragOverlay>
        {active && (
          <div className="rounded-md border border-primary bg-background px-2 py-1.5 text-xs shadow-lg">
            <div className="font-medium leading-tight">{active.name}</div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
