import { useCallback, useEffect, useState } from 'react';
import { IconArrowLeft, IconUserPlus } from '@tabler/icons-react';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import { inviteVendorStaff, listMyVendorInvitations, revokeMyVendorInvitation } from '../../services/vendorApi.js';

function formatExpiry(value) {
  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeZone: 'Africa/Johannesburg',
  }).format(new Date(value));
}

export default function VendorTeamManagementPage({ vendorId, vendorName, token, onBack }) {
  const [email, setEmail] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadInvitations = useCallback(async (signal) => {
    try {
      const response = await listMyVendorInvitations(vendorId, { token, signal });
      setInvitations(response.invitations || []);
      setLoadError('');
    } catch (loadFailure) {
      if (loadFailure.name !== 'AbortError') {
        setLoadError(loadFailure.message || 'Could not load staff invitations.');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [token, vendorId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    loadInvitations(controller.signal);
    return () => controller.abort();
  }, [loadInvitations]);

  async function handleSubmit(event) {
    event.preventDefault();
    const inviteEmail = email.trim().toLowerCase();
    if (!inviteEmail || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await inviteVendorStaff(vendorId, inviteEmail, { token });
      setInvitations((current) => [
        response.invitation,
        ...current.filter((item) => item.email !== response.invitation.email || item.status !== 'pending'),
      ].slice(0, 30));
      setEmail('');
      setNotice(`Staff invitation sent to ${response.invitation.email}.`);
    } catch (submitError) {
      setError(submitError.message || 'Could not send this invitation.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(invitation) {
    if (!window.confirm(`Revoke the staff invitation for ${invitation.email}?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await revokeMyVendorInvitation(invitation.id, { token });
      setInvitations((current) => current.map((item) => item.id === invitation.id ? response.invitation : item));
      setNotice(`Invitation for ${invitation.email} revoked.`);
    } catch (revokeError) {
      setError(revokeError.message || 'Could not revoke this invitation.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="vendor-team" aria-labelledby="vendor-team-title">
    <header className="vendor-team__heading">
      <div>
        <p>Manager workspace</p>
        <h2 id="vendor-team-title">Team access</h2>
        <span>Invite staff to {vendorName || 'your vendor'}.</span>
      </div>
      <PrimaryButton size="sm" icon={IconArrowLeft} onClick={onBack}>Back to orders</PrimaryButton>
    </header>

    <p className="vendor-team__advisory">
      Managers can invite staff for this vendor only. Administrators remain responsible for assigning manager access.
    </p>

    {error && <p className="vendor-ops-inline-error" role="alert">{error}</p>}
    {notice && <p className="vendor-ops-notice" role="status">{notice}</p>}
    {loadError && <p className="vendor-ops-inline-error" role="alert">{loadError}</p>}

    <form className="vendor-team__form" onSubmit={handleSubmit}>
      <label className="vendor-team__field">
        Staff member email
        <input
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <PrimaryButton type="submit" size="md" icon={IconUserPlus} disabled={busy || !email.trim()}>
        {busy ? 'Sending…' : 'Invite staff'}
      </PrimaryButton>
    </form>

    <section className="vendor-team__list" aria-labelledby="vendor-team-invitations-title">
      <header>
        <h3 id="vendor-team-invitations-title">Staff invitations</h3>
        <p>Invite links expire after three South African business days.</p>
      </header>
      {loading && <p className="vendor-team__empty">Loading invitations…</p>}
      {!loading && !loadError && invitations.length === 0 && (
        <p className="vendor-team__empty">No staff invitations yet.</p>
      )}
      {!loading && invitations.map((invitation) => (
        <article className="vendor-team__invitation" key={invitation.id}>
          <div>
            <strong>{invitation.email}</strong>
            <span>
              Staff · {invitation.status}
              {invitation.status === 'pending' && ` · Expires ${formatExpiry(invitation.expires_at)} (SAST)`}
            </span>
          </div>
          {invitation.status === 'pending' && (
            <PrimaryButton size="sm" className="primary-btn primary-btn--sm vendor-menu-danger-button" onClick={() => handleRevoke(invitation)} disabled={busy}>
              Revoke
            </PrimaryButton>
          )}
        </article>
      ))}
    </section>
  </section>;
}
