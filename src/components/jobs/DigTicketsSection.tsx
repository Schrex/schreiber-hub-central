import { useEffect, useState } from "react";
import { Plus, ExternalLink, Shovel, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Status = "requested" | "marked" | "cleared" | "expired" | "cancelled";
type ReqType = "normal" | "emergency" | "update" | "remark";

interface Ticket {
  id: string;
  ticket_number: string | null;
  status: Status;
  request_type: ReqType;
  work_description: string | null;
  dig_start_date: string | null;
  dig_end_date: string | null;
  expiration_date: string | null;
  response_notes: string | null;
  ticket_url: string | null;
}

const STATUS_STYLE: Record<Status, string> = {
  requested: "bg-muted text-muted-foreground",
  marked: "bg-primary/15 text-primary",
  cleared: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  expired: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const EXACTIX_URL = "https://newyork.exactix.com/";

interface Props {
  jobId: string;
}

export const DigTicketsSection = ({ jobId }: Props) => {
  const { role, user } = useAuth();
  const canEdit = role === "foreman" || role === "office" || role === "admin";
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    ticket_number: "",
    ticket_url: "",
    status: "requested" as Status,
    request_type: "normal" as ReqType,
    work_description: "",
    dig_start_date: "",
    dig_end_date: "",
    expiration_date: "",
    response_notes: "",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("dig_tickets")
      .select(
        "id, ticket_number, status, request_type, work_description, dig_start_date, dig_end_date, expiration_date, response_notes",
      )
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });
    setTickets((data as Ticket[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const reset = () =>
    setForm({
      ticket_number: "",
      status: "requested",
      request_type: "normal",
      work_description: "",
      dig_start_date: "",
      dig_end_date: "",
      expiration_date: "",
      response_notes: "",
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.from("dig_tickets").insert({
        job_id: jobId,
        ticket_number: form.ticket_number || null,
        status: form.status,
        request_type: form.request_type,
        work_description: form.work_description || null,
        dig_start_date: form.dig_start_date || null,
        dig_end_date: form.dig_end_date || null,
        expiration_date: form.expiration_date || null,
        response_notes: form.response_notes || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Ticket added");
      reset();
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("dig_tickets").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTickets((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this ticket?")) return;
    const { error } = await supabase.from("dig_tickets").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTickets((ts) => ts.filter((t) => t.id !== id));
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
          <Shovel className="h-3.5 w-3.5" /> 811 Dig Tickets
        </h2>
        <div className="flex items-center gap-1">
          <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[11px]">
            <a href={EXACTIX_URL} target="_blank" rel="noreferrer">
              Exactix <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
          {canEdit && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-7 px-2 text-[11px]">
                  <Plus className="h-3 w-3" /> Log
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader><DialogTitle>Log 811 Ticket</DialogTitle></DialogHeader>
                <form onSubmit={submit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="ticket_number">Ticket #</Label>
                      <Input
                        id="ticket_number"
                        placeholder="Exactix ticket"
                        value={form.ticket_number}
                        onChange={(e) => setForm({ ...form, ticket_number: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select
                        value={form.request_type}
                        onValueChange={(v) => setForm({ ...form, request_type: v as ReqType })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="emergency">Emergency</SelectItem>
                          <SelectItem value="update">Update</SelectItem>
                          <SelectItem value="remark">Remark</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) => setForm({ ...form, status: v as Status })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="requested">Requested</SelectItem>
                        <SelectItem value="marked">Marked</SelectItem>
                        <SelectItem value="cleared">Cleared to dig</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="dig_start">Dig start</Label>
                      <Input id="dig_start" type="date" value={form.dig_start_date}
                        onChange={(e) => setForm({ ...form, dig_start_date: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="dig_end">Dig end</Label>
                      <Input id="dig_end" type="date" value={form.dig_end_date}
                        onChange={(e) => setForm({ ...form, dig_end_date: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="exp">Expires</Label>
                      <Input id="exp" type="date" value={form.expiration_date}
                        onChange={(e) => setForm({ ...form, expiration_date: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="work">Work description</Label>
                    <Textarea id="work" rows={2} value={form.work_description}
                      onChange={(e) => setForm({ ...form, work_description: e.target.value })} />
                  </div>

                  <div>
                    <Label htmlFor="resp">Response notes</Label>
                    <Textarea id="resp" rows={2} placeholder="Marks, utility responses, photos pending…"
                      value={form.response_notes}
                      onChange={(e) => setForm({ ...form, response_notes: e.target.value })} />
                  </div>

                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Saving…" : "Save Ticket"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && tickets.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            No tickets logged. {canEdit && "File one in Exactix, then log it here."}
          </p>
        )}
        {tickets.map((t) => {
          const expiringSoon =
            t.expiration_date && t.expiration_date >= today &&
            (new Date(t.expiration_date).getTime() - Date.now()) / 86400000 <= 3;
          const expired = t.expiration_date && t.expiration_date < today;
          return (
            <div key={t.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[9px] uppercase font-bold tracking-wider rounded px-1.5 py-0.5 ${STATUS_STYLE[t.status]}`}>
                      {t.status}
                    </span>
                    {t.request_type !== "normal" && (
                      <span className="text-[9px] uppercase font-bold tracking-wider rounded px-1.5 py-0.5 bg-accent/15 text-accent-foreground">
                        {t.request_type}
                      </span>
                    )}
                    {t.ticket_number && (
                      <span className="font-mono text-[11px] text-muted-foreground">#{t.ticket_number}</span>
                    )}
                  </div>
                  {t.work_description && (
                    <p className="mt-1 text-xs">{t.work_description}</p>
                  )}
                  {(t.dig_start_date || t.expiration_date) && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t.dig_start_date && <>Dig: {t.dig_start_date}{t.dig_end_date ? ` → ${t.dig_end_date}` : ""}</>}
                      {t.dig_start_date && t.expiration_date && " · "}
                      {t.expiration_date && (
                        <span className={expired ? "text-destructive font-semibold" : expiringSoon ? "text-accent-foreground font-semibold" : ""}>
                          {expired ? "Expired " : "Expires "}{t.expiration_date}
                        </span>
                      )}
                    </p>
                  )}
                  {t.response_notes && (
                    <p className="mt-1 text-[11px] text-muted-foreground">{t.response_notes}</p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex flex-col items-end gap-1">
                    <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v as Status)}>
                      <SelectTrigger className="h-7 w-28 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="requested">Requested</SelectItem>
                        <SelectItem value="marked">Marked</SelectItem>
                        <SelectItem value="cleared">Cleared</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(t.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
