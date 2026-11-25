import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useRoles } from '../../hooks/useRoles.js';
import SessionExpiredScreen from './SessionExpiredScreen.jsx';
import connectedAvatar from '../../assets/avatars/connected_avatar.webp';
import notConnectedAvatar from '../../assets/avatars/not_connected_avatar.webp';
import '../../features/auth/auth.css';

const APPROVAL_ROLES = ['admin', 'finance'];

export default function ApprovalRoute() {
  const { user, initialized, sessionIssue } = useAuth();
  const { roles, loading: rolesLoading } = useRoles();
  const location = useLocation();

  if (!initialized || rolesLoading) {
    return (
      <div className="auth-screen">
        <div className="session-check">
          <div className="session-check_avatars">
            <img src={connectedAvatar} alt="" className="session-check_img session-check_img--connected" />
            <img src={notConnectedAvatar} alt="" className="session-check_img session-check_img--not-connected" />
          </div>
          <p className="session-check_text">Checking approval session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    const redirectTo = `/login?returnTo=${encodeURIComponent(returnTo)}`;
    if (sessionIssue) return <SessionExpiredScreen redirectTo={redirectTo} />;
    return <Navigate to={redirectTo} replace />;
  }

  if (!roles.some((role) => APPROVAL_ROLES.includes(role))) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
