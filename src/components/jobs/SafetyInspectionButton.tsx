import { errorMessage } from "@/lib/errorMessage";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAccess } from "@/lib/access";

export const SafetyInspectionButton = ({ jobId }: { jobId: string }) => {
  const { can } = useAccess();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  if (!can("job.inspection.request")) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-safety-inspection", {
        body: { jobId, notes: notes.trim() || undefined },
      });
      if (error) throw error;
      if (data?.notification === "queued") toast.success("Inspection request saved. Notification queued; delivery is pending.");
      else toast.warning("Inspection request saved, but the notification was not queued. Contact the safety office; do not submit a duplicate request.");
      if (data?.statusRecorded === false) toast.warning("The notification status could not be saved. Ask an administrator to check this request.");
      setOpen(false);
      setNotes("");
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Failed to send"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <ShieldCheck className="mr-2 h-4 w-4" /> Enroll in 3rd-party safety inspections
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enroll in 3rd-party safety inspections</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Adds this job to York Safety Solutions' routine 3rd-party inspection rotation.
          </p>
          <Textarea
            placeholder="Optional notes (site access, scheduling, hazards...)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send request"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
