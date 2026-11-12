import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAccess, type PlainAccessAction } from "@/lib/access";
import { BottomNav } from "@/components/BottomNav";
import { signInPath } from "@/lib/safeNextPath";

interface Props {
  children: React.ReactNode;
  /** Access action the viewer needs; checked against the effective (preview) roles. */
  requireAction?: PlainAccessAction;
}

export const ProtectedRoute = ({ children, requireAction }: Props) => {
  const { session } = useAuth();
  const access = useAccess();
  const location = useLocation();

  // Wait for roles before acting on a denied check
  if (!access.ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  // Remember the requested in-app path so sign-in can return there
  if (!session) return <Navigate to={signInPath(location.pathname, location.search, location.hash)} replace />;
  if (requireAction && !access.can(requireAction)) return <Navigate to="/" replace />;

  return (
    <>
      {children}
      <BottomNav />
    </>
  );
};
