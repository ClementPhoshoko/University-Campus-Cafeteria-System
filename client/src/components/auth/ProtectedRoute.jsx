import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import SessionExpiredScreen from './SessionExpiredScreen.jsx';
import connectedAvatar from '../../assets/avatars/connected_avatar.webp';
import notConnectedAvatar from '../../assets/avatars/not_connected_avatar.webp';
import '../../features/auth/auth.css';

export default function ProtectedRoute() {
  const { user, initialized, sessionReady } = useAuth();
  const location = useLocation();
  const isProfileRoute = location.pathname.startsWith('/profile');

  // Profile sections fetch `/profile` through AuthContext. Let their layout
  // mount once the session is known so the route skeletons can cover that
  // backend request instead of being skipped by the session gate.
  if (isProfileRoute ? !sessionReady : !initialized) {
    return (
      <div className="auth-screen">
        <div className="session-check">
          <div className="session-check_avatars">
            <img src={connectedAvatar} alt="" className="session-check_img session-check_img--connected" />
            <img src={notConnectedAvatar} alt="" className="session-check_img session-check_img--not-connected" />
          </div>
          <p className="session-check_text">Checking your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <SessionExpiredScreen redirectTo={`/login?returnTo=${encodeURIComponent(returnTo)}`} />;
  }

  return <Outlet />;
}
