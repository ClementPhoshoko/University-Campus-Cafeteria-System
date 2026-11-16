import { useNavigate } from 'react-router-dom';
import PrimaryButton from '../PrimaryButton.jsx';
import errorAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.webp';

export default function NotFoundScreen() {
  const navigate = useNavigate();

  return (
    <div className="session-expired-screen">
      <div className="session-expired-card">
        <div className="session-expired-avatar-wrap">
          <img
            src={errorAvatar}
            alt="Error illustration"
            className="session-expired-avatar"
          />
        </div>

        <span className="session-expired-badge">Page unavailable</span>

        <h1 className="session-expired-title">This page doesn’t exist</h1>
        <p className="session-expired-body">
          The link may be broken, or this route is no longer available. Head back to the campus home page.
        </p>

        <div className="session-expired-actions">
          <PrimaryButton onClick={() => navigate('/', { replace: true })}>
            Take me home
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
