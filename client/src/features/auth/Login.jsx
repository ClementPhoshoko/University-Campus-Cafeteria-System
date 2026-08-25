import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { IconMail, IconBrandGoogle } from '@tabler/icons-react';
import Input from '../../components/Input.jsx';
import PasswordInput from '../../components/PasswordInput.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import GlassTooltip from '../../components/GlassTooltip.jsx';
import { useAuth } from '../../hooks/useAuth.js';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signInWithGoogle, loading: authLoading } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors((prev) => ({ ...prev, [e.target.name]: '' }));
    if (formError) setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.email.trim()) next.email = 'Email or student number is required';
    if (!form.password) next.password = 'Password is required';
    setErrors(next);
    if (Object.keys(next).length) {
      setFormError('Please fix the errors below');
      return;
    }

    setLoading(true);
    setFormError('');
    try {
      await signIn(form.email.trim(), form.password);
      const returnTo = searchParams.get('returnTo') || '/';
      navigate(returnTo, { replace: true });
    } catch (err) {
      setFormError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setFormError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setFormError(err.message || 'Google sign-in failed. Please try again.');
    }
  };

  return (
    <>
      <h1 className="auth-heading">Welcome back</h1>
      <p className="auth-subtitle">Sign in to your account to continue</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <GlassTooltip
          message={formError}
          type="error"
          banner
          onClose={() => setFormError('')}
          autoClose
        />

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

        <PrimaryButton type="submit" disabled={loading || authLoading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </PrimaryButton>
      </form>

      <div className="auth-divider">
        <span>or continue with</span>
      </div>

      <button type="button" className="auth-google-btn" onClick={handleGoogle} disabled={loading || authLoading}>
        <IconBrandGoogle size={18} stroke={2} />
        <span>Continue with Google</span>
      </button>

      <p className="auth-footer">
        Don't have an account?{' '}
        <Link to="/signup" className="auth-link">Sign up</Link>
      </p>
    </>
  );
}
