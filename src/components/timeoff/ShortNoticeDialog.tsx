import { AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { noticeDaysFromNow } from "@/lib/timeOff";

interface Props {
  open: boolean;
  /** Notice policy sentence from `noticeFor(role).text`. */
  noticeText: string;
  startDate: Date | undefined;
  onClose: () => void;
  onConfirm: () => void;
}

/** Warns that a vacation/personal request is inside the notice period; the user may submit anyway. */
export const ShortNoticeDialog = ({ open, noticeText, startDate, onClose, onConfirm }: Props) => (
  <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Short notice
        </AlertDialogTitle>
        <AlertDialogDescription>
          {noticeText} for vacation and personal days.
          {startDate && ` This request starts in ${noticeDaysFromNow(startDate)} day${noticeDaysFromNow(startDate) === 1 ? "" : "s"}.`} You can submit it anyway, but approval is not guaranteed.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Go back</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>
          Submit anyway
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
