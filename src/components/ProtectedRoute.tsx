import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAccess, type PlainAccessAction } from "@/lib/access";
import { BottomNav } from "@/components/BottomNav";

interface Props {
  children: React.ReactNode;
  /** Access action the viewer needs; checked against the effective (preview) roles. */
  requireAction?: PlainAccessAction;
}

export const ProtectedRoute = ({ children, requireAction }: Props) => {
  const { session } = useAuth();
  const access = useAccess();

  // Wait for roles before acting on a denied check
  if (!access.ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  if (requireAction && !access.can(requireAction)) return <Navigate to="/" replace />;

  return (
    <>
      {children}
      <BottomNav />
    </>
  );
};
