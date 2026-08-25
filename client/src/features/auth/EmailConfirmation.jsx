import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import PrimaryButton from '../../components/PrimaryButton.jsx';

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
      setStatus('Email confirmed successfully!');
    } else {
      setError(true);
      setStatus('Invalid or expired confirmation link');
    }
  }, [user, initialized, searchParams]);

  return (
    <div className="auth-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: '380px' }}>
        <h1 className="auth-heading">{status}</h1>
        {!error && user && (
          <PrimaryButton onClick={() => navigate('/', { replace: true })} style={{ marginTop: 'var(--space-4)' }}>
            Continue
          </PrimaryButton>
        )}
        {error && (
          <PrimaryButton onClick={() => navigate('/login', { replace: true })} style={{ marginTop: 'var(--space-4)' }}>
            Back to sign in
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}
