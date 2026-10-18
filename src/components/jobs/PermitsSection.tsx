import { errorMessage } from "@/lib/errorMessage";
import { useEffect, useState } from "react";
import { Plus, FileCheck, Trash2, Paperclip, ExternalLink } from "lucide-react";
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
import { FileDropZone } from "@/components/ui/FileDropZone";

type Status =
  | "not_started"
  | "applied"
  | "in_review"
  | "approved"
  | "issued"
  | "expired"
  | "denied";

interface Permit {
  id: string;
  permit_type: string;
  permit_number: string | null;
  status: Status;
  responsible_user_id: string | null;
  responsible_name: string | null;
  issuing_agency: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  notes: string | null;
  file_path: string | null;
}

interface UserOption {
  user_id: string;
  display_name: string | null;
}

const STATUS_STYLE: Record<Status, string> = {
  not_started: "bg-muted text-muted-foreground",
  applied: "bg-primary/15 text-primary",
  in_review: "bg-primary/15 text-primary",
  approved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  issued: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  expired: "bg-destructive/15 text-destructive",
  denied: "bg-destructive/15 text-destructive",
};

const STATUS_LABEL: Record<Status, string> = {
  not_started: "Not started",
  applied: "Applied",
  in_review: "In review",
  approved: "Approved",
  issued: "Issued",
  expired: "Expired",
  denied: "Denied",
};

const COMMON_TYPES = [
  "Building",
  "Right of Way",
  "Highway Work",
  "DOT",
  "Stormwater (SWPPP)",
  "Wetlands",
  "Demolition",
  "Electrical",
  "Other",
];

interface Props {
  jobId: string;
}

