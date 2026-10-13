import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

  return <>{children}</>;
}
