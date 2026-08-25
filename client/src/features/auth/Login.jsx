import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconMail, IconBrandGoogle } from '@tabler/icons-react';
import AuthLayout from '../../components/AuthLayout.jsx';
import Input from '../../components/Input.jsx';
import PasswordInput from '../../components/PasswordInput.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import { signInWithEmail, signInWithGoogle } from '../../services/auth.js';
import mainLogo from '../../assets/main_logo.png';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors((prev) => ({ ...prev, [e.target.name]: '' }));
    if (globalError) setGlobalError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.email.trim()) next.email = 'Email or student number is required';
    if (!form.password) next.password = 'Password is required';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    setGlobalError('');
    try {
      await signInWithEmail(form.email.trim(), form.password);
    } catch (err) {
      setGlobalError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGlobalError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setGlobalError(err.message || 'Google sign-in failed. Please try again.');
    }
  };

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

      <h1 className="auth-heading">Welcome back</h1>
      <p className="auth-subtitle">Sign in to your account to continue</p>

      {globalError && <div className="auth-alert auth-alert--error">{globalError}</div>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Input
          label="Email or student number"
          icon={IconMail}
          type="email"
          name="email"
          placeholder="you@university.edu"
          value={form.email}
          onChange={handleChange}
          error={errors.email}
          autoComplete="email"
        />

        <PasswordInput
          label="Password"
          name="password"
          placeholder="Enter your password"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
          autoComplete="current-password"
        />

        <Link to="/forgot-password" className="auth-forgot">
          Forgot password?
        </Link>

        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </PrimaryButton>
      </form>

      <div className="auth-divider">
        <span>or continue with</span>
      </div>

      <button type="button" className="auth-google-btn" onClick={handleGoogle}>
        <IconBrandGoogle size={18} stroke={2} />
        <span>Continue with Google</span>
      </button>

      <p className="auth-footer">
        Don't have an account?{' '}
        <Link to="/signup" className="auth-link">Sign up</Link>
      </p>
    </AuthLayout>
  );
}
