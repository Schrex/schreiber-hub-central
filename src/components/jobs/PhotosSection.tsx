import { useEffect, useMemo, useState } from "react";
import { Camera, Trash2, X, Plus, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { Upload as TusUpload } from "tus-js-client/lib.esm/browser/index.js";
import exifr from "exifr";

const readExifDate = async (file: File): Promise<Date | null> => {
  if (!file.type.startsWith("image/")) return null;
  try {
    const tags = await exifr.parse(file, ["DateTimeOriginal", "CreateDate", "ModifyDate"]);
    const d = tags?.DateTimeOriginal || tags?.CreateDate || tags?.ModifyDate;
    if (d instanceof Date && !isNaN(d.getTime())) return d;
    if (typeof d === "string") {
      const parsed = new Date(d);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  } catch (err) {
    console.warn("EXIF read failed", err);
  }
  return null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const RESUMABLE_THRESHOLD = 6 * 1024 * 1024;

const toLocalDate = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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
        contentType: file.type || "image/jpeg",
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

interface Photo {
  id: string;
  job_id: string;
  file_path: string;
  mime_type: string | null;
  caption: string | null;
  taken_on: string;
  uploaded_by_name: string | null;
  created_at: string;
}

const fmtDay = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

interface StampInfo {
  jobLabel: string;
  address?: string | null;
  uploader?: string | null;
}

const stampImage = async (file: File, info: StampInfo, capturedAt: Date): Promise<File> => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  // Cap longest edge to 2400px to keep uploads sane
  const MAX = 2400;
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);

  const now = capturedAt;
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const base = Math.max(16, Math.round(Math.min(w, h) * 0.028));
  const small = Math.round(base * 0.62);
  const pad = Math.round(base * 0.7);
  const lineGap = Math.round(base * 0.35);

  const lines: { text: string; size: number; weight: string; color: string }[] = [
    { text: `${dateStr} · ${timeStr}`, size: base, weight: "800", color: "#FFD400" },
    { text: info.jobLabel, size: small, weight: "700", color: "#ffffff" },
  ];
  if (info.address) lines.push({ text: info.address, size: small, weight: "500", color: "#ffffff" });
  if (info.uploader) lines.push({ text: info.uploader, size: small, weight: "500", color: "#e5e7eb" });

  // Measure widest line
  ctx.textBaseline = "top";
  let maxLineW = 0;
  let totalH = 0;
  for (const ln of lines) {
    ctx.font = `${ln.weight} ${ln.size}px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;
    const m = ctx.measureText(ln.text);
    if (m.width > maxLineW) maxLineW = m.width;
    totalH += ln.size + lineGap;
  }
  totalH -= lineGap;

  const boxW = Math.min(w - pad * 2, maxLineW + pad * 1.4);
  const boxH = totalH + pad;
  const boxX = pad;
  const boxY = h - boxH - pad;

  // Translucent backdrop
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  const r = Math.round(base * 0.4);
  ctx.beginPath();
  ctx.moveTo(boxX + r, boxY);
  ctx.lineTo(boxX + boxW - r, boxY);
  ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r);
  ctx.lineTo(boxX + boxW, boxY + boxH - r);
  ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH);
  ctx.lineTo(boxX + r, boxY + boxH);
  ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
  ctx.lineTo(boxX, boxY + r);
  ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
  ctx.closePath();
  ctx.fill();

  // Yellow accent bar (timestamp camera vibe)
  ctx.fillStyle = "#FFD400";
  ctx.fillRect(boxX, boxY, Math.round(base * 0.18), boxH);

  // Text with subtle shadow
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = Math.round(base * 0.25);
  let cy = boxY + pad / 2;
  const tx = boxX + Math.round(base * 0.18) + pad * 0.6;
  for (const ln of lines) {
    ctx.font = `${ln.weight} ${ln.size}px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = ln.color;
    ctx.fillText(ln.text, tx, cy);
    cy += ln.size + lineGap;
  }
  ctx.shadowBlur = 0;

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
  );
  if (!blob) return file;
  const newName = file.name.replace(/\.[^.]+$/, "") + "-stamped.jpg";
  return new File([blob], newName, { type: "image/jpeg" });
};

interface PhotosSectionProps {
  jobId: string;
  jobLabel: string;
  address?: string | null;
}

