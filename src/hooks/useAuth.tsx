import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { todayInNewYork } from "@/lib/jobs";
import { previewedRoles } from "@/lib/accessDecision";
import { useResumeRefresh } from "@/hooks/useResumeRefresh";

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
  /** Signed-in user whose roles load failed; a resume retries it. */
  const retryUserId = useRef<string | null>(null);
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
        retryUserId.current = null;
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
    const current = () => profileUserId.current === userId; // ignore results after the user changed
    const rolesQuery = supabase.from("user_roles").select("role").eq("user_id", userId);
    const profileQuery = supabase.from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
    const positionsQuery = supabase
      .from("employee_positions")
      .select("position:positions_public(title), effective_date, end_date")
      .eq("user_id", userId)
      .lte("effective_date", today)
      .order("effective_date", { ascending: false })
      .limit(5);
    // Start every query now (builders run when awaited); a failed detail load is display only.
    const details = Promise.all([profileQuery, positionsQuery]).catch(() => null);

    // Roles gate access, so they settle readiness on their own; profile and position fill in later.
    try {
      const { data: roleRows, error } = await rolesQuery;
      if (error) throw error;
      if (!current()) return;
      retryUserId.current = null;
      setRoles(sortRoles((roleRows ?? []).map((r) => r.role as Role)));
    } catch {
      if (!current()) return;
      // Deny by default, and let the next auth event or resume load again
      setRoles([]);
      profileUserId.current = null;
      retryUserId.current = userId;
    }
    setRolesLoaded(true);

    const loaded = await details;
    if (!loaded || (!current() && retryUserId.current !== userId)) return;
    const [{ data: profile }, { data: pos }] = loaded;
    setDisplayName(profile?.display_name ?? null);
    const now = (pos ?? []).find((p: { end_date: string | null }) => !p.end_date || p.end_date >= today);
    setPositionTitle((now?.position as { title?: string } | null)?.title ?? null);
  };

  // Retry a failed roles load when the app is resumed or comes back online.
  useResumeRefresh(() => {
    const userId = retryUserId.current;
    if (!userId || profileUserId.current !== null) return;
    profileUserId.current = userId;
    return loadProfile(userId);
  });

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

  // Same preview resolution as access checks; non-admins always see their real role.
  const effectiveRole: Role | null = previewedRoles(roles, previewRole)[0] ?? null;

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
