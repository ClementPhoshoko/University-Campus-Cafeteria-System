import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import connectedAvatar from '../../assets/avatars/connected_avatar.png';
import notConnectedAvatar from '../../assets/avatars/not_connected_avatar.png';
import '../../features/auth/auth.css';

export default function ProtectedRoute() {
  const { user, initialized } = useAuth();

  if (!initialized) {
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
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
