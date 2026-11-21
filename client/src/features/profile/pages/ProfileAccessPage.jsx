import { useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth.js';
import { useFetch } from '../../../hooks/useFetch.js';
import { getProfileAccess } from '../../../services/profileApi.js';
import ProfileAccessSkeleton from '../ProfileAccessSkeleton.jsx';

const ROLE_LABELS = {
  employee: 'Employee',
  executive: 'Executive',
  executive_assistant: 'Executive Assistant',
  meeting_organiser: 'Meeting Organiser',
  training_coordinator: 'Training Coordinator',
  cost_centre_owner: 'Cost Centre Owner',
  vendor_staff: 'Vendor Staff',
  vendor_manager: 'Vendor Manager',
  admin: 'Administrator',
  finance: 'Finance',
  support: 'Technical Support',
  auditor: 'System Auditor',
};

function roleLabel(role) {
  if (!role) return '';
  return ROLE_LABELS[role] || String(role)
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function membershipRoleLabel(role) {
  if (role === 'manager') return roleLabel('vendor_manager');
  if (role === 'staff') return roleLabel('vendor_staff');
  return roleLabel(role);
}

function RoleBadges({ roles, emptyLabel }) {
  if (!roles?.length) return <p className="profile_empty">{emptyLabel}</p>;
  return (
    <div className="profile-access-badge-list">
      {roles.map((role) => (
        <span key={role} className="profile-access-badge">{roleLabel(role)}</span>
      ))}
    </div>
  );
}

function VendorAccessList({ memberships }) {
  if (!memberships?.length) return <p className="profile_empty">No active vendor access.</p>;
  return (
    <div className="profile-access-member-list">
      {memberships.map((membership) => (
        <div
          key={`${membership.vendor_id}-${membership.role}`}
          className="profile-access-member-row"
        >
          <div className="profile-access-member-main">
            <span className="profile-access-member-name">
              {membership.vendorName || 'Vendor'}
            </span>
            <span className="profile-access-member-meta">
              {membershipRoleLabel(membership.role)}
            </span>
          </div>
          <span className="profile-access-status">
            <span className="profile-access-status-dot" />
            Active
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ProfileAccessPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const fetchAccess = useCallback(
    ({ signal }) => getProfileAccess({ token, signal }),
    [token],
  );
  const { data, state, error, refetch } = useFetch(fetchAccess, { enabled: !!token });

  if (state === 'loading') return <ProfileAccessSkeleton />;

  if (state === 'error') {
    return (
      <section className="profile_section">
        <div className="profile_card" role="alert">
          <p className="profile_empty">{error?.message || 'We could not load your access details.'}</p>
          <button type="button" className="profile_link-button" onClick={refetch}>Try again</button>
        </div>
      </section>
    );
  }

  const memberships = data?.vendorMemberships || [];
  const vendorCount = new Set(memberships.map((membership) => membership.vendor_id).filter(Boolean)).size;

  return (
    <section className="profile_section">
      <header className="profile-access-header">
        <p className="profile_eyebrow">Account access</p>
        <h2 className="profile-access-title">Role &amp; access</h2>
        <p className="profile-access-subtitle">
          Roles are managed by your organisation. Contact an administrator to change access.
        </p>
      </header>

      <section className="profile_card">
        <div className="profile_card-header">
          <h3 className="profile_card-title">Access summary</h3>
        </div>
        <RoleBadges roles={data?.roles} emptyLabel="No roles assigned." />
        <dl className="profile-access-summary">
          <div className="profile-access-stat">
            <dt>Platform roles</dt>
            <dd>{data?.platformRoles?.length || 0}</dd>
          </div>
          <div className="profile-access-stat">
            <dt>Vendor roles</dt>
            <dd>{data?.vendorRoles?.length || 0}</dd>
          </div>
          <div className="profile-access-stat">
            <dt>Active vendors</dt>
            <dd>{vendorCount}</dd>
          </div>
        </dl>
      </section>

      <div className="profile-access-grid">
        <section className="profile_card">
          <div className="profile_card-header">
            <h3 className="profile_card-title">Platform roles</h3>
          </div>
          <RoleBadges roles={data?.platformRoles} emptyLabel="No platform roles assigned." />
        </section>

        <section className="profile_card">
          <div className="profile_card-header">
            <h3 className="profile_card-title">Vendor access</h3>
          </div>
          <VendorAccessList memberships={memberships} />
        </section>
      </div>
    </section>
  );
}
