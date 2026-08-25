import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconUser, IconMail, IconBrandGoogle } from '@tabler/icons-react';
import AuthLayout from '../../components/AuthLayout.jsx';
import Input from '../../components/Input.jsx';
import PasswordInput from '../../components/PasswordInput.jsx';
import { signUpWithEmail, signInWithGoogle } from '../../services/auth.js';
import mainLogo from '../../assets/main_logo.png';

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors((prev) => ({ ...prev, [e.target.name]: '' }));
    if (globalError) setGlobalError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Full name is required';
    if (!form.email.trim()) next.email = 'Email or student number is required';
    if (!form.password) next.password = 'Password is required';
    else if (form.password.length < 8) next.password = 'Must be at least 8 characters';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    setGlobalError('');
    try {
      await signUpWithEmail(form.email.trim(), form.password, {
        full_name: form.name.trim(),
      });
      setSuccess(true);
    } catch (err) {
      setGlobalError(err.message || 'Registration failed. Please try again.');
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

  if (success) {
    return (
      <AuthLayout>
        <div className="auth-brand">
          <img src={mainLogo} alt="Merchant Munchies" className="auth-logo" />
        </div>
        <h1 className="auth-heading">Check your email</h1>
        <p className="auth-subtitle">
          We've sent a verification link to <strong>{form.email}</strong>. Please confirm your account.
        </p>
        <Link to="/login" className="auth-btn-primary" style={{ textAlign: 'center', textDecoration: 'none' }}>
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth-brand">
        <img src={mainLogo} alt="Merchant Munchies" className="auth-logo" />
      </div>

      <h1 className="auth-heading">Create account</h1>
      <p className="auth-subtitle">Join your campus food community</p>

      {globalError && <div className="auth-alert auth-alert--error">{globalError}</div>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
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

        <button type="submit" className="auth-btn-primary" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <div className="auth-divider">
        <span>or continue with</span>
      </div>

      <button type="button" className="auth-btn-google" onClick={handleGoogle}>
        <IconBrandGoogle size={20} stroke={2} />
        <span>Continue with Google</span>
      </button>

      <p className="auth-footer">
        Already have an account?{' '}
        <Link to="/login" className="auth-link">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
