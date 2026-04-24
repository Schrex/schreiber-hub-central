import { useEffect, useMemo, useState } from "react";
import { Camera, Trash2, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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

export const PhotosSection = ({ jobId }: { jobId: string }) => {
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

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;

    setUploading(true);
    setUploadPct(0);
    const today = new Date().toISOString().slice(0, 10);
    let done = 0;
    try {
      for (const file of files) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${jobId}/${today}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("job-photos")
          .upload(path, file, {
            contentType: file.type || "image/jpeg",
            upsert: false,
          });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("job_photos").insert({
          job_id: jobId,
          file_path: path,
          mime_type: file.type,
          file_size: file.size,
          taken_on: today,
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
              capture="environment"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              disabled={uploading}
              onChange={(e) => void handleFiles(e)}
            />
            {uploading ? (
              uploadPct > 0 ? `${uploadPct}%` : "…"
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" /> Add
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
            {canManage ? "No photos yet. Tap Add to upload." : "No photos yet."}
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
  );
};
