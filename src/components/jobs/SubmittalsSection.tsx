import { useEffect, useState } from "react";
import { FileText, Plus, Trash2, Download, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileDropZone } from "@/components/ui/FileDropZone";

type Status = "pending" | "submitted" | "under_review" | "approved" | "revise_resubmit" | "rejected";

interface Submittal {
  id: string;
  title: string;
  status: Status;
  category: string | null;
  ai_categorized: boolean;
  file_path: string | null;
  file_name: string | null;
  notes: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

const SUBMITTAL_CATEGORIES = [
  "Concrete", "Rebar / Reinforcing Steel", "Asphalt", "Aggregate / Stone",
  "Pipe", "Precast Structures", "Castings (Frames & Grates)",
  "Erosion Control", "Geotextile", "Pavement Markings", "Signage",
  "Guide Rail", "Electrical", "Landscaping", "Other",
];

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  revise_resubmit: "Revise & resubmit",
  rejected: "Rejected",
};

const STATUS_CLASS: Record<Status, string> = {
  pending: "bg-muted text-muted-foreground",
  submitted: "bg-primary/15 text-primary",
  under_review: "bg-accent/15 text-accent-foreground",
  approved: "bg-emerald-500/15 text-emerald-600",
  revise_resubmit: "bg-amber-500/15 text-amber-600",
  rejected: "bg-destructive/15 text-destructive",
};

export const SubmittalsSection = ({ jobId }: { jobId: string }) => {
  const { user, role, effectiveRole } = useAuth();
  const r = effectiveRole ?? role;
  const canView = r === "foreman" || r === "office" || r === "admin";
  const canEdit = r === "office" || r === "admin";

  const [items, setItems] = useState<Submittal[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", status: "pending" as Status, notes: "", category: "" });
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("job_submittals")
      .select("id,title,status,category,ai_categorized,file_path,file_name,notes,submitted_at,approved_at,uploaded_by_name,created_at")
      .eq("job_id", jobId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    setItems((data as Submittal[]) ?? []);
  };

  useEffect(() => { if (canView) load(); }, [jobId, canView]);

  if (!canView) return null;

  const reset = () => { setForm({ title: "", status: "pending", notes: "", category: "" }); setFile(null); };

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
        const path = `${jobId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("job-submittals")
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        file_path = path; file_name = file.name; file_size = file.size; mime_type = file.type;
      }
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
      const { error } = await supabase.from("job_submittals").insert({
        job_id: jobId,
        title: form.title.trim(),
        status: form.status,
        category: form.category || null,
        notes: form.notes.trim() || null,
        file_path, file_name, file_size, mime_type,
        uploaded_by: user.id,
        uploaded_by_name: (prof as any)?.display_name ?? null,
      });
      if (error) throw error;
      toast.success("Submittal added");
      reset();
      setOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to add");
    } finally {
      setBusy(false);
    }
  };

  const view = async (s: Submittal) => {
    if (!s.file_path) return;
    const { data, error } = await supabase.storage.from("job-submittals").createSignedUrl(s.file_path, 60 * 10);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const updateStatus = async (id: string, status: Status) => {
    const patch: any = { status };
    if (status === "submitted") patch.submitted_at = new Date().toISOString().slice(0, 10);
    if (status === "approved") patch.approved_at = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("job_submittals").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await load();
  };

  const remove = async (s: Submittal) => {
    if (!confirm(`Delete "${s.title}"?`)) return;
    if (s.file_path) await supabase.storage.from("job-submittals").remove([s.file_path]);
    const { error } = await supabase.from("job_submittals").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    await load();
  };

  const quickUpload = async (files: File[]) => {
    if (!user || !files.length) return;
    setBusy(true);
    const t = toast.loading(`Uploading ${files.length} file${files.length > 1 ? "s" : ""}…`);
    try {
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
      const uploaderName = (prof as any)?.display_name ?? null;
      let aiHits = 0;
      for (const f of files) {
        const path = `${jobId}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage
          .from("job-submittals")
          .upload(path, f, { contentType: f.type });
        if (upErr) throw upErr;

        // Ask AI to title + categorize. Fall back to filename on failure.
        let title = f.name.replace(/\.[^.]+$/, "");
        let category: string | null = null;
        let aiCategorized = false;
        try {
          const { data: ai } = await supabase.functions.invoke("categorize-document", {
            body: { kind: "submittal", bucket: "job-submittals", path, fileName: f.name },
          });
          const fields = (ai as any)?.fields;
          if (fields && (fields.confidence ?? 0) >= 0.55) {
            if (fields.title) title = String(fields.title);
            if (fields.category) category = String(fields.category);
            aiCategorized = true;
            aiHits++;
          }
        } catch (e) {
          console.warn("AI categorize failed", e);
        }

        const { error } = await supabase.from("job_submittals").insert({
          job_id: jobId,
          title,
          category,
          ai_categorized: aiCategorized,
          status: "pending",
          file_path: path, file_name: f.name, file_size: f.size, mime_type: f.type,
          uploaded_by: user.id, uploaded_by_name: uploaderName,
        });
        if (error) throw error;
      }
      toast.success(
        aiHits
          ? `${files.length} added — ${aiHits} auto-categorized ✨`
          : `${files.length} submittal${files.length > 1 ? "s" : ""} added`,
        { id: t },
      );
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed", { id: t });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FileDropZone
      disabled={!canEdit || busy}
      onFiles={quickUpload}
      label="Drop files to add submittals"
    >
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Submittals
        </h2>
        {canEdit && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>New submittal</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <Label htmlFor="s_title">Title *</Label>
                  <Input id="s_title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
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
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
                    <SelectContent>
                      {SUBMITTAL_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="s_file">File</Label>
                  <Input id="s_file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>
                <div>
                  <Label htmlFor="s_notes">Notes</Label>
                  <Textarea id="s_notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <Button type="submit" className="w-full" disabled={busy || !form.title.trim()}>
                  {busy ? "Saving…" : (file ? <><Upload className="mr-1 h-4 w-4" /> Upload & save</> : "Save")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No submittals yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((s) => (
            <li key={s.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="truncate text-sm font-medium">{s.title}</p>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider ${STATUS_CLASS[s.status]}`}>
                      {STATUS_LABEL[s.status]}
                    </span>
                    {s.category && (
                      <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider text-accent-foreground">
                        {s.ai_categorized && "✨ "}{s.category}
                      </span>
                    )}
                  </div>
                  {s.file_name && (
                    <button onClick={() => view(s)} className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline">
                      <FileText className="h-3 w-3" /> {s.file_name}
                    </button>
                  )}
                  {s.notes && <p className="mt-1 text-xs text-muted-foreground">{s.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {s.file_path && (
                    <Button size="sm" variant="ghost" onClick={() => view(s)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  {canEdit && (
                    <Button size="sm" variant="ghost" onClick={() => remove(s)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {canEdit && (
                <div className="mt-2">
                  <Select value={s.status} onValueChange={(v) => updateStatus(s.id, v as Status)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABEL) as Status[]).map((st) => (
                        <SelectItem key={st} value={st}>{STATUS_LABEL[st]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
    </FileDropZone>
  );
};
