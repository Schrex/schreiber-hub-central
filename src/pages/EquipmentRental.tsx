import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wrench, Trash2, Plus, Pencil } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SignaturePad } from "@/components/safety/SignaturePad";
import { toast } from "sonner";

type Equipment = {
  id: string;
  name: string;
  description: string | null;
  daily_rate: number | null;
  photo_url: string | null;
  is_active: boolean;
  sort_order: number;
};

type Rental = {
  id: string;
  user_id: string;
  equipment_name: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  status: "requested" | "approved" | "denied" | "picked_up" | "returned" | "cancelled";
  waiver_name: string;
  created_at: string;
};

const RENTAL_STATUS: Record<Rental["status"], string> = {
  requested: "bg-muted text-muted-foreground",
  approved: "bg-primary/15 text-primary",
  denied: "bg-destructive/15 text-destructive",
  picked_up: "bg-accent text-accent-foreground",
  returned: "bg-role-office/15 text-role-office",
  cancelled: "bg-destructive/15 text-destructive",
};

const WAIVER_TEXT = `LIABILITY WAIVER AND RELEASE — SCHREIBER EXCAVATING

In consideration for being permitted to rent and use equipment owned by Schreiber Excavating, I, the undersigned, hereby acknowledge and agree as follows:

1. ASSUMPTION OF RISK. I understand that the use of construction and heavy equipment involves inherent risks of property damage, serious bodily injury, and death. I voluntarily and knowingly assume all such risks.

2. RELEASE OF LIABILITY. I, on behalf of myself, my heirs, executors, administrators, successors, and assigns, hereby RELEASE, WAIVE, DISCHARGE, AND COVENANT NOT TO SUE Schreiber Excavating, its owners, officers, employees, agents, and affiliates (collectively, the "Released Parties") from any and all liability, claims, demands, actions, and causes of action whatsoever arising out of or related to any loss, damage, or injury — including death — sustained by me or any third party, or to any property, while using the rented equipment, whether caused by the negligence of the Released Parties or otherwise.

3. INDEMNIFICATION. I agree to INDEMNIFY, DEFEND, AND HOLD HARMLESS the Released Parties from any loss, liability, damage, or costs (including attorneys' fees) they may incur arising out of my use of the equipment or any breach of this agreement.

4. CONDITION & RESPONSIBILITY. I accept the equipment in its current condition, am responsible for inspecting it before use, will operate it only for its intended purpose and only if qualified to do so, and will return it in the same condition. I am responsible for any loss, theft, or damage occurring during my rental period.

5. NO WARRANTIES. The equipment is provided AS-IS, with no warranties of any kind, express or implied.

6. ACKNOWLEDGMENT. I have read this waiver, understand it, and sign it voluntarily. This waiver is governed by the laws of the state in which Schreiber Excavating operates.`;

const rentalSchema = z.object({
  equipment_id: z.string().uuid(),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  notes: z.string().max(500).optional(),
  waiver_name: z.string().trim().min(2, "Type your full legal name").max(120),
  agreed: z.literal(true, { errorMap: () => ({ message: "You must agree to the waiver" }) }),
  signature: z.string().min(1, "Signature is required"),
});

