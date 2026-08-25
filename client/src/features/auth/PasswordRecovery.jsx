import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import PasswordInput from '../../components/PasswordInput.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import GlassTooltip from '../../components/GlassTooltip.jsx';

export default function PasswordRecovery() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resetPassword, loading: authLoading } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      setFormError('Invalid or expired recovery link');
      return;
    }
    setIsValidSession(true);
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setFormError('');

    const next = {};
    if (!newPassword) next.password = 'Password is required';
    else if (newPassword.length < 8) next.password = 'Must be at least 8 characters';
    setErrors(next);
    if (Object.keys(next).length) {
      setFormError('Please fix the errors below');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(newPassword);
      setSuccess(true);
    } catch (err) {
      setFormError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '380px' }}>
          <h1 className="auth-heading">Password updated!</h1>
          <p className="auth-subtitle">Your password has been reset successfully.</p>
          <PrimaryButton onClick={() => navigate('/login', { replace: true })}>
            Sign in
          </PrimaryButton>
        </div>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="auth-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '380px' }}>
          <h1 className="auth-heading">Invalid link</h1>
          <p className="auth-subtitle">{formError || 'This recovery link is invalid or has expired.'}</p>
          <PrimaryButton onClick={() => navigate('/forgot-password', { replace: true })}>
            Request new link
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: '380px' }}>
        <h1 className="auth-heading">Set new password</h1>
        <p className="auth-subtitle">Enter your new password below</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <GlassTooltip
            message={formError}
            type="error"
            banner
            onClose={() => setFormError('')}
            autoClose
          />

          <PasswordInput
            label="New password"
            name="password"
            placeholder="Create a new password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setErrors({}); setFormError(''); }}
            error={errors.password}
            autoComplete="new-password"
          />
          <PrimaryButton type="submit" disabled={loading || authLoading}>
            {loading ? 'Updating...' : 'Update password'}
          </PrimaryButton>
        </form>
      </div>
    </div>
  );
}
