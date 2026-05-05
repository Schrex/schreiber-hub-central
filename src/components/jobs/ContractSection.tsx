import { useEffect, useState } from "react";
import { FileText, Upload, Trash2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { resumableUpload } from "@/lib/resumableUpload";
import { FileDropZone } from "@/components/ui/FileDropZone";

interface Props {
  jobId: string;
}

interface ContractMeta {
  contract_file_path: string | null;
  contract_file_name: string | null;
  contract_uploaded_at: string | null;
}

export const ContractSection = ({ jobId }: Props) => {
  const { user, role, effectiveRole } = useAuth();
  const r = effectiveRole ?? role;
  const canEdit = r === "office" || r === "admin";
  const [meta, setMeta] = useState<ContractMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const load = async () => {
    const { data } = await supabase
      .from("jobs")
      .select("contract_file_path, contract_file_name, contract_uploaded_at")
      .eq("id", jobId)
      .maybeSingle();
    setMeta((data as ContractMeta) ?? null);
  };

  useEffect(() => { load(); }, [jobId]);

  const uploadFile = async (file: File) => {
    if (!user) return;
    setBusy(true);
    setProgress(0);
    try {
      if (meta?.contract_file_path) {
        await supabase.storage.from("job-contracts").remove([meta.contract_file_path]);
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${jobId}/${Date.now()}-${safeName}`;
      await resumableUpload({
        bucket: "job-contracts",
        path,
        file,
        contentType: file.type || "application/pdf",
        onProgress: setProgress,
      });
      const { error: updErr } = await supabase
        .from("jobs")
        .update({
          contract_file_path: path,
          contract_file_name: file.name,
          contract_uploaded_at: new Date().toISOString(),
          contract_uploaded_by: user.id,
        })
        .eq("id", jobId);
      if (updErr) throw updErr;
      toast.success("Contract uploaded");
      await load();
    } catch (err: any) {
      console.error("Contract upload failed", err);
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    e.target.value = "";
  };

  const onView = async () => {
    if (!meta?.contract_file_path) return;
    const { data, error } = await supabase.storage
      .from("job-contracts")
      .createSignedUrl(meta.contract_file_path, 60 * 10);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const onDelete = async () => {
    if (!meta?.contract_file_path) return;
    if (!confirm("Remove the current contract?")) return;
    setBusy(true);
    try {
      await supabase.storage.from("job-contracts").remove([meta.contract_file_path]);
      await supabase.from("jobs").update({
        contract_file_path: null,
        contract_file_name: null,
        contract_uploaded_at: null,
        contract_uploaded_by: null,
      }).eq("id", jobId);
      toast.success("Contract removed");
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Contract
        </h2>
        {canEdit && (
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,image/*"
              onChange={onUpload}
              disabled={busy}
            />
            <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:border-primary/40">
              <Upload className="h-3 w-3" />
              {busy
                ? `Uploading ${progress}%`
                : meta?.contract_file_path ? "Replace" : "Upload"}
            </span>
          </label>
        )}
      </div>

      {busy && (
        <div className="space-y-1">
          <Progress value={progress || undefined} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground">
            {progress > 0 ? `Uploading ${progress}%` : "Preparing upload…"}
          </p>
        </div>
      )}

      {meta?.contract_file_path ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background p-3">
          <button
            onClick={onView}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm">{meta.contract_file_name}</p>
              {meta.contract_uploaded_at && (
                <p className="text-[10px] text-muted-foreground">
                  Uploaded {new Date(meta.contract_uploaded_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </button>
          <Button size="sm" variant="ghost" onClick={onView}>
            <Download className="h-4 w-4" />
          </Button>
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={onDelete} disabled={busy}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No contract uploaded.</p>
      )}
    </section>
  );
};
