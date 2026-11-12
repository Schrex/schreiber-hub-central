import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { renderRange, type TimeOffRequest } from "@/lib/timeOff";

interface Props {
  /** The request being denied; null keeps the dialog closed. */
  target: TimeOffRequest | null;
  busy: boolean;
  onClose: () => void;
  /** Called with the optional note exactly as typed (the caller trims it). */
  onConfirm: (reason: string) => void;
}

/** Deny a request with an optional note for the employee. The note resets each time it opens. */
export const DenyDialog = ({ target, busy, onClose, onConfirm }: Props) => {
  const [reason, setReason] = useState("");
  const targetId = target?.id;
  useEffect(() => { if (targetId) setReason(""); }, [targetId]);

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Deny request</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Denying {target?.requester_name ?? "this request"} for {target && renderRange(target)}.
          </p>
          <div>
            <Label>Reason (optional)</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional note for the employee" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => onConfirm(reason)} disabled={busy}>
            {busy ? "Denying…" : "Deny request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
