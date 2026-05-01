import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const SafetyInspectionButton = ({ jobId }: { jobId: string }) => {
  const { role: realRole, effectiveRole } = useAuth();
  const role = effectiveRole ?? realRole;
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  if (role !== "office") return null;

  const submit = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-safety-inspection", {
        body: { jobId, notes: notes.trim() || undefined },
      });
      if (error) throw error;
      toast.success(`Safety inspection requested${data?.recipient ? ` → ${data.recipient}` : ""}`);
      setOpen(false);
      setNotes("");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <ShieldCheck className="mr-2 h-4 w-4" /> Request safety inspection
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request safety inspection</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sends this job's details to York Safety Solutions to add to the inspection list.
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
