import { Navigate } from "react-router-dom";
import { useAuth, type Role } from "@/hooks/useAuth";

interface Props {
  children: React.ReactNode;
  requireRole?: Role;
}

export const ProtectedRoute = ({ children, requireRole }: Props) => {
  const { session, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  if (requireRole && role !== requireRole) return <Navigate to="/" replace />;

  return <>{children}</>;
};
