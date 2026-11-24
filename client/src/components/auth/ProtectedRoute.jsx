import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import NotFoundScreen from './NotFoundScreen.jsx';
import SessionExpiredScreen from './SessionExpiredScreen.jsx';
import connectedAvatar from '../../assets/avatars/connected_avatar.webp';
import notConnectedAvatar from '../../assets/avatars/not_connected_avatar.webp';
import '../../features/auth/auth.css';

export default function ProtectedRoute() {
  const { user, initialized, sessionReady, sessionIssue } = useAuth();
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
    // A signed-out visitor cannot resolve a private order resource. Treat the
    // detail URL as missing rather than revealing that the route exists.
    if (!sessionIssue && /^\/orders\/[^/]+\/?$/.test(location.pathname)) return <NotFoundScreen />;
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    const redirectTo = `/login?returnTo=${encodeURIComponent(returnTo)}`;

    // A fresh browser profile simply has no session; send it to sign in.
    // Only a rejected token gets the dedicated expired-session screen.
    if (sessionIssue) return <SessionExpiredScreen redirectTo={redirectTo} />;
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
