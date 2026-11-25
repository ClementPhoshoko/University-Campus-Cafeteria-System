import { useCallback } from 'react';
import {
  IconBriefcase,
  IconBuildingStore,
  IconCalendarEvent,
  IconCash,
  IconCoins,
  IconFileSearch,
  IconHeadset,
  IconSchool,
  IconShield,
  IconUser,
  IconUsers,
} from '@tabler/icons-react';
import { useAuth } from '../../../hooks/useAuth.js';
import { useFetch } from '../../../hooks/useFetch.js';
import { getProfileAccess } from '../../../services/profileApi.js';
import ProfileAccessSkeleton from '../ProfileAccessSkeleton.jsx';
import AccessSectionHeader from '../components/AccessSectionHeader.jsx';
import AccessRoleCard from '../components/AccessRoleCard.jsx';
import AccessEmptyState from '../components/AccessEmptyState.jsx';

const ROLE_PRESENTATION = {
  employee: {
    label: 'Employee',
    description: 'Place personal orders and manage your own food preferences.',
    Icon: IconUser,
    tone: 'blue',
  },
  catering_requester: {
    label: 'Catering Requester',
    description: 'Submit, review and manage corporate catering requests, quotes and deliveries.',
    Icon: IconBriefcase,
    tone: 'blue',
  },
  executive: {
    label: 'Executive (legacy)',
    description: 'Legacy catering requester role. Catering Requester is now the single requester access role.',
    Icon: IconBriefcase,
    tone: 'blue',
  },
  executive_assistant: {
    label: 'Executive Assistant (legacy)',
    description: 'Legacy catering requester role. Catering Requester is now the single requester access role.',
    Icon: IconUsers,
    tone: 'blue',
  },
  meeting_organiser: {
    label: 'Meeting Organiser (legacy)',
    description: 'Legacy catering requester role. Catering Requester is now the single requester access role.',
    Icon: IconCalendarEvent,
    tone: 'blue',
  },
  training_coordinator: {
    label: 'Training Coordinator (legacy)',
    description: 'Legacy catering requester role. Catering Requester is now the single requester access role.',
    Icon: IconSchool,
    tone: 'blue',
  },
  cost_centre_owner: {
    label: 'Cost Centre Owner (legacy)',
    description: 'Legacy catering requester role. Catering Requester is now the single requester access role.',
    Icon: IconCoins,
    tone: 'blue',
  },
  vendor_staff: {
    label: 'Vendor Staff',
    description: 'Manage assigned vendor orders and menu updates.',
    Icon: IconBuildingStore,
    tone: 'purple',
  },
  vendor_manager: {
    label: 'Vendor Manager',
    description: 'Manage vendor operations, menus, and staff access.',
    Icon: IconBuildingStore,
    tone: 'purple',
  },
  admin: {
    label: 'Administrator',
    description: 'Manage platform users, configuration, and operational access.',
    Icon: IconShield,
    tone: 'blue',
  },
  finance: {
    label: 'Finance',
    description: 'Review financial activity, fees, and reconciliation.',
    Icon: IconCash,
    tone: 'blue',
  },
  support: {
    label: 'Technical Support',
    description: 'Assist users with ordering and account issues.',
    Icon: IconHeadset,
    tone: 'blue',
  },
  auditor: {
    label: 'System Auditor',
    description: 'Review operational activity and audit records.',
    Icon: IconFileSearch,
    tone: 'blue',
  },
};

function roleLabel(role) {
  return String(role || '')
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function presentationForRole(role) {
  const config = ROLE_PRESENTATION[role] || {};
  return {
    title: config.label || roleLabel(role),
    description: config.description || 'Platform access role.',
    Icon: config.Icon || IconShield,
    tone: config.tone || 'blue',
  };
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
      <div className="access-error-state" role="alert">
        <p>{error?.message || 'We could not load your access details.'}</p>
        <button type="button" className="profile_link-button" onClick={refetch}>Try again</button>
      </div>
    );
  }

  const roles = data?.roles || [];
  const vendorRoles = data?.vendorRoles || [];

  return (
    <div className="profile-access-page">
      <section className="profile-access-section" aria-labelledby="platform-roles-heading">
        <AccessSectionHeader
          icon={IconShield}
          tone="blue"
          headingId="platform-roles-heading"
          title="Platform roles"
          description="These roles define what you can do on the platform."
        />
        {roles.length ? (
          <div className="access-role-grid">
            {roles.map((role) => {
              const presentation = presentationForRole(role);
              const isVendorRole = vendorRoles.includes(role);
              return (
                <AccessRoleCard
                  key={role}
                  title={presentation.title}
                  description={presentation.description}
                  icon={presentation.Icon}
                  tone={isVendorRole ? 'purple' : presentation.tone}
                  source={isVendorRole ? 'Vendor role' : 'Platform role'}
                  active={roles.includes(role)}
                />
              );
            })}
          </div>
        ) : (
          <AccessEmptyState
            icon={IconShield}
            title="No roles assigned"
            description="Your assigned roles will appear here."
          />
        )}
      </section>
    </div>
  );
}
