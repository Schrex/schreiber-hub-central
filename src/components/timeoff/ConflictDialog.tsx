import { AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { renderRange, type TimeOffRequest } from "@/lib/timeOff";

export interface PendingApproval {
  req: TimeOffRequest;
  conflicts: TimeOffRequest[];
}

interface Props {
  /** The approval waiting for confirmation; null keeps the dialog closed. */
  pending: PendingApproval | null;
  onClose: () => void;
  onConfirm: (req: TimeOffRequest) => void;
}

/** "Approve anyway?" confirmation when approved time off overlaps the request. */
export const ConflictDialog = ({ pending, onClose, onConfirm }: Props) => (
  <AlertDialog open={!!pending} onOpenChange={(v) => !v && onClose()}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Conflict on these dates
        </AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="space-y-2 text-sm">
            <p>Other approved time off overlaps with this request:</p>
            <ul className="list-disc pl-5">
              {pending?.conflicts.map((c) => (
                <li key={c.id}>
                  <strong>{c.requester_name ?? "Employee"}</strong> — {renderRange(c)}
                </li>
              ))}
            </ul>
            <p>Approve anyway?</p>
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={() => pending && onConfirm(pending.req)}>
          Approve anyway
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
