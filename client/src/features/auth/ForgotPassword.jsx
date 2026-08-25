import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconMail, IconArrowLeft } from '@tabler/icons-react';
import AuthLayout from '../../components/AuthLayout.jsx';
import Input from '../../components/Input.jsx';
import mainLogo from '../../assets/main_logo.png';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email or student number is required');
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <AuthLayout>
        <div className="auth-brand">
          <img src={mainLogo} alt="Merchant Munchies" className="auth-logo" />
        </div>

        <h1 className="auth-heading">Check your email</h1>
        <p className="auth-subtitle">
          We've sent a password reset link to <strong>{email}</strong>
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

      <h1 className="auth-heading">Forgot password?</h1>
      <p className="auth-subtitle">
        Enter your email or student number and we'll send you a reset link
      </p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Input
          label="Email or student number"
          icon={IconMail}
          type="email"
          name="email"
          placeholder="you@university.edu"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          error={error}
          autoComplete="email"
        />

        <button type="submit" className="auth-btn-primary">
          Send reset link
        </button>
      </form>

      <Link to="/login" className="auth-back">
        <IconArrowLeft size={16} stroke={2} />
        <span>Back to sign in</span>
      </Link>
    </AuthLayout>
  );
}
