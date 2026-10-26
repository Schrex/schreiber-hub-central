import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LocationPicker, type PickedLocation } from "@/components/jobs/LocationPicker";
import { errorMessage } from "@/lib/errorMessage";

/** "New" button + dialog that adds an active job (office/admin). */
export function NewJobDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ job_number: "", name: "", address: "" });
  const [location, setLocation] = useState<PickedLocation | null>(null);

  // When map picks a new location, auto-fill the editable address label
  useEffect(() => {
    if (location && !form.address) {
      setForm((f) => ({ ...f, address: location.address }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.lat, location?.lon]);

  const resetForm = () => {
    setForm({ job_number: "", name: "", address: "" });
    setLocation(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.from("jobs").insert({
        job_number: form.job_number || null,
        name: form.name,
        address: form.address || location?.address || null,
        latitude: location?.lat ?? null,
        longitude: location?.lon ?? null,
      });
      if (error) throw error;
      toast.success(location ? "Job added with location" : "Job added");
      resetForm();
      setOpen(false);
      onCreated();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to save"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" /> New</Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          // Focus the Name field instead of letting Radix grab the map
          setTimeout(() => document.getElementById("name")?.focus(), 0);
        }}
      >
        <DialogHeader><DialogTitle>New Job</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="job_number">Job #</Label>
              <Input id="job_number" value={form.job_number} onChange={(e) => setForm({ ...form, job_number: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          </div>

          <LocationPicker value={location} onChange={setLocation} />

          <div>
            <Label htmlFor="address">Address / location label</Label>
            <Input
              id="address"
              placeholder="Edit if needed (e.g. 'Back lot, Smith Farm')"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">Auto-filled from the map. You can rename it.</p>
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Save Job"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
