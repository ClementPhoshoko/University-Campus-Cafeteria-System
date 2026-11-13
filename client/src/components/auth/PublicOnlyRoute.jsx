import { Navigate, Outlet, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { getSafeReturnTo } from '../../utils/returnTo.js';

export default function PublicOnlyRoute() {
  const { user, initialized } = useAuth();
  const [searchParams] = useSearchParams();

  if (!initialized) {
    return (
      <div className="auth-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-secondary, #6b7280)' }}>Loading...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to={getSafeReturnTo(searchParams.get('returnTo'))} replace />;
  }

  return <Outlet />;
}
