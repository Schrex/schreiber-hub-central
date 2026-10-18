import { errorMessage } from "@/lib/errorMessage";
import { useEffect, useRef, useState } from "react";
import { FileUp, FileText, Trash2, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileDropZone } from "@/components/ui/FileDropZone";

interface Estimate {
  id: string;
  title: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  notes: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

const fmtBytes = (b: number | null) => {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

export const EstimateUploads = ({ jobId }: { jobId: string }) => {
  const [items, setItems] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("job_estimates")
      .select("*").eq("job_id", jobId).order("created_at", { ascending: false });
    setItems((data ?? []) as Estimate[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: roles } = await supabase.from("user_roles")
        .select("role").eq("user_id", user.id);
      const r = (roles ?? []).map((x) => x.role);
      setCanEdit(r.includes("admin") || r.includes("office"));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uploaderName = user?.user_metadata?.display_name || user?.email || null;
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "pdf";
        const path = `${jobId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("job-estimates").upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("job_estimates").insert({
          job_id: jobId,
          title: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: user?.id ?? null,
          uploaded_by_name: uploaderName,
        });
        if (insErr) throw insErr;
      }
      toast.success("Estimate uploaded");
      load();
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Upload failed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const open = async (path: string) => {
    const { data, error } = await supabase.storage.from("job-estimates").createSignedUrl(path, 60 * 10);
    if (error || !data) { toast.error("Could not open file"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (item: Estimate) => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    const { error } = await supabase.from("job_estimates").delete().eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    await supabase.storage.from("job-estimates").remove([item.file_path]);
    toast.success("Deleted");
    load();
  };

  return (
    <FileDropZone
      accept="application/pdf,.pdf"
      disabled={!canEdit || uploading}
      onFiles={(fs) => {
        const dt = new DataTransfer();
        fs.forEach((f) => dt.items.add(f));
        handleFiles(dt.files);
      }}
      label="Drop PDFs to upload"
      className="rounded-2xl"
    >
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2">
        <FileUp size={15} className="text-stone-700" />
        <h3 className="font-black text-stone-900 text-sm tracking-tight uppercase">Estimate Files</h3>
        {canEdit && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-stone-900 text-white text-[11px] font-bold px-2.5 py-1.5 hover:bg-stone-800 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <FileUp size={12} />}
            {uploading ? "Uploading…" : "Upload"}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      <div className="px-4 py-3">
        {loading ? (
          <div className="text-center text-stone-400 text-[12px] py-4">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-center text-stone-400 text-[12px] py-4">
            {canEdit ? "No estimate files yet. Upload a PDF to attach it to this job." : "No estimate files uploaded."}
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {items.map((it) => (
              <li key={it.id} className="py-2 flex items-center gap-3">
                <FileText size={18} className="text-red-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-stone-900 truncate">{it.title}</div>
                  <div className="text-[10px] text-stone-500">
                    {fmtBytes(it.file_size)}
                    {it.uploaded_by_name ? ` · ${it.uploaded_by_name}` : ""}
                    {" · "}
                    {new Date(it.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button onClick={() => open(it.file_path)} className="p-1.5 hover:bg-stone-100 rounded" aria-label="Open">
                  <Download size={15} className="text-stone-700" />
                </button>
                {canEdit && (
                  <button onClick={() => remove(it)} className="p-1.5 hover:bg-red-50 rounded" aria-label="Delete">
                    <Trash2 size={15} className="text-red-600" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
    </FileDropZone>
  );
};