export const PermitsSection = ({ jobId }: Props) => {
  const { role: realRole, effectiveRole, user } = useAuth();
  const role = effectiveRole ?? realRole;
  const canEdit = role === "office" || role === "admin";
  const [permits, setPermits] = useState<Permit[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    permit_type: "Building",
    permit_type_custom: "",
    permit_number: "",
    status: "not_started" as Status,
    responsible_mode: "internal" as "internal" | "external",
    responsible_user_id: "",
    responsible_name: "",
    issuing_agency: "",
    issue_date: "",
    expiration_date: "",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    const [{ data: perms }, { data: profs }] = await Promise.all([
      supabase
        .from("job_permits")
        .select(
          "id, permit_type, permit_number, status, responsible_user_id, responsible_name, issuing_agency, issue_date, expiration_date, notes, file_path",
        )
        .eq("job_id", jobId)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, display_name").eq("is_active", true),
    ]);
    setPermits((perms as Permit[]) ?? []);
    setUsers((profs as UserOption[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const userName = (uid: string | null) =>
    users.find((u) => u.user_id === uid)?.display_name ?? "Unknown";

  const reset = () => {
    setFile(null);
    setForm({
      permit_type: "Building",
      permit_type_custom: "",
      permit_number: "",
      status: "not_started",
      responsible_mode: "internal",
      responsible_user_id: "",
      responsible_name: "",
      issuing_agency: "",
      issue_date: "",
      expiration_date: "",
      notes: "",
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const type = form.permit_type === "Other" ? form.permit_type_custom.trim() : form.permit_type;
      if (!type) throw new Error("Permit type required");

      let file_path: string | null = null;
      let file_size: number | null = null;
      let mime_type: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${jobId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("permits")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        file_path = path;
        file_size = file.size;
        mime_type = file.type || null;
      }

      const { error } = await supabase.from("job_permits").insert({
        job_id: jobId,
        permit_type: type,
        permit_number: form.permit_number || null,
        status: form.status,
        responsible_user_id:
          form.responsible_mode === "internal" && form.responsible_user_id
            ? form.responsible_user_id
            : null,
        responsible_name:
          form.responsible_mode === "external" && form.responsible_name
            ? form.responsible_name
            : null,
        issuing_agency: form.issuing_agency || null,
        issue_date: form.issue_date || null,
        expiration_date: form.expiration_date || null,
        notes: form.notes || null,
        file_path,
        file_size,
        mime_type,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Permit added");
      reset();
      setOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to save"));
    } finally {
      setBusy(false);
    }
  };

  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("permits")
      .createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "Could not open file");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("job_permits").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPermits((ps) => ps.map((p) => (p.id === id ? { ...p, status } : p)));
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this permit?")) return;
    const target = permits.find((p) => p.id === id);
    const { error } = await supabase.from("job_permits").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (target?.file_path) {
      await supabase.storage.from("permits").remove([target.file_path]);
    }
    setPermits((ps) => ps.filter((p) => p.id !== id));
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <FileDropZone
      accept="application/pdf,image/*"
      multiple={false}
      disabled={!canEdit}
      onFiles={(fs) => { if (fs[0]) { setFile(fs[0]); setOpen(true); } }}
      label="Drop permit document"
    >
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
          <FileCheck className="h-3.5 w-3.5" /> Permits
        </h2>
        {canEdit && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-7 px-2 text-[11px]">
                <Plus className="h-3 w-3" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>Add Permit</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type *</Label>
                    <Select
                      value={form.permit_type}
                      onValueChange={(v) => setForm({ ...form, permit_type: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COMMON_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.permit_type === "Other" && (
                      <Input
                        className="mt-2"
                        placeholder="Custom type"
                        value={form.permit_type_custom}
                        onChange={(e) => setForm({ ...form, permit_type_custom: e.target.value })}
                      />
                    )}
                  </div>
                  <div>
                    <Label htmlFor="permit_number">Permit #</Label>
                    <Input id="permit_number" value={form.permit_number}
                      onChange={(e) => setForm({ ...form, permit_number: e.target.value })} />
                  </div>
                </div>

                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Responsible</Label>
                  <div className="mt-1 flex gap-2">
                    <Button type="button" size="sm"
                      variant={form.responsible_mode === "internal" ? "default" : "outline"}
                      onClick={() => setForm({ ...form, responsible_mode: "internal" })}>
                      Team member
                    </Button>
                    <Button type="button" size="sm"
                      variant={form.responsible_mode === "external" ? "default" : "outline"}
                      onClick={() => setForm({ ...form, responsible_mode: "external" })}>
                      External / typed
                    </Button>
                  </div>
                  {form.responsible_mode === "internal" ? (
                    <Select
                      value={form.responsible_user_id}
                      onValueChange={(v) => setForm({ ...form, responsible_user_id: v })}
                    >
                      <SelectTrigger className="mt-2"><SelectValue placeholder="Pick a person" /></SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.user_id} value={u.user_id}>
                            {u.display_name ?? "Unnamed"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="mt-2"
                      placeholder="Name (e.g. consultant, GC PM)"
                      value={form.responsible_name}
                      onChange={(e) => setForm({ ...form, responsible_name: e.target.value })}
                    />
                  )}
                </div>

                <div>
                  <Label htmlFor="agency">Issuing agency</Label>
                  <Input id="agency" placeholder="Town of …, NYSDOT, DEC…" value={form.issuing_agency}
                    onChange={(e) => setForm({ ...form, issuing_agency: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="issue">Issue date</Label>
                    <Input id="issue" type="date" value={form.issue_date}
                      onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="exp">Expires</Label>
                    <Input id="exp" type="date" value={form.expiration_date}
                      onChange={(e) => setForm({ ...form, expiration_date: e.target.value })} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" rows={2} value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>

                <div>
                  <Label htmlFor="permit_file">Permit document</Label>
                  <Input
                    id="permit_file"
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  {file && (
                    <p className="mt-1 text-[11px] text-muted-foreground truncate">
                      {file.name} · {(file.size / 1024).toFixed(0)} KB
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Saving…" : "Save Permit"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && permits.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            No permits tracked yet.
          </p>
        )}
        {permits.map((p) => {
          const expiringSoon =
            p.expiration_date && p.expiration_date >= today &&
            (new Date(p.expiration_date).getTime() - Date.now()) / 86400000 <= 14;
          const expired = p.expiration_date && p.expiration_date < today;
          const responsible = p.responsible_user_id
            ? userName(p.responsible_user_id)
            : p.responsible_name;
          return (
            <div key={p.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[9px] uppercase font-bold tracking-wider rounded px-1.5 py-0.5 ${STATUS_STYLE[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                    <span className="text-xs font-semibold">{p.permit_type}</span>
                    {p.permit_number && (
                      <span className="font-mono text-[11px] text-muted-foreground">#{p.permit_number}</span>
                    )}
                  </div>
                  {(p.issuing_agency || responsible) && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {p.issuing_agency}
                      {p.issuing_agency && responsible && " · "}
                      {responsible && <>Owner: <span className="text-foreground">{responsible}</span></>}
                    </p>
                  )}
                  {(p.issue_date || p.expiration_date) && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {p.issue_date && <>Issued: {p.issue_date}</>}
                      {p.issue_date && p.expiration_date && " · "}
                      {p.expiration_date && (
                        <span className={expired ? "text-destructive font-semibold" : expiringSoon ? "text-accent-foreground font-semibold" : ""}>
                          {expired ? "Expired " : "Expires "}{p.expiration_date}
                        </span>
                      )}
                    </p>
                  )}
                  {p.notes && <p className="mt-1 text-[11px] text-muted-foreground">{p.notes}</p>}
                  {p.file_path && (
                    <button
                      type="button"
                      onClick={() => openFile(p.file_path!)}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      <Paperclip className="h-3 w-3" /> Open document
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {canEdit && (
                  <div className="flex flex-col items-end gap-1">
                    <Select value={p.status} onValueChange={(v) => updateStatus(p.id, v as Status)}>
                      <SelectTrigger className="h-7 w-28 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(p.id)}>
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
    </FileDropZone>
  );
};
