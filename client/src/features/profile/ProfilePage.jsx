import { useState } from 'react';
import {
  IconUser,
  IconShield,
  IconHeart,
  IconSettings,
  IconLock,
} from '@tabler/icons-react';
import { useAuth } from '../../hooks/useAuth.js';
import { useRoles } from '../../hooks/useRoles.js';
import PageContainer from '../../components/layout/PageContainer.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import MainSidebar from '../../components/layout/MainSidebar.jsx';
import './profile.css';

const SIDEBAR_ITEMS = [
  { id: 'overview',    Icon: IconUser,    title: 'Overview',    subtitle: 'Personal & contact details' },
  { id: 'role',        Icon: IconShield,  title: 'Role & access', subtitle: 'Your permissions at Merchant Place' },
  { id: 'favourites',  Icon: IconHeart,   title: 'Favourites',  subtitle: 'Vendors & meals you love' },
  { id: 'preferences', Icon: IconSettings,title: 'Preferences', subtitle: 'Site & notification settings' },
  { id: 'security',    Icon: IconLock,    title: 'Security',    subtitle: 'Password & session management' },
];

const ROLE_LABELS = {
  employee:               'Employee',
  executive:              'Executive',
  executive_assistant:     'Executive Assistant',
  meeting_organiser:      'Meeting Organiser',
  training_coordinator:   'Training Coordinator',
  cost_centre_owner:      'Cost Centre Owner',
  vendor_staff:           'Vendor Staff',
  vendor_manager:         'Vendor Manager',
  admin:                  'Administrator',
  finance:                'Finance',
  support:                'Technical Support',
  auditor:                'System Auditor',
};

function OverviewSection({ profile }) {
  const { user } = useAuth();

  const rows = [
    { label: 'Full name',          value: profile?.full_name || '—' },
    { label: 'Employee number',     value: profile?.employee_number || '—' },
    { label: 'Email address',       value: profile?.email || user?.email || '—' },
    { label: 'Department',         value: profile?.department || '—' },
    { label: 'Business unit',       value: profile?.business_unit || '—' },
    { label: 'Cost centre',         value: profile?.cost_centre || '—' },
  ];

  return (
    <section className="profile_section">
      <div className="profile_card">
        <div className="profile_card-header">
          <h3 className="profile_card-title">Personal information</h3>
        </div>
        <dl className="profile_info-list">
          {rows.map(({ label, value }) => (
            <div key={label} className="profile_info-row">
              <dt className="profile_info-label">{label}</dt>
              <dd className="profile_info-value">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function RoleSection({ roles }) {
  return (
    <section className="profile_section">
      <div className="profile_card">
        <div className="profile_card-header">
          <h3 className="profile_card-title">Your roles</h3>
          <p className="profile_card-desc">These determine what you can see and do on Merchant Munchies.</p>
        </div>
        <div className="profile_role-list">
          {roles.length === 0 ? (
            <p className="profile_empty">No roles assigned yet.</p>
          ) : (
            roles.map((role) => (
              <div key={role} className="profile_role-item">
                <span className="profile_role-badge">{ROLE_LABELS[role] || role}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function FavouritesSection() {
  return (
    <section className="profile_section">
      <div className="profile_card">
        <div className="profile_card-header">
          <h3 className="profile_card-title">Saved vendors &amp; meals</h3>
        </div>
        <div className="profile_empty-state">
          <IconHeart size={40} stroke={1.4} className="profile_empty-icon" />
          <p className="profile_empty-headline">No favourites yet</p>
          <p className="profile_empty-desc">
            When you favourite a vendor or meal, it will appear here for quick access.
          </p>
        </div>
      </div>
    </section>
  );
}

function PreferencesSection({ profile }) {
  return (
    <section className="profile_section">
      <div className="profile_card">
        <div className="profile_card-header">
          <h3 className="profile_card-title">Notification preferences</h3>
        </div>
        <div className="profile_toggle-list">
          <label className="profile_toggle">
            <span className="profile_toggle-text">
              <span className="profile_toggle-label">Order updates</span>
              <span className="profile_toggle-desc">Get notified when your order status changes</span>
            </span>
            <input
              type="checkbox"
              className="profile_toggle-input"
              defaultChecked={
                profile?.notification_preferences?.order_updates !== false
              }
            />
          </label>
          <label className="profile_toggle">
            <span className="profile_toggle-text">
              <span className="profile_toggle-label">Promotions &amp; offers</span>
              <span className="profile_toggle-desc">News about new vendors and special deals</span>
            </span>
            <input
              type="checkbox"
              className="profile_toggle-input"
              defaultChecked={profile?.notification_preferences?.promotions}
            />
          </label>
          <label className="profile_toggle">
            <span className="profile_toggle-text">
              <span className="profile_toggle-label">Collection reminders</span>
              <span className="profile_toggle-desc">Remind me before my order is ready for collection</span>
            </span>
            <input
              type="checkbox"
              className="profile_toggle-input"
              defaultChecked={
                profile?.notification_preferences?.collection_reminders !== false
              }
            />
          </label>
        </div>
      </div>
    </section>
  );
}

function SecuritySection({ user }) {
  return (
    <section className="profile_section">
      <div className="profile_card">
        <div className="profile_card-header">
          <h3 className="profile_card-title">Password</h3>
        </div>
        <p className="profile_card-desc">
          Password management is handled through your company identity provider.
        </p>
        <button type="button" className="profile_btn profile_btn--secondary">
          Reset password
        </button>
      </div>

      <div className="profile_card" style={{ marginTop: 'var(--space-4)' }}>
        <div className="profile_card-header">
          <h3 className="profile_card-title">Active sessions</h3>
        </div>
        <p className="profile_card-desc">You are currently signed in on this device.</p>
        <button type="button" className="profile_btn profile_btn--danger">
          Sign out of this device
        </button>
      </div>
    </section>
  );
}

const SECTION_MAP = {
  overview:    OverviewSection,
  role:        RoleSection,
  favourites:  FavouritesSection,
  preferences: PreferencesSection,
  security:    SecuritySection,
};

export default function ProfilePage() {
  const { profile, user } = useAuth();
  const { roles, loading } = useRoles();
  const [active, setActive] = useState('overview');

  const ActiveSection = SECTION_MAP[active];

  return (
    <PageContainer>
      <div className="profile_page">
        <aside className="profile_sidebar">
          <MainSidebar
            items={SIDEBAR_ITEMS}
            active={active}
            onSelect={setActive}
            heading="Account"
          />
        </aside>

        <main className="profile_content">
          <PageHeader
            title="My Profile"
            subtitle="Manage your account details and preferences"
          />
          {loading ? (
            <div className="profile_loading">
              <div className="profile_loading-bar" />
              <div className="profile_loading-bar profile_loading-bar--short" />
            </div>
          ) : (
            <ActiveSection profile={profile} roles={roles} user={user} />
          )}
        </main>
      </div>
    </PageContainer>
  );
}
