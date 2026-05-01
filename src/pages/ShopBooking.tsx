import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Cog, Trash2 } from "lucide-react";
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
import { toast } from "sonner";

type Reservation = {
  id: string;
  user_id: string;
  reserved_date: string;
  purpose: string;
  notes: string | null;
  status: "requested" | "approved" | "denied" | "completed" | "cancelled";
  created_at: string;
};

const STATUS: Record<Reservation["status"], string> = {
  requested: "bg-muted text-muted-foreground",
  approved: "bg-primary/15 text-primary",
  denied: "bg-destructive/15 text-destructive",
  completed: "bg-role-office/15 text-role-office",
  cancelled: "bg-destructive/15 text-destructive",
};

const schema = z.object({
  reserved_date: z.string().min(1),
  purpose: z.string().trim().min(3, "Tell us briefly what you're doing").max(200),
  notes: z.string().max(500).optional(),
});

const ShopBooking = () => {
  const navigate = useNavigate();
  const { user, role, displayName } = useAuth();
  const isOffice = role === "office" || role === "admin";

  const [mine, setMine] = useState<Reservation[]>([]);
  const [all, setAll] = useState<(Reservation & { display_name?: string | null; email?: string | null })[]>([]);
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [reservedDate, setReservedDate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");

  const minDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isOffice]);

  const load = async () => {
    setLoading(true);
    if (user) {
      const { data } = await supabase
        .from("shop_reservations")
        .select("*")
        .eq("user_id", user.id)
        .order("reserved_date", { ascending: false });
      setMine((data ?? []) as Reservation[]);
    }

    // Booked dates (everyone can read their own; office reads all). For showing "taken" hints, query approved/requested upcoming.
    const { data: upcoming } = await supabase
      .from("shop_reservations")
      .select("reserved_date,status")
      .gte("reserved_date", minDate)
      .in("status", ["requested", "approved"]);
    setBookedDates(new Set((upcoming ?? []).map((r) => r.reserved_date)));

    if (isOffice) {
      const { data } = await supabase
        .from("shop_reservations")
        .select("*")
        .order("reserved_date", { ascending: false });
      const userIds = Array.from(new Set((data ?? []).map((o) => o.user_id)));
      let pmap: Record<string, { display_name: string | null; email: string | null }> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id,display_name,email")
          .in("user_id", userIds);
        pmap = Object.fromEntries((profs ?? []).map((p) => [p.user_id, { display_name: p.display_name, email: p.email }]));
      }
      setAll(
        ((data ?? []) as Reservation[]).map((r) => ({
          ...r,
          display_name: pmap[r.user_id]?.display_name ?? null,
          email: pmap[r.user_id]?.email ?? null,
        })),
      );
    }
    setLoading(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({ reserved_date: reservedDate, purpose, notes });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please complete the form");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("shop_reservations").insert({
      user_id: user.id,
      reserved_date: reservedDate,
      purpose: purpose.trim(),
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Reservation requested");
    setReservedDate("");
    setPurpose("");
    setNotes("");
    void load();
  };

  const cancel = async (id: string) => {
    const { error } = await supabase.from("shop_reservations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cancelled");
    void load();
  };

  const updateStatus = async (id: string, status: Reservation["status"]) => {
    const { error } = await supabase.from("shop_reservations").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  const dateTaken = reservedDate && bookedDates.has(reservedDate);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/perks")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Cog className="h-5 w-5 text-primary" />
            <h1 className="font-display text-lg uppercase tracking-wide">Mechanic Shop</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5 pb-12">
        <Tabs defaultValue="book">
          <TabsList className="grid w-full" style={{ gridTemplateColumns: isOffice ? "repeat(3, 1fr)" : "repeat(2, 1fr)" }}>
            <TabsTrigger value="book">Book</TabsTrigger>
            <TabsTrigger value="mine">Mine ({mine.length})</TabsTrigger>
            {isOffice && <TabsTrigger value="all">All ({all.length})</TabsTrigger>}
          </TabsList>

          <TabsContent value="book" className="mt-4">
            <Card className="p-4">
              <form onSubmit={submit} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Hi {displayName ?? "there"} — reserve a day to use the company mechanic shop. Office will approve.
                </p>

                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    min={minDate}
                    value={reservedDate}
                    onChange={(e) => setReservedDate(e.target.value)}
                  />
                  {dateTaken && (
                    <p className="mt-1 text-xs text-destructive">
                      Heads up — that day is already requested or approved by someone else.
                    </p>
                  )}
                </div>

                <div>
                  <Label>What are you working on?</Label>
                  <Input
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    maxLength={200}
                    placeholder="Brake job on personal truck"
                  />
                </div>

                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={500}
                    placeholder="Tools needed, lift required, etc."
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting || !reservedDate || !purpose.trim()}>
                  {submitting ? "Submitting…" : "Request reservation"}
                </Button>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="mine" className="mt-4 space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : mine.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">No reservations yet.</Card>
            ) : (
              mine.map((r) => (
                <Card key={r.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{new Date(r.reserved_date).toLocaleDateString()}</p>
                      <Badge className={STATUS[r.status]} variant="secondary">{r.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.purpose}</p>
                    {r.notes && <p className="mt-1 text-xs italic text-muted-foreground">"{r.notes}"</p>}
                  </div>
                  {r.status === "requested" && (
                    <Button variant="ghost" size="icon" onClick={() => cancel(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </Card>
              ))
            )}
          </TabsContent>

          {isOffice && (
            <TabsContent value="all" className="mt-4 space-y-2">
              {all.length === 0 ? (
                <Card className="p-4 text-center text-sm text-muted-foreground">No reservations.</Card>
              ) : (
                all.map((r) => (
                  <Card key={r.id} className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{new Date(r.reserved_date).toLocaleDateString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.display_name ?? r.email ?? "Unknown"} · {r.purpose}
                        </p>
                        {r.notes && <p className="mt-1 text-xs italic text-muted-foreground">"{r.notes}"</p>}
                      </div>
                      <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v as Reservation["status"])}>
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="requested">Requested</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="denied">Denied</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default ShopBooking;
