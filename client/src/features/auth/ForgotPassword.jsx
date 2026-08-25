import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconMail, IconArrowLeft, IconLock } from '@tabler/icons-react';
import AuthLayout from '../../components/AuthLayout.jsx';
import Input from '../../components/Input.jsx';
import OtpInput from '../../components/OtpInput.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import GlassTooltip from '../../components/GlassTooltip.jsx';
import { sendOtp, verifyOtp, resetPassword } from '../../services/auth.js';
import mainLogo from '../../assets/main_logo.png';

const STEPS = {
  EMAIL: 'email',
  OTP: 'otp',
  RESET: 'reset',
  DONE: 'done',
};

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const formRef = useRef(null);

  const clearErrors = () => { setErrors({}); setGlobalError(''); };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    clearErrors();
    if (!email.trim()) { setErrors({ email: 'Email is required' }); return; }
    setLoading(true);
    try {
      await sendOtp(email.trim());
      setStep(STEPS.OTP);
    } catch (err) {
      setGlobalError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    clearErrors();
    if (otp.length !== 6) { setErrors({ otp: 'Enter the 6-digit code' }); return; }
    setLoading(true);
    try {
      await verifyOtp(email.trim(), otp);
      setStep(STEPS.RESET);
    } catch (err) {
      setGlobalError(err.message || 'Invalid or expired code. Please try again.');
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
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      await resetPassword(newPassword);
      setStep(STEPS.DONE);
    } catch (err) {
      setGlobalError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === STEPS.DONE) {
    return (
      <AuthLayout>
        <div className="auth-brand">
          <img src={mainLogo} alt="Merchant Munchies" className="auth-logo" />
          <div className="auth-brand-name">
            <span className="auth-brand-merchant">merchant</span>
            <span className="auth-brand-munchies">munchies</span>
          </div>
          <p className="auth-brand-tagline">
            <span>GOOD FOOD</span>
            <span className="auth-brand-tagline-dot">•</span>
            <span className="auth-brand-tagline-accent">LESS QUEUE</span>
            <span className="auth-brand-tagline-dot">•</span>
            <span>MORE YOU</span>
          </p>
          <svg className="auth-brand-smile" width="36" height="12" viewBox="0 0 48 16" fill="none" aria-hidden="true">
            <path d="M4 4C12 14 36 14 44 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="auth-heading">Password reset</h1>
        <p className="auth-subtitle">Your password has been updated successfully.</p>
        <PrimaryButton onClick={() => navigate('/login')}>
          Sign in
        </PrimaryButton>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth-brand">
        <img src={mainLogo} alt="Merchant Munchies" className="auth-logo" />
        <div className="auth-brand-name">
          <span className="auth-brand-merchant">merchant</span>
          <span className="auth-brand-munchies">munchies</span>
        </div>
        <p className="auth-brand-tagline">
          <span>GOOD FOOD</span>
          <span className="auth-brand-tagline-dot">•</span>
          <span className="auth-brand-tagline-accent">LESS QUEUE</span>
          <span className="auth-brand-tagline-dot">•</span>
          <span>MORE YOU</span>
        </p>
        <svg className="auth-brand-smile" width="36" height="12" viewBox="0 0 48 16" fill="none" aria-hidden="true">
          <path d="M4 4C12 14 36 14 44 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>

      {step === STEPS.EMAIL && (
        <>
          <h1 className="auth-heading">Forgot password?</h1>
          <p className="auth-subtitle">
            Enter your email and we'll send you a verification code
          </p>

          {globalError && (
            <GlassTooltip
              message={globalError}
              type="error"
              onClose={() => setGlobalError('')}
              autoClose
              anchorRef={formRef}
              position="bottom"
            />
          )}

          <form className="auth-form" ref={formRef} onSubmit={handleSendOtp} noValidate>
            <Input
              label="Email"
              icon={IconMail}
              type="email"
              name="email"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearErrors(); }}
              error={errors.email}
              tooltipError
              autoComplete="email"
            />
            <PrimaryButton type="submit" disabled={loading}>
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

          {globalError && (
            <GlassTooltip
              message={globalError}
              type="error"
              onClose={() => setGlobalError('')}
              autoClose
              anchorRef={formRef}
              position="bottom"
            />
          )}

          <form className="auth-form" ref={formRef} onSubmit={handleVerifyOtp} noValidate>
            <OtpInput value={otp} onChange={setOtp} error={errors.otp} tooltipError />
            <PrimaryButton type="submit" disabled={loading}>
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

          {globalError && (
            <GlassTooltip
              message={globalError}
              type="error"
              onClose={() => setGlobalError('')}
              autoClose
              anchorRef={formRef}
              position="bottom"
            />
          )}

          <form className="auth-form" ref={formRef} onSubmit={handleResetPassword} noValidate>
            <PasswordInput
              label="New password"
              name="password"
              placeholder="Create a new password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); clearErrors(); }}
              error={errors.password}
              tooltipError
              autoComplete="new-password"
            />
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset password'}
            </PrimaryButton>
          </form>
        </>
      )}

      <Link to="/login" className="auth-back">
        <IconArrowLeft size={16} stroke={2} />
        <span>Back to sign in</span>
      </Link>
    </AuthLayout>
  );
}
