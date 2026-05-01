import { useEffect, useState } from "react";
import { Truck, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TruckRequest {
  id: string;
  job_id: string;
  requested_date: string;
  start_time: string | null;
  material: string | null;
  pickup_location: string | null;
  dump_location: string | null;
  load_quantity: number | null;
  requester_name: string | null;
  requester_notes: string | null;
  status: "pending" | "approved" | "declined" | "cancelled";
  jobs: { id: string; job_number: string | null; name: string; address: string | null } | null;
}

export const TruckRequestsPanel = () => {
  const [requests, setRequests] = useState<TruckRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<TruckRequest | null>(null);
  const [mode, setMode] = useState<"approve" | "decline" | null>(null);
  const [busy, setBusy] = useState(false);
  const [truckNumber, setTruckNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("truck_requests")
      .select("*, jobs(id, job_number, name, address)")
      .eq("status", "pending")
      .order("requested_date", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(error.message);
    } else {
      setRequests((data ?? []) as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("truck-requests-pending")
      .on("postgres_changes", { event: "*", schema: "public", table: "truck_requests" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const openDecide = (r: TruckRequest, m: "approve" | "decline") => {
    setActive(r);
    setMode(m);
    setTruckNumber("");
    setDriverName("");
    setNotes("");
  };

  const close = () => {
    setActive(null);
    setMode(null);
  };

  const submit = async () => {
    if (!active || !mode) return;
    if (mode === "approve" && !truckNumber.trim()) {
      toast.error("Truck # is required to approve");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("decide-truck-request", {
        body: {
          requestId: active.id,
          decision: mode === "approve" ? "approved" : "declined",
          truckNumber: mode === "approve" ? truckNumber.trim() : undefined,
          driverName: mode === "approve" ? driverName.trim() || undefined : undefined,
          notes: notes.trim() || undefined,
        },
      });
      if (error) throw error;
      toast.success(mode === "approve" ? "Approved — dispatch order created" : "Request declined");
      close();
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;
  if (requests.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-300/40 bg-amber-50/60 p-3 dark:bg-amber-950/20">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-amber-600" />
          Pending truck requests
          <Badge variant="secondary" className="ml-1">{requests.length}</Badge>
        </h2>
      </header>
      <div className="space-y-2">
        {requests.map((r) => (
          <div key={r.id} className="rounded-lg border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Truck className="h-4 w-4 text-primary" />
                  {r.jobs?.job_number ? `#${r.jobs.job_number} · ` : ""}{r.jobs?.name ?? "Job"}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.requested_date}{r.start_time ? ` @ ${r.start_time.slice(0, 5)}` : ""} · requested by {r.requester_name ?? "—"}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-foreground/90">
                  {r.material && <p><span className="text-muted-foreground">Material:</span> {r.material}</p>}
                  {r.load_quantity != null && <p><span className="text-muted-foreground">Loads/Qty:</span> {r.load_quantity}</p>}
                  {r.pickup_location && <p className="col-span-2"><span className="text-muted-foreground">Pickup:</span> {r.pickup_location}</p>}
                  {r.dump_location && <p className="col-span-2"><span className="text-muted-foreground">Dump:</span> {r.dump_location}</p>}
                  {r.requester_notes && <p className="col-span-2"><span className="text-muted-foreground">Notes:</span> {r.requester_notes}</p>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Button size="sm" onClick={() => openDecide(r, "approve")}>
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openDecide(r, "decline")}>
                  <XCircle className="mr-1 h-3.5 w-3.5" /> Decline
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "approve" ? "Approve truck request" : "Decline truck request"}
            </DialogTitle>
          </DialogHeader>
          {active && (
            <div className="grid gap-3">
              <div className="rounded-md border bg-muted/40 p-2 text-xs">
                <p className="font-semibold">{active.jobs?.job_number ? `#${active.jobs.job_number} · ` : ""}{active.jobs?.name}</p>
                <p className="text-muted-foreground">{active.requested_date}{active.start_time ? ` @ ${active.start_time.slice(0, 5)}` : ""}</p>
              </div>
              {mode === "approve" && (
                <>
                  <div>
                    <Label htmlFor="dt-truck" className="text-xs">Truck #</Label>
                    <Input
                      id="dt-truck"
                      value={truckNumber}
                      onChange={(e) => setTruckNumber(e.target.value)}
                      placeholder="e.g. T-12"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label htmlFor="dt-driver" className="text-xs">Driver name</Label>
                    <Input
                      id="dt-driver"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="e.g. Greg Black"
                    />
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="dt-notes" className="text-xs">
                  {mode === "approve" ? "Notes (optional)" : "Reason"}
                </Label>
                <Textarea
                  id="dt-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button onClick={submit} disabled={busy} variant={mode === "decline" ? "destructive" : "default"}>
              {busy ? "Saving…" : mode === "approve" ? "Approve & dispatch" : "Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
