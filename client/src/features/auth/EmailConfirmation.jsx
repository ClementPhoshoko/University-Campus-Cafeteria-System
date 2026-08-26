import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import cheerfulAvatar from '../../assets/avatars/Cheerful_Student_with_Green_Checkmark.png';

export default function EmailConfirmation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, initialized } = useAuth();
  const [status, setStatus] = useState('Confirming your email...');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!initialized) return;

    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (errorParam) {
      setError(true);
      setStatus(errorDescription || 'Confirmation failed');
      return;
    }

    if (user) {
      setStatus('Email confirmed!');
    } else {
      setError(true);
      setStatus('Invalid or expired link');
    }
  }, [user, initialized, searchParams]);

  return (
    <div className="auth-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="auth-callback">
        {!error && user && (
          <img src={cheerfulAvatar} alt="" className="auth-callback-avatar" />
        )}
        <h1 className="auth-heading">{status}</h1>
        {user && !error && (
          <p className="auth-subtitle">
            Your account is active. Time to skip the queue!
          </p>
        )}
        {error && (
          <p className="auth-subtitle">
            This confirmation link may have expired or already been used.
          </p>
        )}

        {initialized && !error && user && (
          <PrimaryButton onClick={() => navigate('/', { replace: true })}>
            Continue
          </PrimaryButton>
        )}
        {error && initialized && (
          <PrimaryButton onClick={() => navigate('/login', { replace: true })}>
            Back to sign in
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}
