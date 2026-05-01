import { useEffect, useState } from "react";
import { FileText, Upload, Download, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Upload as TusUpload } from "tus-js-client/lib.esm/browser/index.js";

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
    const upload = new TusUpload(file, {
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
  const { role: realRole, effectiveRole, displayName } = useAuth();
  const role = effectiveRole ?? realRole;
  const canManage = role === "office" || role === "admin";
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingCat, setUploadingCat] = useState<Category | null>(null);
  const [uploadPct, setUploadPct] = useState<number>(0);

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

  const handleFile = async (cat: Category, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

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

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <ul className="divide-y divide-border">
          {CATEGORIES.map(({ key, label }) => {
            const catPlans = plans
              .filter((p) => p.category === key)
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            const current = catPlans.find((p) => p.is_current) ?? catPlans[0];
            const total = catPlans.length;
            const history = catPlans.filter((p) => p.id !== current?.id);
            const fmtDate = (d: string) =>
              new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
            const revLabel = (p: Plan) => {
              if (p.version) return `Rev ${p.version}`;
              const idx = catPlans.findIndex((x) => x.id === p.id);
              return `Rev ${total - idx}`;
            };
            return (
              <li key={key} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{label}</p>
                    {current ? (
                      <button
                        type="button"
                        onClick={() => openPlan(current.file_path)}
                        className="mt-0.5 flex items-center gap-1.5 text-left text-xs text-primary hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span>Open</span>
                        <span className="text-muted-foreground">
                          · {revLabel(current)} · {fmtDate(current.created_at)}
                        </span>
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
                                <span className="truncate">
                                  {revLabel(h)} · {fmtDate(h.created_at)}
                                </span>
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
                      <label
                        className={cn(
                          buttonVariants({ size: "sm", variant: "outline" }),
                          "relative h-8 cursor-pointer overflow-hidden",
                          uploadingCat === key && "pointer-events-none opacity-50",
                        )}
                        aria-disabled={uploadingCat === key}
                      >
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          disabled={uploadingCat === key}
                          onChange={(e) => void handleFile(key, e)}
                        />
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
                      </label>
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
