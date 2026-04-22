import { useEffect, useRef, useState } from "react";
import { FileText, Upload, Download, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as tus from "tus-js-client";

const SUPABASE_URL = "https://bitogpfplcquovpdjprk.supabase.co";
const RESUMABLE_THRESHOLD = 6 * 1024 * 1024; // 6MB

const resumableUpload = async (
  bucket: string,
  path: string,
  file: File,
  onProgress: (pct: number) => void,
) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: {
        authorization: `Bearer ${token}`,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024,
      onError: (err) => reject(err),
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
    });
    upload.start();
  });
};

type Category =
  | "civil"
  | "structural"
  | "plumbing"
  | "electrical"
  | "architectural"
  | "gps_model"
  | "surface"
  | "linework";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "civil", label: "Civil" },
  { key: "structural", label: "Structural" },
  { key: "plumbing", label: "Plumbing" },
  { key: "electrical", label: "Electrical" },
  { key: "architectural", label: "Architectural" },
  { key: "gps_model", label: "GPS Model" },
  { key: "surface", label: "Surface" },
  { key: "linework", label: "Linework" },
];

interface Plan {
  id: string;
  category: Category;
  title: string;
  version: string | null;
  file_path: string;
  mime_type: string | null;
  is_current: boolean;
  uploaded_by_name: string | null;
  created_at: string;
}

export const PlansSection = ({ jobId }: { jobId: string }) => {
  const { role, displayName } = useAuth();
  const canManage = role === "foreman" || role === "office" || role === "admin";
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingCat, setUploadingCat] = useState<Category | null>(null);
  const [uploadPct, setUploadPct] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingCatRef = useRef<Category | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("job_plans")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });
    setPlans((data ?? []) as Plan[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const triggerUpload = (cat: Category) => {
    pendingCatRef.current = cat;
    fileInputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const cat = pendingCatRef.current;
    e.target.value = "";
    if (!file || !cat) return;

    setUploadingCat(cat);
    setUploadPct(0);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${jobId}/${cat}/${Date.now()}.${ext}`;
      console.log("[PlansSection] uploading", { path, size: file.size, type: file.type });

      if (file.size > RESUMABLE_THRESHOLD) {
        await resumableUpload("job-plans", path, file, (pct) => setUploadPct(pct));
      } else {
        const { error: upErr } = await supabase.storage
          .from("job-plans")
          .upload(path, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (upErr) {
          console.error("[PlansSection] storage upload error", upErr);
          throw upErr;
        }
      }

      // Mark previous current as superseded
      await supabase
        .from("job_plans")
        .update({ is_current: false })
        .eq("job_id", jobId)
        .eq("category", cat)
        .eq("is_current", true);

      const { error: insErr } = await supabase.from("job_plans").insert({
        job_id: jobId,
        category: cat,
        title: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
        is_current: true,
        uploaded_by_name: displayName,
      });
      if (insErr) throw insErr;
      toast.success("Plan uploaded");
      await load();
    } catch (err) {
      console.error("Plan upload failed", err);
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingCat(null);
      setUploadPct(0);
      pendingCatRef.current = null;
    }
  };

  const openPlan = async (path: string) => {
    const { data, error } = await supabase.storage.from("job-plans").createSignedUrl(path, 300);
    if (error || !data) {
      toast.error("Could not open file");
      return;
    }
    window.open(data.signedUrl, "_blank", "noreferrer");
  };

  const removePlan = async (plan: Plan) => {
    if (!confirm(`Delete "${plan.title}"?`)) return;
    await supabase.storage.from("job-plans").remove([plan.file_path]);
    await supabase.from("job_plans").delete().eq("id", plan.id);
    toast.success("Plan deleted");
    load();
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Plans
        </h2>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={handleFile}
      />

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <ul className="divide-y divide-border">
          {CATEGORIES.map(({ key, label }) => {
            const current = plans.find((p) => p.category === key && p.is_current);
            const history = plans.filter((p) => p.category === key && !p.is_current);
            return (
              <li key={key} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{label}</p>
                    {current ? (
                      <button
                        type="button"
                        onClick={() => openPlan(current.file_path)}
                        className="mt-0.5 flex w-full items-center gap-1.5 truncate text-left text-xs text-primary hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{current.title}</span>
                        {current.version && (
                          <span className="text-muted-foreground">· {current.version}</span>
                        )}
                      </button>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted-foreground">No current plan</p>
                    )}
                    {history.length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-muted-foreground">
                          {history.length} previous
                        </summary>
                        <ul className="mt-1 space-y-1 pl-2">
                          {history.map((h) => (
                            <li key={h.id} className="flex items-center gap-2 text-xs">
                              <button
                                type="button"
                                onClick={() => openPlan(h.file_path)}
                                className="flex flex-1 items-center gap-1 truncate text-muted-foreground hover:text-foreground"
                              >
                                <Download className="h-3 w-3 shrink-0" />
                                <span className="truncate">{h.title}</span>
                              </button>
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => removePlan(h)}
                                  className="text-muted-foreground hover:text-destructive"
                                  aria-label="Delete"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      {current && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => removePlan(current)}
                          aria-label="Delete current"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={uploadingCat === key}
                        onClick={() => triggerUpload(key)}
                      >
                        {uploadingCat === key ? (
                          uploadPct > 0 ? `${uploadPct}%` : "…"
                        ) : current ? (
                          <>
                            <Upload className="h-3.5 w-3.5" /> Update
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" /> Add
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
