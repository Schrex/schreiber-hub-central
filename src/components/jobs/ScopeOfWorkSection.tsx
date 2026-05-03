import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ScopeItem {
  id: string;
  body: string;
  sort_order: number;
}

export const ScopeOfWorkSection = ({ jobId }: { jobId: string }) => {
  const { role, effectiveRole } = useAuth();
  const r = effectiveRole ?? role;
  const canEdit = r === "office" || r === "admin";
  const [items, setItems] = useState<ScopeItem[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("job_scope_items")
      .select("id, body, sort_order")
      .eq("job_id", jobId)
      .order("sort_order", { ascending: true });
    setItems((data as ScopeItem[]) ?? []);
  };

  useEffect(() => { load(); }, [jobId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const nextOrder = items.length ? items[items.length - 1].sort_order + 1 : 0;
      const { error } = await supabase
        .from("job_scope_items")
        .insert({ job_id: jobId, body: draft.trim(), sort_order: nextOrder });
      if (error) throw error;
      setDraft("");
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to add");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("job_scope_items").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await load();
  };

  return (
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
        Scope of work
      </h2>

      {items.length === 0 && !canEdit && (
        <p className="text-xs text-muted-foreground">No scope items yet.</p>
      )}

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="flex-1 whitespace-pre-wrap">{it.body}</span>
              {canEdit && (
                <button
                  onClick={() => remove(it.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={add} className="flex gap-2 pt-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add scope item…"
            disabled={busy}
          />
          <Button type="submit" size="sm" disabled={busy || !draft.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      )}
    </section>
  );
};
