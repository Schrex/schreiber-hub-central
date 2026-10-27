import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { todayInNewYork } from "@/lib/jobs";

export type Role = "employee" | "foreman" | "office" | "admin";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /**
   * Highest role held (primary). Not for access checks: use `useAccess().can()`.
   * Only business rules about the user themself read it (TimeOff notice period).
   */
  role: Role | null;
  /** Every role held, highest first. Empty until `rolesLoaded`. Read by `useAccess`. */
  roles: Role[];
  /** True once the session is known and, if signed in, its roles have loaded. */
  rolesLoaded: boolean;
  /** Preview role for an admin, else `role`. UI display only (header badge, role switcher). */
  effectiveRole: Role | null;
  /** An admin's "preview as" role. Read by `useAccess`; set via `setPreviewRole`. */
  previewRole: Role | null;
  setPreviewRole: (r: Role | null) => void;
  displayName: string | null;
  positionTitle: string | null;
  /** True until `rolesLoaded`; redirecting callers must wait for it. */
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PREVIEW_KEY = "previewRole";
const isValidRole = (v: string | null): v is Role =>
  v === "employee" || v === "foreman" || v === "office" || v === "admin";

const ROLE_RANK: Record<Role, number> = { admin: 1, office: 2, foreman: 3, employee: 4 };

const sortRoles = (roles: Role[]): Role[] =>
  [...new Set(roles)].filter(isValidRole).sort((a, b) => ROLE_RANK[a] - ROLE_RANK[b]);


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const profileUserId = useRef<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [positionTitle, setPositionTitle] = useState<string | null>(null);
  const [previewRole, setPreviewRoleState] = useState<Role | null>(() => {
    if (typeof window === "undefined") return null;
    const v = sessionStorage.getItem(PREVIEW_KEY);
    return isValidRole(v) ? v : null;
  });

  useEffect(() => {
    // Listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (!s?.user) {
        profileUserId.current = null;
        setRoles([]);
        setRolesLoaded(true);
        setDisplayName(null);
        setPositionTitle(null);
        setPreviewRoleState(null);
        if (typeof window !== "undefined") sessionStorage.removeItem(PREVIEW_KEY);
      } else {
        // Defer DB calls; skip when this user's profile is already loading or loaded
        if (profileUserId.current !== s.user.id) {
          profileUserId.current = s.user.id;
          setRolesLoaded(false);
          setTimeout(() => loadProfile(s.user.id), 0);
        }
      }
    });

    // Then existing session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        if (profileUserId.current !== s.user.id) {
          profileUserId.current = s.user.id;
          setRolesLoaded(false);
          loadProfile(s.user.id);
        }
      } else {
        setRolesLoaded(true);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    const today = todayInNewYork();
    try {
      const [{ data: roleRows }, { data: profile }, { data: pos }] = await Promise.all([
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
      // Ignore a load that finished after the user changed
      if (profileUserId.current !== userId) return;
      setRoles(sortRoles((roleRows ?? []).map((r) => r.role as Role)));
      setDisplayName(profile?.display_name ?? null);
      const current = (pos ?? []).find((p: { end_date: string | null }) => !p.end_date || p.end_date >= today);
      const title = (current?.position as { title?: string } | null)?.title ?? null;
      setPositionTitle(title);
    } catch {
      // Deny by default: a failed load leaves no roles
      if (profileUserId.current === userId) setRoles([]);
    } finally {
      if (profileUserId.current === userId) setRolesLoaded(true);
    }
  };

  const setPreviewRole = (r: Role | null) => {
    // Only admins can preview as another role
    if (role !== "admin") return;
    setPreviewRoleState(r);
    if (typeof window === "undefined") return;
    if (r && r !== role) sessionStorage.setItem(PREVIEW_KEY, r);
    else sessionStorage.removeItem(PREVIEW_KEY);
  };

  const role: Role | null = roles[0] ?? null;
  const loading = !rolesLoaded;

  // effectiveRole respects an admin's preview selection; non-admins always see their real role.
  const effectiveRole: Role | null = role === "admin" && previewRole ? previewRole : role;

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        role,
        roles,
        rolesLoaded,
        effectiveRole,
        previewRole,
        setPreviewRole,
        displayName,
        positionTitle,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
