import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { IconBrandGoogle, IconMail, IconUser } from '@tabler/icons-react';
import { useAuth } from '../../hooks/useAuth.js';
import { acceptVendorInvitation, getVendorInvitation } from '../../services/vendorApi.js';
import Input from '../../components/Input.jsx';
import PasswordInput from '../../components/PasswordInput.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import GlassTooltip from '../../components/GlassTooltip.jsx';
import './vendor-invitation.css';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export default function VendorInvitationPage() {
  const { token: invitationToken } = useParams();
  const location = useLocation();
  const { user, session, isEmailVerified, signIn, signUp, signInWithGoogle, signOut } = useAuth();
  const [invitation, setInvitation] = useState(null);
  const [loadingInvitation, setLoadingInvitation] = useState(true);
  const [invitationError, setInvitationError] = useState('');
  const [mode, setMode] = useState('signup');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [awaitingEmailVerification, setAwaitingEmailVerification] = useState(false);
  const [accepted, setAccepted] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    getVendorInvitation(invitationToken, { signal: controller.signal })
      .then((response) => {
        setInvitation(response.invitation);
        setInvitationError('');
      })
      .catch((requestError) => {
        if (!controller.signal.aborted && requestError.name !== 'AbortError') {
          setInvitationError(requestError.message || 'This invitation is not available.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingInvitation(false);
      });
    return () => controller.abort();
  }, [invitationToken]);

  async function redeem(accessToken, account) {
    if (!isEmailVerified && !account?.email_confirmed_at) {
      setMessage('Verify your account email first, then return to this invitation link.');
      setBusy(false);
      return;
    }
    if (normalizeEmail(account?.email) !== normalizeEmail(invitation?.email)) {
      setError(`Sign in with ${invitation?.email} to accept this vendor invitation.`);
      setBusy(false);
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await acceptVendorInvitation(invitationToken, { token: accessToken });
      setAccepted(response.invitation);
    } catch (requestError) {
      setError(requestError.message || 'Could not accept this invitation. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignIn(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await signIn(invitation.email, password);
      await redeem(data.session?.access_token, data.user);
    } catch (requestError) {
      setError(requestError.message || 'Could not sign in. Check your password and try again.');
      setBusy(false);
    }
  }

  async function handleSignUp(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const redirectTo = new URL('/auth/confirm', window.location.origin);
      redirectTo.searchParams.set('returnTo', location.pathname);
      const data = await signUp(
        invitation.email,
        password,
        { full_name: name.trim() },
        { emailRedirectTo: redirectTo.toString() },
      );
      if (data.session?.access_token && data.user?.email_confirmed_at) {
        await redeem(data.session.access_token, data.user);
      } else {
        setMessage(`Check ${invitation.email} and verify your email. The link will bring you back here to accept the invitation.`);
        setAwaitingEmailVerification(true);
        setBusy(false);
      }
    } catch (requestError) {
      setError(requestError.message || 'Could not create your account. Please try again.');
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    try {
      await signInWithGoogle(location.pathname);
    } catch (requestError) {
      setError(requestError.message || 'Google sign-in failed. Please try again.');
    }
  }

  const hasMatchingAccount = user && normalizeEmail(user.email) === normalizeEmail(invitation?.email);

  if (loadingInvitation) return <p className="auth-subtitle" role="status">Loading invitation…</p>;

  if (invitationError) return <>
    <h1 className="auth-heading">Invitation unavailable</h1>
    <p className="auth-subtitle" role="alert">{invitationError}</p>
    <Link to="/" className="auth-back">Return to Merchant Munchies</Link>
  </>;

  if (accepted) return <>
    <p className="vendor-invitation__eyebrow">Invitation accepted</p>
    <h1 className="auth-heading">You’re on the team</h1>
    <p className="auth-subtitle">You joined {accepted.vendor_name || invitation.vendor_name} as vendor {accepted.role}.</p>
    <Link to="/vendor" className="vendor-invitation__continue">Open vendor dashboard</Link>
  </>;

  return <>
    <p className="vendor-invitation__eyebrow">Vendor team invitation</p>
    <h1 className="auth-heading">Join {invitation.vendor_name}</h1>
    <p className="auth-subtitle vendor-invitation__summary">
      You’re invited as <strong>{invitation.role}</strong> using <strong>{invitation.email}</strong>.
      This single-use invitation expires {new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeZone: 'Africa/Johannesburg' }).format(new Date(invitation.expires_at))} (South African time).
    </p>

    {user ? hasMatchingAccount ? <>
      {!isEmailVerified && <p className="vendor-invitation__notice" role="status">Your account email must be verified before you can accept.</p>}
      <PrimaryButton disabled={busy || !isEmailVerified} onClick={() => redeem(session?.access_token, user)}>
        {busy ? 'Accepting…' : 'Accept invitation'}
      </PrimaryButton>
    </> : <>
      <p className="vendor-invitation__error" role="alert">You’re signed in as {user.email}. Sign out and use the invited email address.</p>
      <button type="button" className="auth-google-btn" onClick={signOut}>Sign out</button>
    </> : <>
      <GlassTooltip message={error} type="error" banner onClose={() => setError('')} autoClose />
      {awaitingEmailVerification && mode === 'signup' ? (
        <p className="vendor-invitation__notice" role="status">{message}</p>
      ) : <form className="auth-form" onSubmit={mode === 'signin' ? handleSignIn : handleSignUp}>
        {message && <p className="vendor-invitation__notice" role="status">{message}</p>}
        {mode === 'signup' && <Input label="Full name" icon={IconUser} type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />}
        <Input label="Email address" icon={IconMail} type="email" value={invitation.email} readOnly aria-readonly="true" />
        <PasswordInput
          label="Password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={mode === 'signup' ? 8 : undefined}
          required
        />
        <PrimaryButton type="submit" disabled={busy || (mode === 'signup' && password.length < 8)}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account and continue' : 'Sign in and accept'}
        </PrimaryButton>
      </form>}
      {mode === 'signin' && <>
        <div className="auth-divider"><span>or continue with</span></div>
        <button type="button" className="auth-google-btn" onClick={handleGoogleSignIn}>
          <IconBrandGoogle size={18} stroke={2} />
          <span>Continue with Google</span>
        </button>
        <Link className="auth-forgot vendor-invitation__forgot" to={`/forgot-password?returnTo=${encodeURIComponent(location.pathname)}`}>Forgot your password?</Link>
      </>}
      <p className="auth-footer vendor-invitation__switch">
        {mode === 'signin' ? 'New to Merchant Munchies?' : 'Already have an account?'}{' '}
        <button type="button" className="auth-link" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); setAwaitingEmailVerification(false); }}>
          {mode === 'signin' ? 'Create account' : 'Sign in'}
        </button>
      </p>
    </>}
    <p className="vendor-invitation__advisory">
      The role is limited to this vendor. Managers can manage menu items; staff can process orders and update availability.
    </p>
  </>;
}
