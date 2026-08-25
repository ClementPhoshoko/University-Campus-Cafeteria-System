import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, initialized } = useAuth();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    if (!initialized) return;

    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      setStatus(errorDescription || 'Authentication failed');
      setTimeout(() => navigate('/login', { replace: true }), 3000);
      return;
    }

    if (user) {
      setStatus('Signed in successfully');
      setTimeout(() => navigate('/', { replace: true }), 1000);
    } else {
      setStatus('Completing sign-in...');
    }
  }, [user, initialized, searchParams, navigate]);

  return (
    <div className="auth-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 className="auth-heading" style={{ fontSize: '1.5rem' }}>{status}</h1>
        {status === 'Processing...' && (
          <p className="auth-subtitle">Please wait while we complete your sign-in</p>
        )}
      </div>
    </div>
  );
}
