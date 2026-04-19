import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Role } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface UserRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  is_active: boolean;
  role: Role | null;
}

const ROLES: Role[] = ["employee", "foreman", "office", "admin"];
const ROLE_RANK: Record<Role, number> = { admin: 1, office: 2, foreman: 3, employee: 4 };

const AdminUsers = () => {
  const { user: me } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, email, is_active").order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleByUser = new Map<string, Role>();
    (roles ?? []).forEach((r) => {
      const existing = roleByUser.get(r.user_id);
      const next = r.role as Role;
      if (!existing || ROLE_RANK[next] < ROLE_RANK[existing]) roleByUser.set(r.user_id, next);
    });
    setRows(
      (profiles ?? []).map((p) => ({
        user_id: p.user_id,
        display_name: p.display_name,
        email: p.email,
        is_active: p.is_active,
        role: roleByUser.get(p.user_id) ?? null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const changeRole = async (userId: string, newRole: Role) => {
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) return toast.error(delErr.message);
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (insErr) return toast.error(insErr.message);
    toast.success("Role updated");
    load();
  };

  const toggleActive = async (userId: string, value: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_active: value }).eq("user_id", userId);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.map((r) => (r.user_id === userId ? { ...r, is_active: value } : r)));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <h1 className="mt-4 font-display text-2xl uppercase tracking-wide">Manage Users</h1>
        <p className="text-sm text-muted-foreground">Assign roles and deactivate accounts.</p>

        <div className="mt-6 space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          )}
          {rows.map((r) => (
            <div
              key={r.user_id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {r.display_name ?? "—"} {me?.id === r.user_id && <span className="text-xs text-muted-foreground">(you)</span>}
                </p>
                <p className="text-xs text-muted-foreground truncate">{r.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <Select value={r.role ?? undefined} onValueChange={(v) => changeRole(r.user_id, v as Role)}>
                  <SelectTrigger className="w-32"><SelectValue placeholder="Role" /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={r.is_active}
                    onCheckedChange={(v) => toggleActive(r.user_id, v)}
                    disabled={me?.id === r.user_id}
                  />
                  <span className="text-xs text-muted-foreground">{r.is_active ? "Active" : "Off"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Button variant="outline" onClick={load}>Refresh</Button>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
