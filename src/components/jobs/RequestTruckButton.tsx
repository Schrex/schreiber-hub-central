import { errorMessage } from "@/lib/errorMessage";
import { useState } from "react";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  jobId: string;
  jobAddress?: string | null;
}

export const RequestTruckButton = ({ jobId, jobAddress }: Props) => {
  const { role: realRole, effectiveRole } = useAuth();
  const role = effectiveRole ?? realRole;
  const canRequest = role === "foreman" || role === "office" || role === "admin";

  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    requestedDate: today,
    startTime: "07:00",
    material: "",
    pickupLocation: "",
    dumpLocation: jobAddress ?? "",
    loadQuantity: "",
    notes: "",
  });

  if (!canRequest) return null;

  const submit = async () => {
    if (!form.requestedDate) {
      toast.error("Pick a date");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("request-truck", {
        body: {
          jobId,
          requestedDate: form.requestedDate,
          startTime: form.startTime || null,
          material: form.material.trim() || null,
          pickupLocation: form.pickupLocation.trim() || null,
          dumpLocation: form.dumpLocation.trim() || null,
          loadQuantity: form.loadQuantity ? Number(form.loadQuantity) : null,
          notes: form.notes.trim() || null,
        },
      });
      if (error) throw error;
      toast.success("Truck request sent to office");
      setOpen(false);
      setForm({ ...form, material: "", pickupLocation: "", loadQuantity: "", notes: "" });
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Failed to send request"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setOpen(true)}>
        <Truck className="h-4 w-4 text-primary" />
        <span className="flex-1 text-left">
          <span className="block text-sm font-semibold">Request a truck</span>
          <span className="block text-[10px] font-normal text-muted-foreground">
            Sends to office for approval
          </span>
        </span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request a truck</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="rt-date" className="text-xs">Date needed</Label>
                <Input
                  id="rt-date"
                  type="date"
                  min={today}
                  value={form.requestedDate}
                  onChange={(e) => setForm({ ...form, requestedDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="rt-time" className="text-xs">Start time</Label>
                <Input
                  id="rt-time"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="rt-material" className="text-xs">Material</Label>
              <Input
                id="rt-material"
                placeholder="e.g. #57 stone, fill, asphalt"
                value={form.material}
                onChange={(e) => setForm({ ...form, material: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="rt-pickup" className="text-xs">Pickup location</Label>
              <Input
                id="rt-pickup"
                placeholder="Quarry / supplier"
                value={form.pickupLocation}
                onChange={(e) => setForm({ ...form, pickupLocation: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="rt-dump" className="text-xs">Dump location</Label>
              <Input
                id="rt-dump"
                placeholder="Job address (default)"
                value={form.dumpLocation}
                onChange={(e) => setForm({ ...form, dumpLocation: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="rt-qty" className="text-xs">Quantity / # of loads</Label>
              <Input
                id="rt-qty"
                type="number"
                step="0.5"
                placeholder="e.g. 4"
                value={form.loadQuantity}
                onChange={(e) => setForm({ ...form, loadQuantity: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="rt-notes" className="text-xs">Notes for office</Label>
              <Textarea
                id="rt-notes"
                rows={3}
                placeholder="Anything dispatch should know"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send request"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
