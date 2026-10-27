import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Star, Trash2, Pencil, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useAccess } from "@/lib/access";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Status = "draft" | "submitted" | "acknowledged";

type Review = {
  id: string;
  employee_user_id: string;
  employee_name: string | null;
  reviewer_name: string | null;
  review_date: string;
  review_period_start: string | null;
  review_period_end: string | null;
  overall_rating: number | null;
  quality_of_work: number | null;
  productivity: number | null;
  safety: number | null;
  teamwork: number | null;
  attendance: number | null;
  strengths: string | null;
  areas_for_improvement: string | null;
  goals: string | null;
  comments: string | null;
  employee_acknowledgment: string | null;
  acknowledged_at: string | null;
  status: Status;
};

type Employee = { user_id: string; display_name: string | null };

const RATING_FIELDS: Array<{ key: keyof Review; label: string }> = [
  { key: "quality_of_work", label: "Quality of Work" },
  { key: "productivity", label: "Productivity" },
  { key: "safety", label: "Safety" },
  { key: "teamwork", label: "Teamwork" },
  { key: "attendance", label: "Attendance" },
];

const Stars = ({ value, onChange }: { value: number | null; onChange?: (n: number) => void }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        onClick={() => onChange?.(n)}
        className={cn("transition", onChange && "hover:scale-110")}
        disabled={!onChange}
      >
        <Star
          className={cn(
            "h-5 w-5",
            (value ?? 0) >= n ? "fill-primary text-primary" : "text-muted-foreground",
          )}
        />
      </button>
    ))}
  </div>
);

const statusBadge = (s: Status) => {
  const map = {
    draft: "bg-muted text-muted-foreground",
    submitted: "bg-primary/15 text-primary ring-1 ring-primary/30",
    acknowledged: "bg-accent text-accent-foreground ring-1 ring-accent/40",
  };
  return map[s];
};

