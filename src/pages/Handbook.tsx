import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Download, Trash2, Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useAccess } from "@/lib/access";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type HandbookDoc = {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
  file_size: number | null;
  version: string | null;
  is_current: boolean;
  uploaded_by_name: string | null;
  created_at: string;
};

const formatSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const Handbook = () => {
  const navigate = useNavigate();
  const { user, displayName } = useAuth();
  const { can } = useAccess();
  const { toast } = useToast();
  const canManage = can("handbook.manage");

  const [docs, setDocs] = useState<HandbookDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDocs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("handbook_documents")
      .select("*")
      .order("created_at", { ascending: false });
    setDocs((data as HandbookDoc[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const upload = async () => {
    if (!file || !title.trim()) {
      toast({ title: "Title and PDF file required", variant: "destructive" });
      return;
    }
    if (file.type !== "application/pdf") {
      toast({ title: "Only PDF files are allowed", variant: "destructive" });
      return;
    }
    setUploading(true);
    const ext = "pdf";
    const filePath = `${Date.now()}-${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${ext}`;

    const { error: upErr } = await supabase.storage.from("handbook").upload(filePath, file, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (upErr) {
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { error: insErr } = await supabase.from("handbook_documents").insert({
      title: title.trim(),
      description: description.trim() || null,
      version: version.trim() || null,
      file_path: filePath,
      file_size: file.size,
      uploaded_by: user?.id ?? null,
      uploaded_by_name: displayName ?? null,
    });

    if (insErr) {
      await supabase.storage.from("handbook").remove([filePath]);
      toast({ title: "Save failed", description: insErr.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    toast({ title: "Handbook uploaded" });
    setUploadOpen(false);
    setTitle("");
    setDescription("");
    setVersion("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setUploading(false);
    fetchDocs();
  };

  const view = async (doc: HandbookDoc) => {
    const { data, error } = await supabase.storage
      .from("handbook")
      .createSignedUrl(doc.file_path, 600);
    if (error || !data) {
      toast({ title: "Could not open file", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const remove = async (doc: HandbookDoc) => {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    await supabase.storage.from("handbook").remove([doc.file_path]);
    const { error } = await supabase.from("handbook_documents").delete().eq("id", doc.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    fetchDocs();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/tools")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-lg font-semibold">Employee Handbook</h1>
            <p className="text-xs text-muted-foreground">Company policies & procedures</p>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="mr-1 h-4 w-4" /> Upload
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 px-4 py-5">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        ) : docs.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-10 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-semibold">No handbook yet</p>
              <p className="text-sm text-muted-foreground">
                {canManage
                  ? "Upload the employee handbook PDF to share it with the team."
                  : "Check back soon — your handbook will be posted here."}
              </p>
            </div>
            {canManage && (
              <Button onClick={() => setUploadOpen(true)}>
                <Upload className="mr-1 h-4 w-4" /> Upload Handbook
              </Button>
            )}
          </Card>
        ) : (
          docs.map((d) => (
            <Card key={d.id} className="flex items-start gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{d.title}</span>
                  {d.version && <Badge variant="secondary">v{d.version}</Badge>}
                </div>
                {d.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Uploaded {format(new Date(d.created_at), "MMM d, yyyy")}
                  {d.uploaded_by_name && ` by ${d.uploaded_by_name}`}
                  {d.file_size && ` · ${formatSize(d.file_size)}`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => view(d)}>
                    <Download className="mr-1 h-4 w-4" /> View / Download
                  </Button>
                  {canManage && (
                    <Button size="sm" variant="ghost" onClick={() => remove(d)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </main>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Handbook PDF</DialogTitle>
            <DialogDescription>PDF only. Visible to all employees.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="2026 Employee Handbook"
                maxLength={150}
              />
            </div>
            <div>
              <Label>Version (optional)</Label>
              <Input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="2026.1"
                maxLength={30}
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={500}
              />
            </div>
            <div>
              <Label>PDF File</Label>
              <Input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={upload} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Handbook;