export const PhotosSection = ({ jobId, jobLabel, address }: PhotosSectionProps) => {
  const { role, displayName } = useAuth();
  const canManage = role === "foreman" || role === "office" || role === "admin";
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [viewer, setViewer] = useState<Photo | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("job_photos")
      .select("*")
      .eq("job_id", jobId)
      .order("taken_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Load photos failed", error);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as Photo[];
    setPhotos(list);
    if (list.length) {
      const { data: signed } = await supabase.storage
        .from("job-photos")
        .createSignedUrls(list.map((p) => p.file_path), 3600);
      const map: Record<string, string> = {};
      (signed ?? []).forEach((s, i) => {
        if (s.signedUrl) map[list[i].file_path] = s.signedUrl;
      });
      setUrls(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    setUploadPct(0);
    let done = 0;
    try {
      for (const original of files) {
        const exifDate = await readExifDate(original);
        const captured = exifDate ?? new Date(original.lastModified || Date.now());
        const takenOn = toLocalDate(captured);
        const file = original.type.startsWith("image/")
          ? await stampImage(original, { jobLabel, address, uploader: displayName }, captured).catch((err) => {
              console.warn("Stamp failed, uploading original", err);
              return original;
            })
          : original;
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${jobId}/${takenOn}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        if (file.size > RESUMABLE_THRESHOLD) {
          await resumableUpload("job-photos", path, file, (pct) => setUploadPct(pct));
        } else {
          const { error: upErr } = await supabase.storage
            .from("job-photos")
            .upload(path, file, {
              contentType: file.type || "image/jpeg",
              upsert: false,
            });
          if (upErr) throw upErr;
        }
        const { error: insErr } = await supabase.from("job_photos").insert({
          job_id: jobId,
          file_path: path,
          mime_type: file.type,
          file_size: file.size,
          taken_on: takenOn,
          uploaded_by_name: displayName,
        });
        if (insErr) throw insErr;
        done += 1;
        setUploadPct(Math.round((done / files.length) * 100));
      }
      toast.success(`${files.length} photo${files.length > 1 ? "s" : ""} uploaded`);
      await load();
    } catch (err) {
      console.error("Photo upload failed", err);
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    await uploadFiles(files);
  };

  const removePhoto = async (p: Photo) => {
    if (!confirm("Delete this photo?")) return;
    await supabase.storage.from("job-photos").remove([p.file_path]);
    await supabase.from("job_photos").delete().eq("id", p.id);
    toast.success("Photo deleted");
    setViewer(null);
    load();
  };

  const grouped = useMemo(() => {
    const map = new Map<string, Photo[]>();
    for (const p of photos) {
      const arr = map.get(p.taken_on) ?? [];
      arr.push(p);
      map.set(p.taken_on, arr);
    }
    return Array.from(map.entries());
  }, [photos]);

  return (
    <FileDropZone
      accept="image/*"
      disabled={!canManage || uploading}
      onFiles={uploadFiles}
      label="Drop photos to upload"
    >
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Photos
        </h2>
        {canManage && (
          <label
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "relative h-8 cursor-pointer overflow-hidden",
              uploading && "pointer-events-none opacity-50",
            )}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              disabled={uploading}
              onChange={(e) => void handleFiles(e)}
            />
            {uploading ? (
              uploadPct > 0 ? `${uploadPct}%` : "…"
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" /> Upload
              </>
            )}
          </label>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center">
          <Camera className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {canManage ? "No photos yet. Tap Upload to add photos." : "No photos yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {fmtDay(day)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {items.length} photo{items.length > 1 ? "s" : ""}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {items.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setViewer(p)}
                    className="group relative aspect-square overflow-hidden rounded-md bg-muted"
                  >
                    {urls[p.file_path] ? (
                      <img
                        src={urls[p.file_path]}
                        alt={p.caption ?? "Job photo"}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full animate-pulse bg-muted" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!viewer} onOpenChange={(o) => !o && setViewer(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background">
          {viewer && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setViewer(null)}
                className="absolute right-2 top-2 z-10 rounded-full bg-background/80 p-1.5 backdrop-blur"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
              {urls[viewer.file_path] && (
                <img
                  src={urls[viewer.file_path]}
                  alt={viewer.caption ?? "Job photo"}
                  className="max-h-[80vh] w-full object-contain"
                />
              )}
              <div className="flex items-center justify-between gap-3 border-t border-border p-3 text-xs">
                <div className="min-w-0">
                  <p className="font-medium">{fmtDay(viewer.taken_on)}</p>
                  {viewer.uploaded_by_name && (
                    <p className="text-muted-foreground">by {viewer.uploaded_by_name}</p>
                  )}
                </div>
                {canManage && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removePhoto(viewer)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
    </FileDropZone>
  );
};
