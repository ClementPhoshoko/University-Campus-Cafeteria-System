import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { sendWelcomeEmail } from '../../services/email.js';
import cheerfulAvatar from '../../assets/avatars/Cheerful_Student_with_Green_Checkmark.png';

function isNewUser(user) {
  if (!user?.created_at) return false;
  const ageMs = Date.now() - new Date(user.created_at).getTime();
  return ageMs < 60 * 1000;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, initialized } = useAuth();
  const [status, setStatus] = useState('Processing...');
  const [newAccount, setNewAccount] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);

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
      const fresh = isNewUser(user);
      setNewAccount(fresh);
      setStatus(fresh ? 'Account created successfully' : 'Signed in successfully');
      setShowAvatar(true);

      if (fresh) {
        const dedupeKey = `welcome_sent_${user.id}`;
        if (!sessionStorage.getItem(dedupeKey)) {
          sessionStorage.setItem(dedupeKey, '1');
          sendWelcomeEmail({
            to: user.email,
            userName: user.user_metadata?.full_name || user.email.split('@')[0],
          }).catch((e) => console.error('[Welcome email]', e));
        }
      }
      setTimeout(() => navigate('/', { replace: true }), 1800);
    } else {
      setStatus('Completing sign-in...');
    }
  }, [user, initialized, searchParams, navigate]);

  return (
    <div className="auth-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="auth-callback">
        <h1 className="auth-heading">{status}</h1>
        {newAccount ? (
          <p className="auth-subtitle">
            Welcome to the family, <strong>{user?.user_metadata?.full_name || 'friend'}</strong>! We've
            emailed you a note — check your inbox.
          </p>
        ) : showAvatar ? (
          <p className="auth-subtitle">Redirecting you to your dashboard…</p>
        ) : (
          <p className="auth-subtitle">Please wait while we complete your sign-in</p>
        )}
        {showAvatar && (
          <img src={cheerfulAvatar} alt="" className="auth-callback-avatar" />
        )}
      </div>
    </div>
  );
}
