import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { getSafeReturnTo } from '../../utils/returnTo.js';

export default function PublicOnlyRoute() {
  const { user, initialized } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  if (!initialized) {
    return (
      <div className="auth-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-secondary, #6b7280)' }}>Loading...</p>
      </div>
    );
  }

  // The profile security page links here so an authenticated employee can
  // complete the existing OTP recovery flow without being redirected away.
  const fromProfileRecovery = location.pathname === '/forgot-password'
    && location.state?.fromProfile === true;

  if (user && !fromProfileRecovery) {
    return <Navigate to={getSafeReturnTo(searchParams.get('returnTo'))} replace />;
  }

  return <Outlet />;
}
