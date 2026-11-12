import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errorMessage";
import { noticeDaysFromNow, timeOffFormSchema, TYPE_LABEL, type HalfDay, type TimeOffType } from "@/lib/timeOff";
import type { NoticePolicy } from "@/lib/timeOffNotice";
import { cn } from "@/lib/utils";
import { ShortNoticeDialog } from "./ShortNoticeDialog";
import { submitTimeOffRequest } from "./timeOffApi";

interface Props {
  /** Signed-in requester; without one, submit does nothing. */
  userId: string | undefined;
  displayName: string | null | undefined;
  /** Notice policy for the role the page is shown as. */
  notice: NoticePolicy;
  /** Called after a request is inserted (the page reloads its list). */
  onSubmitted: () => void;
}

/** "Request" button, the new-request form dialog and its short-notice confirmation. Owns the form state. */
export const RequestFormDialog = ({ userId, displayName, notice, onSubmitted }: Props) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<TimeOffType>("vacation");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [halfDay, setHalfDay] = useState<HalfDay>("none");
  const [reason, setReason] = useState("");
  const [shortNoticeConfirm, setShortNoticeConfirm] = useState(false);

  const resetForm = () => {
    setType("vacation"); setStartDate(undefined); setEndDate(undefined); setHalfDay("none"); setReason(""); setShortNoticeConfirm(false);
  };

  const performSubmit = async () => {
    if (!userId || !startDate || !endDate) return;
    setBusy(true);
    try {
      await submitTimeOffRequest({
        userId, requesterName: displayName ?? null, type, startDate, endDate, halfDay, reason,
      });
      toast.success("Request submitted");
      resetForm(); setOpen(false); setShortNoticeConfirm(false); onSubmitted();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to submit"));
    } finally { setBusy(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!startDate || !endDate) {
      toast.error("Pick start and end dates"); return;
    }
    const parsed = timeOffFormSchema.safeParse({ type, start_date: startDate, end_date: endDate, half_day: halfDay, reason });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid"); return; }

    // Notice check (vacation/personal only — sick & other are exempt)
    const enforceNotice = type === "vacation" || type === "personal";
    if (enforceNotice) {
      const days = noticeDaysFromNow(startDate);
      if (days < notice.days) {
        setShortNoticeConfirm(true);
        return;
      }
    }
    await performSubmit();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogTrigger asChild>
          <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Request</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New time off request</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as TimeOffType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABEL) as TimeOffType[]).map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Start date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start font-normal", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "MMM d, yyyy") : "Pick"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); if (d && (!endDate || endDate < d)) setEndDate(d); }} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>End date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start font-normal", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "MMM d, yyyy") : "Pick"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} disabled={(d) => !!startDate && d < startDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div>
              <Label>Half day (single-day only)</Label>
              <Select value={halfDay} onValueChange={(v) => setHalfDay(v as HalfDay)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Full day(s)</SelectItem>
                  <SelectItem value="am">Morning (AM) only</SelectItem>
                  <SelectItem value="pm">Afternoon (PM) only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reason (optional)</Label>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. family vacation" />
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Submitting…" : "Submit request"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ShortNoticeDialog
        open={shortNoticeConfirm}
        noticeText={notice.text}
        startDate={startDate}
        onClose={() => setShortNoticeConfirm(false)}
        onConfirm={() => {
          setShortNoticeConfirm(false);
          performSubmit();
        }}
      />
    </>
  );
};
