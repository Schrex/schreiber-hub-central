import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Users, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
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
import { toast } from "sonner";

interface Position {
  id: string;
  title: string;
  description: string | null;
  min_pay_rate: number;
  max_pay_rate: number;
  is_active: boolean;
  is_salaried: boolean;
  sort_order: number;
}

interface Profile {
  user_id: string | null;
  display_name: string | null;
  email: string | null;
  contact_id: string | null;
  has_login: boolean;
}

interface Assignment {
  id: string;
  user_id: string;
  position_id: string;
  pay_rate: number;
  effective_date: string;
  end_date: string | null;
  notes: string | null;
  is_salaried: boolean;
  position: { title: string } | null;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const AdminPositions = () => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [posDialog, setPosDialog] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [posForm, setPosForm] = useState({ title: "", description: "", min_pay_rate: "", max_pay_rate: "", is_active: true, is_salaried: false });

  const [assignDialog, setAssignDialog] = useState(false);
  const [assignForm, setAssignForm] = useState({ user_id: "", position_id: "", pay_rate: "", effective_date: new Date().toISOString().slice(0, 10), notes: "", is_salaried: false });

  const load = async () => {
    setLoading(true);
    const [{ data: pos }, { data: profs }, { data: contacts }, { data: assigns }] = await Promise.all([
      supabase.from("positions").select("*").order("sort_order").order("title"),
      supabase.from("profiles").select("user_id, display_name, email, contact_id").eq("is_active", true),
      supabase.from("employee_contacts").select("id, name, email, converted_user_id").eq("is_active", true).order("name"),
      supabase.from("employee_positions").select("id, user_id, position_id, pay_rate, effective_date, end_date, notes, is_salaried, position:positions(title)").order("effective_date", { ascending: false }),
    ]);

    // Unify: every active contact + any active profile that has no contact link yet
    const linkedUserIds = new Set(
      ((contacts ?? []) as any[]).map((c) => c.converted_user_id).filter((x): x is string => !!x),
    );
    const profsByUser = new Map(((profs ?? []) as any[]).map((p) => [p.user_id, p] as const));
    const fromContacts: Profile[] = ((contacts ?? []) as any[]).map((c) => {
      const p = c.converted_user_id ? profsByUser.get(c.converted_user_id) : null;
      return {
        contact_id: c.id,
        user_id: c.converted_user_id ?? null,
        display_name: c.name ?? p?.display_name ?? null,
        email: c.email ?? p?.email ?? null,
        has_login: !!c.converted_user_id,
      };
    });
    const orphanProfiles: Profile[] = ((profs ?? []) as any[])
      .filter((p) => !p.contact_id && !linkedUserIds.has(p.user_id))
      .map((p) => ({
        contact_id: null,
        user_id: p.user_id,
        display_name: p.display_name,
        email: p.email,
        has_login: true,
      }));
    const unified = [...fromContacts, ...orphanProfiles].sort((x, y) =>
      (x.display_name ?? "").localeCompare(y.display_name ?? ""),
    );

    setPositions((pos as Position[]) ?? []);
    setProfiles(unified);
    setAssignments((assigns as unknown as Assignment[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNewPosition = () => {
    setEditing(null);
    setPosForm({ title: "", description: "", min_pay_rate: "", max_pay_rate: "", is_active: true, is_salaried: false });
    setPosDialog(true);
  };

  const openEditPosition = (p: Position) => {
    setEditing(p);
    setPosForm({
      title: p.title,
      description: p.description ?? "",
      min_pay_rate: String(p.min_pay_rate),
      max_pay_rate: String(p.max_pay_rate),
      is_active: p.is_active,
      is_salaried: p.is_salaried,
    });
    setPosDialog(true);
  };

  const savePosition = async () => {
    const min = parseFloat(posForm.min_pay_rate);
    const max = parseFloat(posForm.max_pay_rate);
    if (!posForm.title.trim() || isNaN(min) || isNaN(max)) return toast.error("Title and pay range required");
    if (max < min) return toast.error("Max must be ≥ Min");
    const payload = {
      title: posForm.title.trim(),
      description: posForm.description.trim() || null,
      min_pay_rate: min,
      max_pay_rate: max,
      is_active: posForm.is_active,
      is_salaried: posForm.is_salaried,
    };
    const { error } = editing
      ? await supabase.from("positions").update(payload).eq("id", editing.id)
      : await supabase.from("positions").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Position updated" : "Position created");
    setPosDialog(false);
    load();
  };

  const deletePosition = async (p: Position) => {
    if (!confirm(`Delete "${p.title}"?`)) return;
    const { error } = await supabase.from("positions").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const openAssign = () => {
    setAssignForm({ user_id: "", position_id: "", pay_rate: "", effective_date: new Date().toISOString().slice(0, 10), notes: "", is_salaried: false });
    setAssignDialog(true);
  };

  const saveAssignment = async () => {
    const rate = parseFloat(assignForm.pay_rate);
    if (!assignForm.user_id || !assignForm.position_id || isNaN(rate)) return toast.error("All fields required");
    // End-date previous current assignment for this user
    const dayBefore = new Date(assignForm.effective_date + "T00:00:00");
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayBeforeStr = dayBefore.toISOString().slice(0, 10);
    await supabase
      .from("employee_positions")
      .update({ end_date: dayBeforeStr })
      .eq("user_id", assignForm.user_id)
      .is("end_date", null);

    const { error } = await supabase.from("employee_positions").insert({
      user_id: assignForm.user_id,
      position_id: assignForm.position_id,
      pay_rate: rate,
      effective_date: assignForm.effective_date,
      notes: assignForm.notes.trim() || null,
      is_salaried: assignForm.is_salaried,
    });
    if (error) return toast.error(error.message);
    toast.success("Assignment saved");
    setAssignDialog(false);
    load();
  };

  const deleteAssignment = async (id: string) => {
    if (!confirm("Delete this assignment?")) return;
    const { error } = await supabase.from("employee_positions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const today = new Date().toISOString().slice(0, 10);
  const currentByUser = new Map<string, Assignment>();
  assignments.forEach((a) => {
    if (a.effective_date <= today && (!a.end_date || a.end_date >= today)) {
      if (!currentByUser.has(a.user_id)) currentByUser.set(a.user_id, a);
    }
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <h1 className="mt-4 font-display text-2xl uppercase tracking-wide">Positions & Pay</h1>
        <p className="text-sm text-muted-foreground">Manage job positions, pay ranges, and employee assignments.</p>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <div className="font-semibold text-destructive">Sensitive data — all access is logged</div>
            <p className="mt-0.5 text-muted-foreground">
              Pay and compensation data is protected under the NY SHIELD Act. Every change you make is recorded with your identity, timestamp, and the previous values. See <code className="rounded bg-muted px-1">SECURITY.md</code> for the full policy.
            </p>
          </div>
        </div>

        {/* Positions */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg">Positions</h2>
            <Button size="sm" onClick={openNewPosition}>
              <Plus className="mr-1 h-4 w-4" /> New Position
            </Button>
          </div>
          <div className="space-y-2">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && positions.length === 0 && (
              <p className="text-sm text-muted-foreground">No positions yet.</p>
            )}
            {positions.map((p) => (
              <Card key={p.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.title}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${p.is_salaried ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {p.is_salaried ? "Salary" : "Hourly"}
                    </span>
                    {!p.is_active && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">Inactive</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.is_salaried
                      ? `${fmtMoney(p.min_pay_rate)} – ${fmtMoney(p.max_pay_rate)}/yr`
                      : `${fmtMoney(p.min_pay_rate)} – ${fmtMoney(p.max_pay_rate)}/hr`}
                    {p.description && ` · ${p.description}`}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEditPosition(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deletePosition(p)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Employees */}
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg">Employee Assignments</h2>
            <Button size="sm" onClick={openAssign}>
              <Users className="mr-1 h-4 w-4" /> Assign / Update Pay
            </Button>
          </div>
          <div className="space-y-2">
            {profiles.map((u) => {
              const cur = u.user_id ? currentByUser.get(u.user_id) : undefined;
              const userHistory = u.user_id
                ? assignments.filter((a) => a.user_id === u.user_id)
                : [];
              return (
                <Card key={u.contact_id ?? u.user_id ?? u.email ?? u.display_name} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium truncate">{u.display_name ?? u.email ?? "—"}</div>
                        {!u.has_login && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                            No login
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      <div className="mt-1 text-sm">
                        {!u.has_login ? (
                          <span className="text-muted-foreground italic">
                            Convert to login from Employee Contacts to assign pay
                          </span>
                        ) : cur ? (
                          <span>
                            <span className="font-semibold">{cur.position?.title}</span>
                            <span className="text-muted-foreground"> · {fmtMoney(cur.pay_rate)}{cur.is_salaried ? "/yr" : "/hr"}</span>
                            <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase ${cur.is_salaried ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                              {cur.is_salaried ? "Salary" : "Hourly"}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">No position assigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {userHistory.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        History ({userHistory.length})
                      </summary>
                      <div className="mt-2 space-y-1">
                        {userHistory.map((a) => (
                          <div key={a.id} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-xs">
                            <span>
                              {a.position?.title} · {fmtMoney(a.pay_rate)}{a.is_salaried ? "/yr" : "/hr"} · {a.effective_date}
                              {a.end_date ? ` → ${a.end_date}` : " (current)"}
                            </span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteAssignment(a.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      </div>

      {/* Position dialog */}
      <Dialog open={posDialog} onOpenChange={setPosDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Position" : "New Position"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={posForm.title} onChange={(e) => setPosForm({ ...posForm, title: e.target.value })} placeholder="e.g. Equipment Operator" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={posForm.description} onChange={(e) => setPosForm({ ...posForm, description: e.target.value })} rows={2} />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <Switch checked={posForm.is_salaried} onCheckedChange={(v) => setPosForm({ ...posForm, is_salaried: v })} />
              <Label className="cursor-pointer">Salaried position (annual pay)</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Min Pay ({posForm.is_salaried ? "$/yr" : "$/hr"})</Label>
                <Input type="number" step="0.01" value={posForm.min_pay_rate} onChange={(e) => setPosForm({ ...posForm, min_pay_rate: e.target.value })} />
              </div>
              <div>
                <Label>Max Pay ({posForm.is_salaried ? "$/yr" : "$/hr"})</Label>
                <Input type="number" step="0.01" value={posForm.max_pay_rate} onChange={(e) => setPosForm({ ...posForm, max_pay_rate: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={posForm.is_active} onCheckedChange={(v) => setPosForm({ ...posForm, is_active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPosDialog(false)}>Cancel</Button>
            <Button onClick={savePosition}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment dialog */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Position / Update Pay</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Employee</Label>
              <Select value={assignForm.user_id} onValueChange={(v) => setAssignForm({ ...assignForm, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {profiles
                    .filter((p) => p.has_login && p.user_id)
                    .map((p) => (
                      <SelectItem key={p.user_id as string} value={p.user_id as string}>
                        {p.display_name ?? p.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Position</Label>
              <Select value={assignForm.position_id} onValueChange={(v) => {
                const p = positions.find((x) => x.id === v);
                setAssignForm({ ...assignForm, position_id: v, pay_rate: p ? String(p.min_pay_rate) : assignForm.pay_rate });
              }}>
                <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                <SelectContent>
                  {positions.filter((p) => p.is_active).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} ({fmtMoney(p.min_pay_rate)}–{fmtMoney(p.max_pay_rate)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pay Rate ($/hr)</Label>
                <Input type="number" step="0.01" value={assignForm.pay_rate} onChange={(e) => setAssignForm({ ...assignForm, pay_rate: e.target.value })} />
              </div>
              <div>
                <Label>Effective Date</Label>
                <Input type="date" value={assignForm.effective_date} onChange={(e) => setAssignForm({ ...assignForm, effective_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={assignForm.notes} onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })} rows={2} placeholder="Promotion, raise, etc." />
            </div>
            <p className="text-xs text-muted-foreground">
              Any current open assignment for this employee will be automatically end-dated the day before the effective date.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(false)}>Cancel</Button>
            <Button onClick={saveAssignment}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPositions;
