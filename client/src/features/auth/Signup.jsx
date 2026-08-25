import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconUser, IconMail, IconBrandGoogle } from '@tabler/icons-react';
import Input from '../../components/Input.jsx';
import PasswordInput from '../../components/PasswordInput.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import GlassTooltip from '../../components/GlassTooltip.jsx';
import { useAuth } from '../../hooks/useAuth.js';

export default function Signup() {
  const { signUp, signInWithGoogle, loading: authLoading } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors((prev) => ({ ...prev, [e.target.name]: '' }));
    if (formError) setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Full name is required';
    if (!form.email.trim()) next.email = 'Email or student number is required';
    if (!form.password) next.password = 'Password is required';
    else if (form.password.length < 8) next.password = 'Must be at least 8 characters';
    setErrors(next);
    if (Object.keys(next).length) {
      setFormError('Please fix the errors below');
      return;
    }

    setLoading(true);
    setFormError('');
    try {
      await signUp(form.email.trim(), form.password, {
        full_name: form.name.trim(),
      });
      setSuccess(true);
    } catch (err) {
      setFormError(err.message || 'Registration failed. Please try again.');
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

  if (success) {
    return (
      <>
        <h1 className="auth-heading">Check your email</h1>
        <p className="auth-subtitle">
          We've sent a verification link to <strong>{form.email}</strong>. Please confirm your account.
        </p>
        <Link to="/login" className="primary-btn primary-btn--md" style={{ textAlign: 'center', textDecoration: 'none', width: '100%', background: 'var(--blue-50)', color: 'var(--color-action-primary)', border: '1px solid var(--glass-border, rgba(255,255,255,0.45))' }}>
          Back to sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="auth-heading">Create account</h1>
      <p className="auth-subtitle">Join your campus food community</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <GlassTooltip
          message={formError}
          type="error"
          banner
          onClose={() => setFormError('')}
          autoClose
        />

        <Input
          label="Full name"
          icon={IconUser}
          type="text"
          name="name"
          placeholder="Your full name"
          value={form.name}
          onChange={handleChange}
          error={errors.name}
          autoComplete="name"
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
          placeholder="Create a password"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
          autoComplete="new-password"
        />

        <PrimaryButton type="submit" disabled={loading || authLoading}>
          {loading ? 'Creating account...' : 'Create account'}
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
        Already have an account?{' '}
        <Link to="/login" className="auth-link">Sign in</Link>
      </p>
    </>
  );
}
