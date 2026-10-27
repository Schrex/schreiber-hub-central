import { independentLaunch } from "@/lib/launchScope";
import { errorMessage } from "@/lib/errorMessage";
import { useEffect, useState } from "react";
import { ClipboardList, Pencil, Save, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useDelayedProgress } from "@/hooks/useDelayedProgress";
import { ForemanBriefView } from "./ForemanBriefView";
import { toast } from "sonner";

interface Props {
  jobId: string;
}

export const ForemanBriefSection = ({ jobId }: Props) => {
  const { can } = useAccess();
  const canEdit = can("job.brief.edit");

  const [brief, setBrief] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasContract, setHasContract] = useState(false);
  const progress = useDelayedProgress();
  useEffect(() => { if (generating) progress.start(); else progress.stop(); }, [generating]);

  const load = async () => {
    const { data } = await supabase
      .from("jobs")
      .select("foreman_brief, contract_file_path")
      .eq("id", jobId)
      .maybeSingle();
    const row = data as { foreman_brief: string | null; contract_file_path: string | null } | null;
    const value = row?.foreman_brief ?? "";
    setBrief(value);
    setDraft(value);
    setHasContract(!!row?.contract_file_path);
  };

  useEffect(() => { load(); }, [jobId]);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ foreman_brief: draft })
        .eq("id", jobId);
      if (error) throw error;
      setBrief(draft);
      setEditing(false);
      toast.success("Foreman briefing saved");
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    if (independentLaunch) return;
    if (brief && !confirm("Replace the existing briefing with one generated from the contract?")) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-foreman-brief", {
        body: { jobId, save: true },
      });
      if (error) throw error;
      const next = (data as { brief?: string })?.brief ?? "";
      setBrief(next);
      setDraft(next);
      setEditing(false);
      toast.success("Briefing generated from contract");
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Generation failed"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5" />
          Foreman Briefing
        </h2>
        {canEdit && !editing && (
          <div className="flex items-center gap-1.5">
            {hasContract && !independentLaunch && (
              <button
                type="button"
                onClick={generate}
                disabled={generating}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:border-primary/40 disabled:opacity-50"
                title="Pull relevant pieces from the uploaded contract"
              >
                <Sparkles className="h-3 w-3" />
                {generating ? "Generating…" : brief ? "Regenerate" : "Generate from contract"}
              </button>
            )}
            <button
              type="button"
              onClick={() => { setDraft(brief); setEditing(true); }}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:border-primary/40"
            >
              <Pencil className="h-3 w-3" />
              {brief ? "Edit" : "Add"}
            </button>
          </div>
        )}
      </div>

      {generating && progress.show && (
        <Progress value={progress.value} className="h-1" />
      )}

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Key requirements, special instructions, deadlines, GC contacts, site rules — the contract bits the foreman actually needs."
            className="min-h-32 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setDraft(brief); setEditing(false); }}
              disabled={saving}
            >
              <X className="mr-1 h-3.5 w-3.5" /> Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              <Save className="mr-1 h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : brief ? (
        <ForemanBriefView markdown={brief} />
      ) : (
        <p className="text-xs text-muted-foreground">
          {canEdit
            ? hasContract
              ? "No briefing yet. Click \"Generate from contract\" to pull the relevant pieces automatically."
              : "Upload a contract to auto-generate a briefing, or add one manually."
            : "No briefing posted yet."}
        </p>
      )}
    </section>
  );
};
