import { useEffect, useState } from "react";
import { HardHat, Check, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/access";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  jobId: string;
  foremanId: string | null;
  onChange?: (newId: string | null) => void;
}

interface ForemanOption {
  user_id: string;
  display_name: string | null;
}

export const ForemanPicker = ({ jobId, foremanId, onChange }: Props) => {
  const { can } = useAccess();
  const canEdit = can("jobs.edit");
  const [foremen, setForemen] = useState<ForemanOption[]>([]);
  const [current, setCurrent] = useState<string | null>(foremanId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCurrent(foremanId);
  }, [foremanId]);

  useEffect(() => {
    (async () => {
      // Anyone with a foreman, office, or admin role can be a job foreman
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["foreman", "office", "admin"]);
      const ids = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
      if (!ids.length) {
        setForemen([]);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids)
        .eq("is_active", true);
      const list = ((profs ?? []) as ForemanOption[]).sort((a, b) =>
        (a.display_name ?? "").localeCompare(b.display_name ?? ""),
      );
      setForemen(list);
    })();
  }, []);

  const updateForeman = async (newValue: string) => {
    const newId = newValue === "__none__" ? null : newValue;
    setSaving(true);
    const { error } = await supabase
      .from("jobs")
      .update({ foreman_id: newId })
      .eq("id", jobId);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save foreman", description: error.message, variant: "destructive" });
      return;
    }
    setCurrent(newId);
    onChange?.(newId);
    toast({ title: "Foreman updated" });
  };

  const currentName =
    foremen.find((f) => f.user_id === current)?.display_name ?? null;

  if (!canEdit) {
    // Read-only display for foreman
    if (!current) return null;
    return (
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <HardHat className="h-3.5 w-3.5" /> Foreman
        </span>
        <span className="text-right truncate font-medium">
          {currentName ?? "Assigned"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <HardHat className="h-3.5 w-3.5" /> Foreman
      </span>
      <Select
        value={current ?? "__none__"}
        onValueChange={updateForeman}
        disabled={saving}
      >
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— Unassigned —</SelectItem>
          {foremen.map((f) => (
            <SelectItem key={f.user_id} value={f.user_id}>
              {f.display_name ?? "Unnamed"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