const EquipmentRental = () => {
  const navigate = useNavigate();
  const { user, role, displayName } = useAuth();
  const isOffice = role === "office" || role === "admin";

  const [items, setItems] = useState<Equipment[]>([]);
  const [myRentals, setMyRentals] = useState<Rental[]>([]);
  const [allRentals, setAllRentals] = useState<(Rental & { display_name?: string | null; email?: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Rental form
  const [equipmentId, setEquipmentId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [waiverName, setWaiverName] = useState(displayName ?? "");
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [waiverOpen, setWaiverOpen] = useState(false);

  // Admin equipment dialog
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [eqName, setEqName] = useState("");
  const [eqDescription, setEqDescription] = useState("");
  const [eqRate, setEqRate] = useState<string>("");
  const [eqPhotoUrl, setEqPhotoUrl] = useState("");

  const selected = items.find((i) => i.id === equipmentId);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isOffice]);

  useEffect(() => {
    if (displayName && !waiverName) setWaiverName(displayName);
  }, [displayName, waiverName]);

  const load = async () => {
    setLoading(true);
    const { data: eq } = await supabase
      .from("equipment_items")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .order("name");
    setItems((eq ?? []) as Equipment[]);

    if (user) {
      const { data: mine } = await supabase
        .from("equipment_rentals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setMyRentals((mine ?? []) as Rental[]);
    }

    if (isOffice) {
      const { data: all } = await supabase
        .from("equipment_rentals")
        .select("*")
        .order("created_at", { ascending: false });
      const userIds = Array.from(new Set((all ?? []).map((o) => o.user_id)));
      let pmap: Record<string, { display_name: string | null; email: string | null }> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id,display_name,email")
          .in("user_id", userIds);
        pmap = Object.fromEntries((profs ?? []).map((p) => [p.user_id, { display_name: p.display_name, email: p.email }]));
      }
      setAllRentals(
        ((all ?? []) as Rental[]).map((r) => ({
          ...r,
          display_name: pmap[r.user_id]?.display_name ?? null,
          email: pmap[r.user_id]?.email ?? null,
        })),
      );
    }
    setLoading(false);
  };

  const submitRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selected) return;
    const parsed = rentalSchema.safeParse({
      equipment_id: equipmentId,
      start_date: startDate,
      end_date: endDate,
      notes,
      waiver_name: waiverName,
      agreed,
      signature: signature ?? "",
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please complete the form");
      return;
    }
    if (endDate < startDate) {
      toast.error("End date must be on or after start date");
      return;
    }
    setSubmitting(true);
    try {
      // Upload signature
      const blob = await (await fetch(signature!)).blob();
      const path = `${user.id}/${Date.now()}-rental.png`;
      const { error: upErr } = await supabase.storage.from("shop-waivers").upload(path, blob, {
        contentType: "image/png",
        upsert: false,
      });
      if (upErr) throw upErr;

      const { error } = await supabase.from("equipment_rentals").insert({
        user_id: user.id,
        equipment_id: equipmentId,
        equipment_name: selected.name,
        start_date: startDate,
        end_date: endDate,
        notes: notes.trim() || null,
        waiver_name: waiverName.trim(),
        waiver_signature_path: path,
        waiver_text: WAIVER_TEXT,
      });
      if (error) throw error;

      toast.success("Rental request submitted");
      setEquipmentId("");
      setStartDate("");
      setEndDate("");
      setNotes("");
      setAgreed(false);
      setSignature(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit rental");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRental = async (id: string) => {
    const { error } = await supabase.from("equipment_rentals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cancelled");
    void load();
  };

  const updateRentalStatus = async (id: string, status: Rental["status"]) => {
    const { error } = await supabase.from("equipment_rentals").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  // Admin: equipment CRUD
  const openCreate = () => {
    setEditing(null);
    setEqName("");
    setEqDescription("");
    setEqRate("");
    setEqPhotoUrl("");
    setAdminOpen(true);
  };
  const openEdit = (eq: Equipment) => {
    setEditing(eq);
    setEqName(eq.name);
    setEqDescription(eq.description ?? "");
    setEqRate(eq.daily_rate?.toString() ?? "");
    setEqPhotoUrl(eq.photo_url ?? "");
    setAdminOpen(true);
  };
  const saveEquipment = async () => {
    if (!eqName.trim()) {
      toast.error("Name is required");
      return;
    }
    const payload = {
      name: eqName.trim(),
      description: eqDescription.trim() || null,
      daily_rate: eqRate ? Number(eqRate) : null,
      photo_url: eqPhotoUrl.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("equipment_items").update(payload).eq("id", editing.id)
      : await supabase.from("equipment_items").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Updated" : "Added");
    setAdminOpen(false);
    void load();
  };
  const deleteEquipment = async (id: string) => {
    if (!confirm("Remove this equipment from the catalog?")) return;
    const { error } = await supabase.from("equipment_items").update({ is_active: false }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    void load();
  };

  const minDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/perks")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <h1 className="font-display text-lg uppercase tracking-wide">Rent Equipment</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5 pb-12">
        <Tabs defaultValue="rent">
          <TabsList className="grid w-full" style={{ gridTemplateColumns: isOffice ? "repeat(3, 1fr)" : "repeat(2, 1fr)" }}>
            <TabsTrigger value="rent">Rent</TabsTrigger>
            <TabsTrigger value="mine">My Rentals ({myRentals.length})</TabsTrigger>
            {isOffice && <TabsTrigger value="admin">Manage</TabsTrigger>}
          </TabsList>

          <TabsContent value="rent" className="mt-4">
            <Card className="p-4">
              <form onSubmit={submitRental} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Hi {displayName ?? "there"} — pick the equipment you need and sign the waiver.
                </p>

                <div>
                  <Label>Equipment</Label>
                  <Select value={equipmentId} onValueChange={setEquipmentId}>
                    <SelectTrigger><SelectValue placeholder="Choose equipment" /></SelectTrigger>
                    <SelectContent>
                      {items.length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No equipment in catalog yet.</div>
                      )}
                      {items.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name}
                          {i.daily_rate ? ` · $${i.daily_rate}/day` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selected?.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{selected.description}</p>
                  )}
                  {selected?.photo_url && (
                    <img
                      src={selected.photo_url}
                      alt={selected.name}
                      className="mt-2 h-32 w-full rounded-md object-cover"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start date</Label>
                    <Input
                      type="date"
                      min={minDate}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>End date</Label>
                    <Input
                      type="date"
                      min={startDate || minDate}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label>What will you use it for? (optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={500}
                    placeholder="Side project, family help, etc."
                  />
                </div>

                <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Liability waiver</p>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setWaiverOpen(true)}>
                      Read full waiver
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    By signing, you release Schreiber Excavating of any and all liability for loss, damage, or injury arising from your use of this equipment.
                  </p>

                  <div>
                    <Label>Type your full legal name</Label>
                    <Input
                      value={waiverName}
                      onChange={(e) => setWaiverName(e.target.value)}
                      maxLength={120}
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <Label>Signature</Label>
                    <SignaturePad onChange={setSignature} />
                  </div>

                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
                    <span>
                      I have read the waiver and agree to release Schreiber Excavating of any and all liability.
                    </span>
                  </label>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting || !equipmentId || !startDate || !endDate || !agreed || !signature || !waiverName.trim()}
                >
                  {submitting ? "Submitting…" : "Submit rental request"}
                </Button>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="mine" className="mt-4 space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : myRentals.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">No rentals yet.</Card>
            ) : (
              myRentals.map((r) => (
                <Card key={r.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{r.equipment_name}</p>
                      <Badge className={RENTAL_STATUS[r.status]} variant="secondary">{r.status.replace("_", " ")}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.start_date).toLocaleDateString()} → {new Date(r.end_date).toLocaleDateString()}
                    </p>
                    {r.notes && <p className="mt-1 text-xs italic text-muted-foreground">"{r.notes}"</p>}
                  </div>
                  {r.status === "requested" && (
                    <Button variant="ghost" size="icon" onClick={() => cancelRental(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </Card>
              ))
            )}
          </TabsContent>

          {isOffice && (
            <TabsContent value="admin" className="mt-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">All requests</h2>
                </div>
                {allRentals.length === 0 ? (
                  <Card className="p-4 text-center text-sm text-muted-foreground">No requests.</Card>
                ) : (
                  allRentals.map((r) => (
                    <Card key={r.id} className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{r.equipment_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.display_name ?? r.email ?? "Unknown"} · {new Date(r.start_date).toLocaleDateString()} → {new Date(r.end_date).toLocaleDateString()}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Signed by {r.waiver_name}
                          </p>
                          {r.notes && <p className="mt-1 text-xs italic text-muted-foreground">"{r.notes}"</p>}
                        </div>
                        <Select value={r.status} onValueChange={(v) => updateRentalStatus(r.id, v as Rental["status"])}>
                          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="requested">Requested</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="denied">Denied</SelectItem>
                            <SelectItem value="picked_up">Picked up</SelectItem>
                            <SelectItem value="returned">Returned</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Equipment catalog</h2>
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="mr-1 h-4 w-4" /> Add
                  </Button>
                </div>
                {items.length === 0 ? (
                  <Card className="p-4 text-center text-sm text-muted-foreground">Nothing in the catalog yet.</Card>
                ) : (
                  items.map((eq) => (
                    <Card key={eq.id} className="flex items-start justify-between gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{eq.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {eq.daily_rate ? `$${eq.daily_rate}/day` : "No rate set"}
                          {eq.description ? ` · ${eq.description}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(eq)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteEquipment(eq.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Full waiver dialog */}
      <Dialog open={waiverOpen} onOpenChange={setWaiverOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Liability Waiver</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">{WAIVER_TEXT}</pre>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setWaiverOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin equipment dialog */}
      <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit equipment" : "Add equipment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={eqName} onChange={(e) => setEqName(e.target.value)} maxLength={120} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={eqDescription} onChange={(e) => setEqDescription(e.target.value)} maxLength={500} />
            </div>
            <div>
              <Label>Daily rate (USD)</Label>
              <Input type="number" min={0} step="0.01" value={eqRate} onChange={(e) => setEqRate(e.target.value)} />
            </div>
            <div>
              <Label>Photo URL (optional)</Label>
              <Input value={eqPhotoUrl} onChange={(e) => setEqPhotoUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdminOpen(false)}>Cancel</Button>
            <Button onClick={saveEquipment}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EquipmentRental;
