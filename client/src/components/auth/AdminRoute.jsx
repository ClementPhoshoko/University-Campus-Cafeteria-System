import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useRoles } from '../../hooks/useRoles.js';
import connectedAvatar from '../../assets/avatars/connected_avatar.png';
import notConnectedAvatar from '../../assets/avatars/not_connected_avatar.png';
import '../../features/auth/auth.css';

const ADMIN_ROLES = ['company_admin', 'admin', 'super_admin'];

export default function AdminRoute() {
  const { user, initialized } = useAuth();
  const { roles, loading: rolesLoading } = useRoles();

  if (!initialized || rolesLoading) {
    return (
      <div className="auth-screen">
        <div className="session-check">
          <div className="session-check_avatars">
            <img src={connectedAvatar} alt="" className="session-check_img session-check_img--connected" />
            <img src={notConnectedAvatar} alt="" className="session-check_img session-check_img--not-connected" />
          </div>
          <p className="session-check_text">Checking admin session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = roles.some((role) => ADMIN_ROLES.includes(role));

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
