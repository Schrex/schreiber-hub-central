import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "employee" | "foreman" | "office" | "admin";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: Role | null;
  displayName: string | null;
  positionTitle: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ROLE_RANK: Record<Role, number> = { admin: 1, office: 2, foreman: 3, employee: 4 };

const pickPrimary = (roles: Role[]): Role | null => {
  if (!roles.length) return null;
  return [...roles].sort((a, b) => ROLE_RANK[a] - ROLE_RANK[b])[0];
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [positionTitle, setPositionTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (!s?.user) {
        setRole(null);
        setDisplayName(null);
        setPositionTitle(null);
      } else {
        // Defer DB calls
        setTimeout(() => loadProfile(s.user.id), 0);
      }
    });

    // Then existing session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfile(s.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: roles }, { data: profile }, { data: pos }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
      supabase
        .from("employee_positions")
        .select("position:positions_public(title), effective_date, end_date")
        .eq("user_id", userId)
        .lte("effective_date", today)
        .order("effective_date", { ascending: false })
        .limit(5),
    ]);
    setRole(pickPrimary((roles ?? []).map((r) => r.role as Role)));
    setDisplayName(profile?.display_name ?? null);
    const current = (pos ?? []).find((p: { end_date: string | null }) => !p.end_date || p.end_date >= today);
    const title = (current?.position as { title?: string } | null)?.title ?? null;
    setPositionTitle(title);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, role, displayName, positionTitle, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
