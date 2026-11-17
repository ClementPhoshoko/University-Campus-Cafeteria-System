import { useCallback, useEffect, useState } from 'react';
import { IconArrowLeft, IconRefresh, IconUserPlus } from '@tabler/icons-react';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import { useConfirm } from '../../components/confirmation/ConfirmProvider.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { VendorTeamInvitationsSkeleton } from './VendorLoadingSkeletons.jsx';
import { deactivateMyVendorStaff, inviteVendorStaff, listMyVendorInvitations, listMyVendorStaff, revokeMyVendorInvitation } from '../../services/vendorApi.js';

const TEAM_PAGE_SIZE = 8;
const emptyPagination = { page: 1, limit: TEAM_PAGE_SIZE, total: 0, totalPages: 0 };

function formatExpiry(value) {
  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeZone: 'Africa/Johannesburg',
  }).format(new Date(value));
}

export default function VendorTeamManagementPage({ vendorId, vendorName, token, onBack }) {
  const confirm = useConfirm();
  const [email, setEmail] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [staff, setStaff] = useState([]);
  const [staffPage, setStaffPage] = useState(1);
  const [staffPagination, setStaffPagination] = useState(emptyPagination);
  const [invitationPage, setInvitationPage] = useState(1);
  const [invitationPagination, setInvitationPagination] = useState(emptyPagination);
  const [loading, setLoading] = useState(true);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState('');
  const [busy, setBusy] = useState(false);
  const [removingStaffId, setRemovingStaffId] = useState('');
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadInvitations = useCallback(async (page, signal) => {
    try {
      const response = await listMyVendorInvitations(vendorId, { token, page, limit: TEAM_PAGE_SIZE, signal });
      setInvitations(response.invitations || []);
      setInvitationPagination(response.pagination || emptyPagination);
      setLoadError('');
    } catch (loadFailure) {
      if (loadFailure.name !== 'AbortError') {
        setLoadError(loadFailure.message || 'Could not load staff invitations.');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [token, vendorId]);

  const loadStaff = useCallback(async (page, signal) => {
    try {
      const response = await listMyVendorStaff(vendorId, { token, page, limit: TEAM_PAGE_SIZE, signal });
      setStaff(response.staff || []);
      setStaffPagination(response.pagination || emptyPagination);
      setStaffError('');
    } catch (loadFailure) {
      if (loadFailure.name !== 'AbortError') setStaffError(loadFailure.message || 'Could not load active vendor staff.');
    } finally {
      if (!signal?.aborted) setStaffLoading(false);
    }
  }, [token, vendorId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setStaffLoading(true);
    loadInvitations(invitationPage, controller.signal);
    loadStaff(staffPage, controller.signal);
    return () => controller.abort();
  }, [loadInvitations, loadStaff, invitationPage, staffPage]);

  useEffect(() => {
    setStaffPage(1);
    setInvitationPage(1);
  }, [vendorId]);

  async function handleSubmit(event) {
    event.preventDefault();
    const inviteEmail = email.trim().toLowerCase();
    if (!inviteEmail || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await inviteVendorStaff(vendorId, inviteEmail, { token });
      if (invitationPage !== 1) setInvitationPage(1);
      setInvitations((current) => [
        response.invitation,
        ...current.filter((item) => item.email !== response.invitation.email || item.status !== 'pending'),
      ].slice(0, TEAM_PAGE_SIZE));
      setInvitationPagination((current) => ({ ...current, page: 1, total: current.total + 1, totalPages: Math.ceil((current.total + 1) / TEAM_PAGE_SIZE) }));
      setEmail('');
      setNotice(`Staff invitation sent to ${response.invitation.email}.`);
    } catch (submitError) {
      setError(submitError.message || 'Could not send this invitation.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(invitation) {
    if (!await confirm({ title: 'Revoke staff invitation?', message: `The invitation sent to ${invitation.email} will no longer be usable.`, confirmLabel: 'Revoke invitation', tone: 'danger' })) return;
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

  async function handleRemoveStaff(member) {
    const label = member.full_name || member.email || 'this staff member';
    if (!await confirm({ title: 'Remove staff access?', message: `${label} will lose access to ${vendorName || 'this vendor'}.`, confirmLabel: 'Remove access', tone: 'danger' })) return;
    setRemovingStaffId(member.user_id);
    setError('');
    setNotice('');
    try {
      const response = await deactivateMyVendorStaff(vendorId, member.user_id, { token });
      setStaff((current) => current.filter((staffMember) => staffMember.user_id !== member.user_id));
      const total = Math.max(0, staffPagination.total - 1);
      const totalPages = Math.ceil(total / TEAM_PAGE_SIZE);
      setStaffPagination((current) => ({ ...current, total, totalPages }));
      if (staff.length === 1 && staffPage > Math.max(1, totalPages)) setStaffPage(Math.max(1, totalPages));
      if (response.staff_member?.revoked_pending_invitations) {
        setInvitations((current) => current.map((invitation) => (
          invitation.email.trim().toLowerCase() === (member.email || '').trim().toLowerCase() && invitation.status === 'pending'
            ? { ...invitation, status: 'revoked' }
            : invitation
        )));
      }
      setNotice(`${label}'s vendor access was removed.`);
    } catch (removeError) {
      setError(removeError.message || 'Could not remove this staff member.');
    } finally {
      setRemovingStaffId('');
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

    <section className="vendor-team__list" aria-labelledby="vendor-team-staff-title">
      <header className="vendor-team__list-heading">
        <div>
          <h3 id="vendor-team-staff-title">Active staff</h3>
          <p>Managers can remove staff access. Manager access remains admin-controlled.</p>
        </div>
        <button className="vendor-team__refresh" type="button" onClick={() => { setStaffLoading(true); loadStaff(staffPage); }} disabled={staffLoading} aria-label="Refresh active staff">
          <IconRefresh size={17} />
        </button>
      </header>
      {staffError && <p className="vendor-ops-inline-error" role="alert">{staffError}</p>}
      {staffLoading && <VendorTeamInvitationsSkeleton label="Loading active vendor staff" />}
      {!staffLoading && !staffError && staff.length === 0 && <p className="vendor-team__empty">No active staff accounts yet.</p>}
      {!staffLoading && staff.map((member) => (
        <article className="vendor-team__member" key={member.user_id}>
          <div>
            <strong>{member.full_name || member.email || member.user_id}</strong>
            <span>{member.email || 'No email on file'}{member.employee_number ? ` · ${member.employee_number}` : ''}</span>
          </div>
          <button
            className="vendor-team__remove"
            type="button"
            onClick={() => handleRemoveStaff(member)}
            disabled={Boolean(removingStaffId)}
            aria-label={`Remove ${member.full_name || member.email || 'staff member'} from this vendor`}
          >
            {removingStaffId === member.user_id ? 'Removing…' : 'Remove access'}
          </button>
        </article>
      ))}
      {!staffLoading && <Pagination currentPage={staffPage} totalPages={staffPagination.totalPages} totalItems={staffPagination.total} itemsPerPage={TEAM_PAGE_SIZE} label="staff members" onPageChange={(page) => { setStaffLoading(true); setStaffPage(page); }} />}
    </section>

    <section className="vendor-team__list" aria-labelledby="vendor-team-invitations-title">
      <header>
        <h3 id="vendor-team-invitations-title">Staff invitations</h3>
        <p>Invite links expire after three South African business days.</p>
      </header>
      {loading && <VendorTeamInvitationsSkeleton />}
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
      {!loading && <Pagination currentPage={invitationPage} totalPages={invitationPagination.totalPages} totalItems={invitationPagination.total} itemsPerPage={TEAM_PAGE_SIZE} label="invitations" onPageChange={(page) => { setLoading(true); setInvitationPage(page); }} />}
    </section>
  </section>;
}
