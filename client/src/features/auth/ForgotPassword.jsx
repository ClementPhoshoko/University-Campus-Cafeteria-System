import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconMail, IconArrowLeft } from '@tabler/icons-react';
import Input from '../../components/Input.jsx';
import OtpInput from '../../components/OtpInput.jsx';
import PasswordInput from '../../components/PasswordInput.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import GlassTooltip from '../../components/GlassTooltip.jsx';
import { useAuth } from '../../hooks/useAuth.js';

const STEPS = {
  EMAIL: 'email',
  OTP: 'otp',
  RESET: 'reset',
  DONE: 'done',
};

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { sendOtp, verifyOtp, resetPassword, loading: authLoading } = useAuth();
  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const clearErrors = () => { setErrors({}); setFormError(''); };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    clearErrors();
    if (!email.trim()) {
      setErrors({ email: 'Email is required' });
      setFormError('Please enter your email');
      return;
    }
    setLoading(true);
    try {
      await sendOtp(email.trim());
      setStep(STEPS.OTP);
    } catch (err) {
      setFormError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    clearErrors();
    if (otp.length !== 6) {
      setErrors({ otp: 'Enter the 6-digit code' });
      setFormError('Please enter the complete code');
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(email.trim(), otp);
      setStep(STEPS.RESET);
    } catch (err) {
      setFormError(err.message || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    clearErrors();
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
      setStep(STEPS.DONE);
    } catch (err) {
      setFormError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === STEPS.DONE) {
    return (
      <>
        <h1 className="auth-heading">Password reset</h1>
        <p className="auth-subtitle">Your password has been updated successfully.</p>
        <PrimaryButton onClick={() => navigate('/login')}>
          Sign in
        </PrimaryButton>
      </>
    );
  }

  return (
    <>
      {step === STEPS.EMAIL && (
        <>
          <h1 className="auth-heading">Forgot password?</h1>
          <p className="auth-subtitle">
            Enter your email and we'll send you a verification code
          </p>

          <form className="auth-form" onSubmit={handleSendOtp} noValidate>
            <GlassTooltip
              message={formError}
              type="error"
              banner
              onClose={() => setFormError('')}
              autoClose
            />

            <Input
              label="Email"
              icon={IconMail}
              type="email"
              name="email"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearErrors(); }}
              error={errors.email}
              autoComplete="email"
            />
            <PrimaryButton type="submit" disabled={loading || authLoading}>
              {loading ? 'Sending...' : 'Send OTP'}
            </PrimaryButton>
          </form>
        </>
      )}

      {step === STEPS.OTP && (
        <>
          <h1 className="auth-heading">Verify code</h1>
          <p className="auth-subtitle">
            Enter the 6-digit code sent to <strong>{email}</strong>
          </p>

          <form className="auth-form" onSubmit={handleVerifyOtp} noValidate>
            <GlassTooltip
              message={formError}
              type="error"
              banner
              onClose={() => setFormError('')}
              autoClose
            />

            <OtpInput value={otp} onChange={setOtp} error={errors.otp} />
            <PrimaryButton type="submit" disabled={loading || authLoading}>
              {loading ? 'Verifying...' : 'Verify'}
            </PrimaryButton>
          </form>

          <button
            type="button"
            className="auth-back"
            onClick={() => { setStep(STEPS.EMAIL); setOtp(''); clearErrors(); }}
          >
            <IconArrowLeft size={16} stroke={2} />
            <span>Use a different email</span>
          </button>
        </>
      )}

      {step === STEPS.RESET && (
        <>
          <h1 className="auth-heading">New password</h1>
          <p className="auth-subtitle">Create a new password for your account</p>

          <form className="auth-form" onSubmit={handleResetPassword} noValidate>
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
              onChange={(e) => { setNewPassword(e.target.value); clearErrors(); }}
              error={errors.password}
              autoComplete="new-password"
            />
            <PrimaryButton type="submit" disabled={loading || authLoading}>
              {loading ? 'Resetting...' : 'Reset password'}
            </PrimaryButton>
          </form>
        </>
      )}

      <Link to="/login" className="auth-back">
        <IconArrowLeft size={16} stroke={2} />
        <span>Back to sign in</span>
      </Link>
    </>
  );
}
