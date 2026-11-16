import { useNavigate } from 'react-router-dom';
import PrimaryButton from '../PrimaryButton.jsx';
import sessionExpiredAvatar from '../../assets/avatars/Cheerful_Student_Presenting_with_Open_Palm.png';

export default function SessionExpiredScreen({ redirectTo = '/login' }) {
  const navigate = useNavigate();

  return (
    <div className="session-expired-screen">
      <div className="session-expired-card">
        <div className="session-expired-content">
          <div className="session-expired-visual">
            <img
              src={sessionExpiredAvatar}
              alt="Student illustration"
              className="session-expired-avatar"
            />
          </div>

          <div className="session-expired-copy">
            <h1 className="session-expired-title">Your session has expired</h1>
            <p className="session-expired-body">
              For your safety, we signed you out automatically. Please sign in again to keep using your account.
            </p>

            <div className="session-expired-actions">
              <PrimaryButton onClick={() => navigate(redirectTo, { replace: true })}>
                Take me to sign in
              </PrimaryButton>
              <button
                type="button"
                className="session-expired-link"
                onClick={() => navigate('/login', { replace: true })}
              >
                Use a different account
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