const PerformanceReviews = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = useAccess();
  const { toast } = useToast();
  const canManage = can("reviews.manage");

  const [reviews, setReviews] = useState<Review[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Review> | null>(null);
  const [ackOpen, setAckOpen] = useState<Review | null>(null);
  const [ackText, setAckText] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: revs }, { data: profs }] = await Promise.all([
      supabase
        .from("performance_reviews")
        .select("*")
        .order("review_date", { ascending: false }),
      canManage
        ? supabase
            .from("profiles")
            .select("user_id, display_name")
            .eq("is_active", true)
            .order("display_name")
        : Promise.resolve({ data: [] as Employee[] }),
    ]);
    setReviews((revs as Review[]) ?? []);
    setEmployees((profs as Employee[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, [canManage]);

  const myReviews = useMemo(
    () => reviews.filter((r) => r.employee_user_id === user?.id),
    [reviews, user],
  );

  const openNew = () => {
    setEditing({
      employee_user_id: "",
      review_date: format(new Date(), "yyyy-MM-dd"),
      status: "draft",
      overall_rating: null,
      quality_of_work: null,
      productivity: null,
      safety: null,
      teamwork: null,
      attendance: null,
    });
  };

  const save = async (submit: boolean) => {
    if (!editing) return;
    if (!editing.employee_user_id) {
      toast({ title: "Select an employee", variant: "destructive" });
      return;
    }
    const emp = employees.find((e) => e.user_id === editing.employee_user_id);
    const payload = {
      employee_user_id: editing.employee_user_id!,
      employee_name: emp?.display_name ?? null,
      reviewer_user_id: user?.id ?? null,
      reviewer_name: null as string | null,
      review_date: editing.review_date ?? format(new Date(), "yyyy-MM-dd"),
      review_period_start: editing.review_period_start || null,
      review_period_end: editing.review_period_end || null,
      overall_rating: editing.overall_rating ?? null,
      quality_of_work: editing.quality_of_work ?? null,
      productivity: editing.productivity ?? null,
      safety: editing.safety ?? null,
      teamwork: editing.teamwork ?? null,
      attendance: editing.attendance ?? null,
      strengths: editing.strengths || null,
      areas_for_improvement: editing.areas_for_improvement || null,
      goals: editing.goals || null,
      comments: editing.comments || null,
      status: (submit ? "submitted" : "draft") as Status,
      created_by: user?.id ?? null,
    };

    const res = editing.id
      ? await supabase.from("performance_reviews").update(payload).eq("id", editing.id)
      : await supabase.from("performance_reviews").insert(payload);

    if (res.error) {
      toast({ title: "Save failed", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: submit ? "Review submitted" : "Draft saved" });
    setEditing(null);
    fetchAll();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this review?")) return;
    const { error } = await supabase.from("performance_reviews").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    fetchAll();
  };

  const acknowledge = async () => {
    if (!ackOpen) return;
    const { error } = await supabase
      .from("performance_reviews")
      .update({
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
        employee_acknowledgment: ackText || null,
      })
      .eq("id", ackOpen.id);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Review acknowledged" });
    setAckOpen(null);
    setAckText("");
    fetchAll();
  };

  const ReviewCard = ({ r, mine }: { r: Review; mine: boolean }) => (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{r.employee_name ?? "Employee"}</div>
          <div className="text-xs text-muted-foreground">
            Review date: {format(new Date(r.review_date), "MMM d, yyyy")}
            {r.review_period_start && r.review_period_end &&
              ` · Period: ${format(new Date(r.review_period_start), "MMM d")} – ${format(
                new Date(r.review_period_end),
                "MMM d, yyyy",
              )}`}
          </div>
        </div>
        <Badge className={cn("uppercase tracking-wider", statusBadge(r.status))}>{r.status}</Badge>
      </div>

      {r.overall_rating != null && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Overall</span>
          <Stars value={r.overall_rating} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {RATING_FIELDS.map((f) =>
          r[f.key] != null ? (
            <div key={String(f.key)} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
              <span className="text-xs">{f.label}</span>
              <Stars value={r[f.key] as number} />
            </div>
          ) : null,
        )}
      </div>

      {r.strengths && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Strengths</div>
          <p className="text-sm">{r.strengths}</p>
        </div>
      )}
      {r.areas_for_improvement && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Areas for Improvement</div>
          <p className="text-sm">{r.areas_for_improvement}</p>
        </div>
      )}
      {r.goals && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Goals</div>
          <p className="text-sm">{r.goals}</p>
        </div>
      )}
      {r.comments && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comments</div>
          <p className="text-sm">{r.comments}</p>
        </div>
      )}

      {r.employee_acknowledgment && (
        <div className="rounded-md bg-accent/40 p-2 text-xs">
          <span className="font-semibold">Employee response:</span> {r.employee_acknowledgment}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {mine && r.status === "submitted" && (
          <Button size="sm" onClick={() => setAckOpen(r)}>
            <CheckCircle2 className="mr-1 h-4 w-4" /> Acknowledge
          </Button>
        )}
        {canManage && (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
              <Pencil className="mr-1 h-4 w-4" /> Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/tools")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-lg font-semibold">Performance Reviews</h1>
            <p className="text-xs text-muted-foreground">
              {canManage ? "Manage all reviews" : "Your performance history"}
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" /> New
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        ) : canManage ? (
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All ({reviews.length})</TabsTrigger>
              <TabsTrigger value="mine">Mine ({myReviews.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="space-y-3">
              {reviews.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No reviews yet.</p>
              ) : (
                reviews.map((r) => <ReviewCard key={r.id} r={r} mine={r.employee_user_id === user?.id} />)
              )}
            </TabsContent>
            <TabsContent value="mine" className="space-y-3">
              {myReviews.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No reviews for you yet.</p>
              ) : (
                myReviews.map((r) => <ReviewCard key={r.id} r={r} mine />)
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-3">
            {myReviews.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No reviews available yet.
              </p>
            ) : (
              myReviews.map((r) => <ReviewCard key={r.id} r={r} mine />)
            )}
          </div>
        )}
      </main>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Review" : "New Review"}</DialogTitle>
            <DialogDescription>Drafts are private until you submit.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Employee</Label>
                <Select
                  value={editing?.employee_user_id ?? ""}
                  onValueChange={(v) => setEditing({ ...editing!, employee_user_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.user_id} value={e.user_id}>
                        {e.display_name ?? e.user_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Review Date</Label>
                <Input
                  type="date"
                  value={editing?.review_date ?? ""}
                  onChange={(e) => setEditing({ ...editing!, review_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Period Start</Label>
                <Input
                  type="date"
                  value={editing?.review_period_start ?? ""}
                  onChange={(e) => setEditing({ ...editing!, review_period_start: e.target.value })}
                />
              </div>
              <div>
                <Label>Period End</Label>
                <Input
                  type="date"
                  value={editing?.review_period_end ?? ""}
                  onChange={(e) => setEditing({ ...editing!, review_period_end: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label>Overall Rating</Label>
                <Stars
                  value={editing?.overall_rating ?? null}
                  onChange={(n) => setEditing({ ...editing!, overall_rating: n })}
                />
              </div>
              {RATING_FIELDS.map((f) => (
                <div key={String(f.key)} className="flex items-center justify-between">
                  <span className="text-sm">{f.label}</span>
                  <Stars
                    value={(editing?.[f.key] as number | null) ?? null}
                    onChange={(n) => setEditing({ ...editing!, [f.key]: n })}
                  />
                </div>
              ))}
            </div>

            <div>
              <Label>Strengths</Label>
              <Textarea
                value={editing?.strengths ?? ""}
                onChange={(e) => setEditing({ ...editing!, strengths: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label>Areas for Improvement</Label>
              <Textarea
                value={editing?.areas_for_improvement ?? ""}
                onChange={(e) => setEditing({ ...editing!, areas_for_improvement: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label>Goals</Label>
              <Textarea
                value={editing?.goals ?? ""}
                onChange={(e) => setEditing({ ...editing!, goals: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label>Additional Comments</Label>
              <Textarea
                value={editing?.comments ?? ""}
                onChange={(e) => setEditing({ ...editing!, comments: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="secondary" onClick={() => save(false)}>Save Draft</Button>
            <Button onClick={() => save(true)}>Submit to Employee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Acknowledge dialog */}
      <Dialog open={!!ackOpen} onOpenChange={(o) => !o && setAckOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge Review</DialogTitle>
            <DialogDescription>
              Confirm you've read this review. Add a comment if you'd like.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Optional response or comment…"
            value={ackText}
            onChange={(e) => setAckText(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAckOpen(null)}>Cancel</Button>
            <Button onClick={acknowledge}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Acknowledge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PerformanceReviews;
