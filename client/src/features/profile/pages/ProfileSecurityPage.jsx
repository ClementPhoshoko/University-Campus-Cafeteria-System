import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

export default function ProfileSecurityPage() {
  const { signOut } = useOutletContext();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setSignOutError('');
    try {
      await signOut();
    } catch (error) {
      setSignOutError(error?.message || 'Could not sign out. Please try again.');
      setIsSigningOut(false);
    }
  };

  return (
    <section className="profile_section">
      <div className="profile_card">
        <div className="profile_card-header">
          <h3 className="profile_card-title">Password</h3>
        </div>
        <p className="profile_section-note">
          Reset your password with the same email verification flow used on the sign-in page.
        </p>
        <button
          type="button"
          className="profile_btn profile_btn--secondary"
          onClick={() => navigate('/forgot-password', { state: { fromProfile: true } })}
        >
          Reset password
        </button>
      </div>

      <div className="profile_card">
        <div className="profile_card-header">
          <h3 className="profile_card-title">Active sessions</h3>
        </div>
        <p className="profile_section-note">
          You are currently signed in on this device. Signing out here affects only this device.
        </p>
        {signOutError && <p className="profile_section-note" role="alert">{signOutError}</p>}
        <button type="button" className="profile_btn profile_btn--danger" onClick={handleSignOut} disabled={isSigningOut}>
          {isSigningOut ? 'Signing out…' : 'Sign out of this device'}
        </button>
      </div>
    </section>
  );
}
