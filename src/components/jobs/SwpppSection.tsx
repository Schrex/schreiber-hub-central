import { useEffect, useState } from "react";
import { Cloud, Plus, Trash2, Download, Mail, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileDropZone } from "@/components/ui/FileDropZone";

interface Report {
  id: string;
  week_of: string;
  report_date: string | null;
  title: string | null;
  email_subject: string | null;
  email_from: string | null;
  notes: string | null;
  file_path: string | null;
  file_name: string | null;
  source: string;
  uploaded_by_name: string | null;
  created_at: string;
}

const isoMonday = (d = new Date()) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
};

export const SwpppSection = ({ jobId, jobNumber }: { jobId: string; jobNumber: string | null }) => {
  const { role, effectiveRole, user } = useAuth();
  const r = effectiveRole ?? role;
  const canEdit = r === "office" || r === "admin";

  const [items, setItems] = useState<Report[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ week_of: isoMonday(), title: "", notes: "" });
  const [file, setFile] = useState<File | null>(null);

  const inboundEmail = `swpppp@notify.www.schrex.com`;

  const load = async () => {
    const { data } = await supabase
      .from("swpppp_reports")
      .select("id,week_of,report_date,title,email_subject,email_from,notes,file_path,file_name,source,uploaded_by_name,created_at")
      .eq("job_id", jobId)
      .order("week_of", { ascending: false })
      .order("created_at", { ascending: false });
    setItems((data as Report[]) ?? []);
  };

  useEffect(() => { load(); }, [jobId]);

  const reset = () => { setForm({ week_of: isoMonday(), title: "", notes: "" }); setFile(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      let file_path: string | null = null;
      let file_name: string | null = null;
      let file_size: number | null = null;
      let mime_type: string | null = null;
      if (file) {
        const path = `${jobId}/${form.week_of}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("swpppp-reports")
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        file_path = path; file_name = file.name; file_size = file.size; mime_type = file.type;
      }
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
      const { error } = await supabase.from("swpppp_reports").insert({
        job_id: jobId,
        week_of: form.week_of,
        report_date: form.week_of,
        title: form.title.trim() || null,
        notes: form.notes.trim() || null,
        file_path, file_name, file_size, mime_type,
        source: "upload",
        uploaded_by: user.id,
        uploaded_by_name: (prof as any)?.display_name ?? null,
      });
      if (error) throw error;
      toast.success("SWPPP report added");
      reset();
      setOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to add");
    } finally {
      setBusy(false);
    }
  };

  const view = async (s: Report) => {
    if (!s.file_path) return;
    const { data, error } = await supabase.storage.from("swpppp-reports").createSignedUrl(s.file_path, 60 * 10);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (s: Report) => {
    if (!canEdit) return;
    if (!confirm(`Delete this SWPPP report for week of ${s.week_of}?`)) return;
    if (s.file_path) await supabase.storage.from("swpppp-reports").remove([s.file_path]);
    const { error } = await supabase.from("swpppp_reports").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    await load();
  };

  const copyEmailHelp = async () => {
    const subj = jobNumber ? `Job ${jobNumber} - SWPPP weekly report` : `SWPPP weekly report`;
    await navigator.clipboard.writeText(`To: ${inboundEmail}\nSubject: ${subj}`);
    toast.success("Copied — paste into your forward");
  };

  const quickUpload = async (files: File[]) => {
    if (!user || !files.length) return;
    setBusy(true);
    try {
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
      const uploaderName = (prof as any)?.display_name ?? null;
      const week = isoMonday();
      for (const f of files) {
        const path = `${jobId}/${week}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage
          .from("swpppp-reports")
          .upload(path, f, { contentType: f.type });
        if (upErr) throw upErr;
        const { error } = await supabase.from("swpppp_reports").insert({
          job_id: jobId,
          week_of: week,
          report_date: week,
          file_path: path, file_name: f.name, file_size: f.size, mime_type: f.type,
          source: "upload",
          uploaded_by: user.id,
          uploaded_by_name: uploaderName,
        });
        if (error) throw error;
      }
      toast.success(`${files.length} report${files.length > 1 ? "s" : ""} added`);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FileDropZone
      accept="application/pdf,image/*"
      disabled={!canEdit || busy}
      onFiles={quickUpload}
      label="Drop SWPPP reports"
    >
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-1.5">
          <Cloud className="h-3 w-3" /> SWPPP reports
        </h2>
        {canEdit && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>New SWPPP report</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <Label htmlFor="sw_week">Week of *</Label>
                  <Input id="sw_week" type="date" required value={form.week_of} onChange={(e) => setForm({ ...form, week_of: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="sw_title">Title</Label>
                  <Input id="sw_title" placeholder="Optional" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="sw_file">File (PDF)</Label>
                  <Input id="sw_file" type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>
                <div>
                  <Label htmlFor="sw_notes">Notes</Label>
                  <Textarea id="sw_notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Saving…" : "Save report"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No SWPPP reports yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((s) => (
            <li key={s.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">Week of {new Date(s.week_of).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                    {s.source === "email" && (
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                        <Mail className="mr-0.5 inline h-2.5 w-2.5" />Email
                      </span>
                    )}
                  </div>
                  {s.title && <p className="text-xs text-muted-foreground">{s.title}</p>}
                  {s.email_subject && <p className="mt-0.5 text-[11px] text-muted-foreground italic truncate">"{s.email_subject}"{s.email_from && ` — ${s.email_from}`}</p>}
                  {s.file_name && (
                    <button onClick={() => view(s)} className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline">
                      <Download className="h-3 w-3" /> {s.file_name}
                    </button>
                  )}
                  {s.notes && <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{s.notes}</p>}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Added {new Date(s.created_at).toLocaleDateString()}{s.uploaded_by_name && ` by ${s.uploaded_by_name}`}
                  </p>
                </div>
                {canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => remove(s)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
