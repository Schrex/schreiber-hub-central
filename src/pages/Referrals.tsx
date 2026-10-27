import { errorMessage } from "@/lib/errorMessage";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, UserPlus, Briefcase, DollarSign, Phone, Mail, User } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccess } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type RefType = "hire" | "job";
type RefStatus = "new" | "reviewing" | "hired_won" | "paid" | "closed" | "rejected";

interface Referral {
  id: string;
  referrer_user_id: string;
  referrer_name: string | null;
  type: RefType;
  status: RefStatus;
  referee_name: string;
  referee_phone: string | null;
  referee_email: string | null;
  relationship: string | null;
  notes: string | null;
  fee_amount: number | null;
  paid_at: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<RefStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  hired_won: "Hired/Won",
  paid: "Paid",
  closed: "Closed",
  rejected: "Rejected",
};

const STATUS_STYLE: Record<RefStatus, string> = {
  new: "bg-primary/15 text-primary",
  reviewing: "bg-accent/20 text-accent-foreground",
  hired_won: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  paid: "bg-emerald-600/25 text-emerald-800 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/15 text-destructive",
};

const referralSchema = z.object({
  referee_name: z.string().trim().min(1, "Name required").max(120),
  referee_phone: z.string().trim().max(40).optional().or(z.literal("")),
  referee_email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  relationship: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

const Referrals = () => {
  const { user, displayName } = useAuth();
  const { can } = useAccess();
  const isManager = can("referrals.manage");
  const [tab, setTab] = useState<RefType>("hire");
  const [items, setItems] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    referee_name: "",
    referee_phone: "",
    referee_email: "",
    relationship: "",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("referrals")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as Referral[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => setForm({ referee_name: "", referee_phone: "", referee_email: "", relationship: "", notes: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = referralSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("referrals").insert({
        referrer_user_id: user.id,
        referrer_name: displayName ?? null,
        type: tab,
        referee_name: parsed.data.referee_name,
        referee_phone: parsed.data.referee_phone || null,
        referee_email: parsed.data.referee_email || null,
        relationship: parsed.data.relationship || null,
        notes: parsed.data.notes || null,
      });
      if (error) throw error;
      toast.success(tab === "hire" ? "Candidate referral submitted" : "Job referral submitted");
      resetForm();
      setOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to submit"));
    } finally {
      setBusy(false);
    }
  };

  const updateField = async (id: string, patch: Partial<Referral>) => {
    const { error } = await supabase.from("referrals").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const setStatus = (id: string, status: RefStatus) => {
    const patch: Partial<Referral> = { status };
    if (status === "paid") patch.paid_at = new Date().toISOString().slice(0, 10);
    updateField(id, patch);
  };

  const setFee = (id: string, val: string) => {
    const num = val === "" ? null : Number(val);
    if (num !== null && (Number.isNaN(num) || num < 0)) return;
    updateField(id, { fee_amount: num });
  };

  const filtered = items.filter((r) => r.type === tab);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl uppercase tracking-wide">Referrals</h1>
            <p className="text-sm text-muted-foreground">
              Refer candidates or job leads — earn a bonus when we hire or win the work.
            </p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" /> New</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  Refer a {tab === "hire" ? "candidate" : "job"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-1">
                  <button
                    type="button"
                    onClick={() => setTab("hire")}
                    className={`rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wide ${tab === "hire" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    <UserPlus className="mr-1 inline h-3.5 w-3.5" /> Candidate
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("job")}
                    className={`rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wide ${tab === "job" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    <Briefcase className="mr-1 inline h-3.5 w-3.5" /> Job lead
                  </button>
                </div>

                <div>
                  <Label htmlFor="rname">{tab === "hire" ? "Candidate name" : "Contact name"} *</Label>
                  <Input id="rname" required value={form.referee_name}
                    onChange={(e) => setForm({ ...form, referee_name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="rphone">Phone</Label>
                    <Input id="rphone" type="tel" value={form.referee_phone}
                      onChange={(e) => setForm({ ...form, referee_phone: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="remail">Email</Label>
                    <Input id="remail" type="email" value={form.referee_email}
                      onChange={(e) => setForm({ ...form, referee_email: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="rrel">{tab === "hire" ? "Relationship (friend, ex-coworker…)" : "Relationship to job (homeowner, GC…)"}</Label>
                  <Input id="rrel" value={form.relationship}
                    onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="rnotes">Notes {tab === "job" && <span className="text-muted-foreground">(scope, location, timing)</span>}</Label>
                  <Textarea id="rnotes" rows={3} value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Submitting…" : "Submit referral"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as RefType)} className="mt-5">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="hire">
              <UserPlus className="mr-1 h-4 w-4" /> Candidates
            </TabsTrigger>
            <TabsTrigger value="job">
              <Briefcase className="mr-1 h-4 w-4" /> Job leads
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4 space-y-2">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && filtered.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No {tab === "hire" ? "candidate" : "job"} referrals yet.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Tap "New" to add one.</p>
              </div>
            )}

            {filtered.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-base uppercase tracking-wide truncate">{r.referee_name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {r.referee_phone && (
                        <a href={`tel:${r.referee_phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                          <Phone className="h-3 w-3" /> {r.referee_phone}
                        </a>
                      )}
                      {r.referee_email && (
                        <a href={`mailto:${r.referee_email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                          <Mail className="h-3 w-3" /> {r.referee_email}
                        </a>
                      )}
                      {r.relationship && <span>· {r.relationship}</span>}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STATUS_STYLE[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>

                {r.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{r.notes}</p>}

                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3" /> {r.referrer_name ?? "Employee"}
                  </span>
                  {r.fee_amount != null && (
                    <span className="inline-flex items-center gap-1 font-medium text-foreground">
                      <DollarSign className="h-3 w-3" /> {Number(r.fee_amount).toFixed(2)}
                      {r.paid_at && <span className="ml-1 text-muted-foreground">paid {r.paid_at}</span>}
                    </span>
                  )}
                </div>

                {isManager && (
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
                    <div>
                      <Label className="text-[10px] uppercase">Status</Label>
                      <Select value={r.status} onValueChange={(v) => setStatus(r.id, v as RefStatus)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(STATUS_LABEL) as RefStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase">Fee ($)</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        className="h-8 text-xs"
                        defaultValue={r.fee_amount ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (v !== String(r.fee_amount ?? "")) setFee(r.id, v);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Referrals;
