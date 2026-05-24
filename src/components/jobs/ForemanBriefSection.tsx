import { useEffect, useState } from "react";
import { ClipboardList, Pencil, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Props {
  jobId: string;
}

export const ForemanBriefSection = ({ jobId }: Props) => {
  const { role, effectiveRole } = useAuth();
  const r = effectiveRole ?? role;
  const canEdit = r === "office" || r === "admin";

  const [brief, setBrief] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("jobs")
      .select("foreman_brief")
      .eq("id", jobId)
      .maybeSingle();
    const value = ((data as { foreman_brief: string | null } | null)?.foreman_brief) ?? "";
    setBrief(value);
    setDraft(value);
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
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5" />
          Foreman Briefing
        </h2>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => { setDraft(brief); setEditing(true); }}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:border-primary/40"
          >
            <Pencil className="h-3 w-3" />
            {brief ? "Edit" : "Add"}
          </button>
        )}
      </div>

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
        <p className="whitespace-pre-wrap text-sm text-foreground">{brief}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {canEdit
            ? "No briefing yet. Add the relevant pieces of the contract for the foreman."
            : "No briefing posted yet."}
        </p>
      )}
    </section>
  );
};
