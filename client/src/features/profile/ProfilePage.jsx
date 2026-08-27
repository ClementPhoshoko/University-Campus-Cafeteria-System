import { useEffect, useState } from 'react';
import {
  IconUser,
  IconShield,
  IconHeart,
  IconSettings,
  IconLock,
  IconBuilding,
  IconMapPin,
  IconToolsKitchen2,
  IconAlertTriangle,
  IconBell,
  IconPencil,
  IconCheck,
  IconX,
  IconStar,
} from '@tabler/icons-react';
import { useAuth } from '../../hooks/useAuth.js';
import { useRoles } from '../../hooks/useRoles.js';
import PageContainer from '../../components/layout/PageContainer.jsx';
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

const ROLE_DESCRIPTIONS = {
  employee: 'Place personal orders and manage your own food preferences.',
  executive: 'Access executive-level ordering and corporate catering workflows.',
  executive_assistant: 'Coordinate orders and catering on behalf of executives.',
  meeting_organiser: 'Arrange food and delivery details for workplace meetings.',
  training_coordinator: 'Organise catering for training sessions and programmes.',
  cost_centre_owner: 'Review and approve orders charged to assigned cost centres.',
  vendor_staff: 'Prepare and manage orders for an assigned vendor.',
  vendor_manager: 'Manage vendor operations, menus, and staff access.',
  admin: 'Manage platform users, configuration, and operational access.',
  finance: 'Review financial activity, fees, settlements, and reconciliation.',
  support: 'Assist users and investigate ordering or account issues.',
  auditor: 'Review operational activity and security audit records.',
};

function OverviewSection({ profile, onSave }) {
  const [editing, setEditing] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [draft, setDraft] = useState({
    full_name: profile?.full_name || '',
    department: profile?.department || '',
    business_unit: profile?.business_unit || '',
    cost_centre: profile?.cost_centre || '',
  });
  const [locationDraft, setLocationDraft] = useState({
    preferred_site_id: profile?.preferred_site_id || '',
    preferred_building_id: profile?.preferred_building_id || '',
  });

  useEffect(() => {
    setDraft({
      full_name: profile?.full_name || '',
      department: profile?.department || '',
      business_unit: profile?.business_unit || '',
      cost_centre: profile?.cost_centre || '',
    });
    setLocationDraft({
      preferred_site_id: profile?.preferred_site_id || '',
      preferred_building_id: profile?.preferred_building_id || '',
    });
  }, [profile]);

  const save = () => {
    onSave(draft);
    setEditing(false);
  };

  const saveLocation = () => {
    onSave(locationDraft);
    setEditingLocation(false);
  };

  const workplaceRows = [
    { label: 'Department', value: profile?.department || 'Not set' },
    { label: 'Business unit', value: profile?.business_unit || 'Not set' },
    { label: 'Cost centre', value: profile?.cost_centre || 'Not set' },
  ];

  return (
    <section className="profile_section">
      <div className="profile_editable-group">
        <div className="profile_section-toolbar">
          <div className="profile_section-label">Personal and workplace information</div>
          <EditActions editing={editing} onEdit={() => setEditing(true)} onCancel={() => setEditing(false)} onSave={save} />
        </div>
        {editing ? (
            <div className="profile_edit-grid">
            <ProfileInput label="Full name" value={draft.full_name} onChange={(value) => setDraft({ ...draft, full_name: value })} />
            <ProfileInput label="Department" value={draft.department} onChange={(value) => setDraft({ ...draft, department: value })} />
            <ProfileInput label="Business unit" value={draft.business_unit} onChange={(value) => setDraft({ ...draft, business_unit: value })} />
            <ProfileInput label="Cost centre" value={draft.cost_centre} onChange={(value) => setDraft({ ...draft, cost_centre: value })} />
          </div>
        ) : (
          <>
            <ProfileAttributeCard title="Workplace information" Icon={IconBuilding} rows={workplaceRows} />
            <dl className="profile_info-list profile_info-list--personal">
              <div className="profile_info-row"><dt className="profile_info-label">Full name</dt><dd className="profile_info-value">{profile?.full_name || 'Not set'}</dd></div>
              <div className="profile_info-row"><dt className="profile_info-label">Email address</dt><dd className="profile_info-value">{profile?.email || 'Not set'}</dd></div>
              <div className="profile_info-row"><dt className="profile_info-label">Employee number</dt><dd className="profile_info-value">{profile?.employee_number || 'Not set'}</dd></div>
            </dl>
          </>
        )}
      </div>
      <div className="profile_card profile_card--accent">
          <div className="profile_card-header">
          <div className="profile_card-heading">
            <IconMapPin size={18} stroke={1.8} />
            <h3 className="profile_card-title">Food ordering location</h3>
          </div>
          <EditActions editing={editingLocation} onEdit={() => setEditingLocation(true)} onCancel={() => setEditingLocation(false)} onSave={saveLocation} />
        </div>
        {editingLocation ? (
          <div className="profile_edit-grid profile_edit-grid--location">
            <ProfileInput label="Preferred site" value={locationDraft.preferred_site_id} onChange={(value) => setLocationDraft({ ...locationDraft, preferred_site_id: value })} />
            <ProfileInput label="Preferred building" value={locationDraft.preferred_building_id} onChange={(value) => setLocationDraft({ ...locationDraft, preferred_building_id: value })} />
          </div>
        ) : (
          <div className="profile_location-grid">
            <ProfileLocation label="Preferred site" value={profile?.preferred_site_id} />
            <ProfileLocation label="Preferred building" value={profile?.preferred_building_id} />
          </div>
        )}
      </div>
    </section>
  );
}

function EditActions({ editing, onEdit, onCancel, onSave }) {
  return editing ? (
    <span className="profile_edit-actions">
      <button type="button" className="profile_text-button" onClick={onCancel}><IconX size={15} /> Cancel</button>
      <button type="button" className="profile_text-button profile_text-button--primary" onClick={onSave}><IconCheck size={15} /> Save</button>
    </span>
  ) : (
    <button type="button" className="profile_text-button" onClick={onEdit}><IconPencil size={15} /> Edit</button>
  );
}

function ProfileInput({ label, value, onChange }) {
  return (
    <label className="profile_input-field">
      <span className="profile_input-label">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ProfileAttributeCard({ title, Icon, rows }) {
  return (
    <div className="profile_card">
          <div className="profile_card-header">
        <div className="profile_card-heading">
          <Icon size={18} stroke={1.8} />
          <h3 className="profile_card-title">{title}</h3>
        </div>
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
  );
}

function ProfileLocation({ label, value }) {
  return (
    <div className="profile_location-item">
      <span className="profile_info-label">{label}</span>
      <span className="profile_info-value">{value || 'Not set'}</span>
    </div>
  );
}

function ProfileIntro({ profile, user }) {
  const name = profile?.full_name || 'Your profile';
  const isMissingFields = [
    profile?.full_name,
    profile?.employee_number,
    profile?.email || user?.email,
    profile?.department,
    profile?.business_unit,
    profile?.cost_centre,
    profile?.preferred_site_id,
    profile?.preferred_building_id,
  ].some((value) => !value);

  return (
    <section className="profile_intro" aria-label="Profile summary">
      <div className="profile_hero-copy">
        <p className="profile_eyebrow">Account overview</p>
        <h1 className="profile_hero-name">{name}</h1>
      </div>
      <div className="profile_hero-meta">
        <span className={`profile_status-pill${profile?.is_active === false ? ' profile_status-pill--inactive' : ''}`}>
          <span className="profile_status-dot" />
          {profile?.is_active === false ? 'Inactive' : 'Active'}
        </span>
        {isMissingFields && (
          <span className="profile_hero-number">Some details are missing from your profile.</span>
        )}
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
        </div>
        <div className="profile_role-list">
          {roles.length === 0 ? (
            <p className="profile_empty">No roles assigned yet.</p>
          ) : (
            roles.map((role) => (
              <div key={role} className="profile_role-item">
                <span className="profile_role-title">{ROLE_LABELS[role] || role}</span>
                <span className="profile_role-description">
                  {ROLE_DESCRIPTIONS[role] || 'Access granted by your organisation.'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

const SAMPLE_FAVOURITE_VENDORS = [
  { name: 'The Daily Grind', detail: 'Coffee, breakfast & light meals', rating: '4.8' },
  { name: 'Green Table Kitchen', detail: 'Fresh bowls & wholesome plates', rating: '4.7' },
];

const SAMPLE_FAVOURITE_MEALS = [
  { name: 'Grilled Chicken Wrap', vendor: 'The Daily Grind', price: 'R68.00' },
  { name: 'Roasted Vegetable Bowl', vendor: 'Green Table Kitchen', price: 'R74.00' },
  { name: 'Iced Vanilla Latte', vendor: 'The Daily Grind', price: 'R32.00' },
];

function FavouritesSection() {
  const [vendors, setVendors] = useState(SAMPLE_FAVOURITE_VENDORS);
  const [meals, setMeals] = useState(SAMPLE_FAVOURITE_MEALS);

  return (
    <section className="profile_section">
      <div className="profile_favourites-intro">
        <p className="profile_eyebrow">Your shortlist</p>
        <h2 className="profile_favourites-title">Saved vendors and meals</h2>
        <p className="profile_section-note">Keep the places and dishes you return to close at hand.</p>
      </div>
      <div className="profile_favourites-grid">
        <div className="profile_card">
          <div className="profile_card-header">
            <h3 className="profile_card-title">Favourite vendors</h3>
            <span className="profile_favourites-count">{vendors.length}</span>
          </div>
          <div className="profile_favourite-list">
            {vendors.map((vendor) => (
              <div key={vendor.name} className="profile_favourite-item">
                <div>
                  <div className="profile_favourite-title-row">
                    <strong className="profile_favourite-name">{vendor.name}</strong>
                    <button type="button" className="profile_favourite-remove" aria-label={`Remove ${vendor.name} from favourites`} onClick={() => setVendors((current) => current.filter((item) => item.name !== vendor.name))}>
                      <IconX size={14} stroke={2} />
                    </button>
                  </div>
                  <span className="profile_favourite-detail">{vendor.detail}</span>
                </div>
                <span className="profile_favourite-rating"><IconStar size={14} /> {vendor.rating}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="profile_card">
          <div className="profile_card-header">
            <h3 className="profile_card-title">Favourite meals</h3>
            <span className="profile_favourites-count">{meals.length}</span>
          </div>
          <div className="profile_favourite-list">
            {meals.map((meal) => (
              <div key={meal.name} className="profile_favourite-item">
                <div>
                  <div className="profile_favourite-title-row">
                    <strong className="profile_favourite-name">{meal.name}</strong>
                    <button type="button" className="profile_favourite-remove" aria-label={`Remove ${meal.name} from favourites`} onClick={() => setMeals((current) => current.filter((item) => item.name !== meal.name))}>
                      <IconX size={14} stroke={2} />
                    </button>
                  </div>
                  <span className="profile_favourite-detail">{meal.vendor}</span>
                </div>
                <span className="profile_favourite-price">{meal.price}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PreferencesSection({ profile, onSave }) {
  const [editingFood, setEditingFood] = useState(false);
  const dietaryPreferences = Array.isArray(profile?.dietary_preferences)
    ? profile.dietary_preferences
    : [];
  const allergyIndicators = Array.isArray(profile?.allergy_indicators)
    ? profile.allergy_indicators
    : [];
  const [foodDraft, setFoodDraft] = useState({
    dietary_preferences: dietaryPreferences.join(', '),
    allergy_indicators: allergyIndicators.join(', '),
  });
  const [notificationDraft, setNotificationDraft] = useState({
    order_updates: profile?.notification_preferences?.order_updates !== false,
    promotions: profile?.notification_preferences?.promotions === true,
    collection_reminders: profile?.notification_preferences?.collection_reminders !== false,
  });

  useEffect(() => {
    setFoodDraft({
      dietary_preferences: dietaryPreferences.join(', '),
      allergy_indicators: allergyIndicators.join(', '),
    });
    setNotificationDraft({
      order_updates: profile?.notification_preferences?.order_updates !== false,
      promotions: profile?.notification_preferences?.promotions === true,
      collection_reminders: profile?.notification_preferences?.collection_reminders !== false,
    });
  }, [profile]);

  const saveFood = () => {
    onSave({
      dietary_preferences: foodDraft.dietary_preferences.split(',').map((item) => item.trim()).filter(Boolean),
      allergy_indicators: foodDraft.allergy_indicators.split(',').map((item) => item.trim()).filter(Boolean),
    });
    setEditingFood(false);
  };

  const updateNotification = (key, value) => {
    const next = { ...notificationDraft, [key]: value };
    setNotificationDraft(next);
    onSave({ notification_preferences: {
      ...profile?.notification_preferences,
      ...next,
    }});
  };

  return (
    <section className="profile_section profile_section--preferences">
      <div className="profile_card profile_card--feature">
        <div className="profile_card-header">
          <div className="profile_card-heading">
            <IconToolsKitchen2 size={18} stroke={1.8} />
            <h3 className="profile_card-title">Food preferences</h3>
          </div>
          <EditActions editing={editingFood} onEdit={() => setEditingFood(true)} onCancel={() => setEditingFood(false)} onSave={saveFood} />
        </div>
        {editingFood ? (
          <div className="profile_edit-grid">
            <ProfileInput label="Dietary preferences" value={foodDraft.dietary_preferences} onChange={(value) => setFoodDraft({ ...foodDraft, dietary_preferences: value })} />
            <ProfileInput label="Allergy indicators" value={foodDraft.allergy_indicators} onChange={(value) => setFoodDraft({ ...foodDraft, allergy_indicators: value })} />
          </div>
        ) : (
          <>
            <ProfileTagGroup label="Dietary preferences" values={dietaryPreferences} />
            <ProfileTagGroup label="Allergy indicators" values={allergyIndicators} warning />
          </>
        )}
      </div>

      <div className="profile_card profile_card--quiet">
          <div className="profile_card-header">
          <div className="profile_card-heading">
            <IconBell size={18} stroke={1.8} />
            <h3 className="profile_card-title">Notification preferences</h3>
          </div>
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
              checked={notificationDraft.order_updates}
              onChange={(event) => updateNotification('order_updates', event.target.checked)}
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
              checked={notificationDraft.promotions}
              onChange={(event) => updateNotification('promotions', event.target.checked)}
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
              checked={notificationDraft.collection_reminders}
              onChange={(event) => updateNotification('collection_reminders', event.target.checked)}
            />
          </label>
        </div>
      </div>

    </section>
  );
}

function ProfileTagGroup({ label, values, warning = false }) {
  return (
    <div className="profile_tag-group">
      <span className="profile_info-label">{label}</span>
      {values.length > 0 ? (
        <div className="profile_tag-list">
          {values.map((value) => (
            <span key={value} className={`profile_tag${warning ? ' profile_tag--warning' : ''}`}>
              {warning && <IconAlertTriangle size={13} stroke={2} />}
              {value}
            </span>
          ))}
        </div>
      ) : (
        <span className="profile_empty">Not set</span>
      )}
    </div>
  );
}

function SecuritySection({ user }) {
  return (
    <section className="profile_section">
      <div className="profile_card">
        <div className="profile_card-header">
          <h3 className="profile_card-title">Password</h3>
        </div>
        <p className="profile_section-note">Password management is handled through your company identity provider.</p>
        <button type="button" className="profile_btn profile_btn--secondary">
          Reset password
        </button>
      </div>

      <div className="profile_card" style={{ marginTop: 'var(--space-4)' }}>
        <div className="profile_card-header">
          <h3 className="profile_card-title">Active sessions</h3>
        </div>
        <p className="profile_section-note">You are currently signed in on this device.</p>
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
  const [displayProfile, setDisplayProfile] = useState(profile);

  useEffect(() => {
    setDisplayProfile(profile);
  }, [profile]);

  const saveProfile = (changes) => {
    setDisplayProfile((current) => ({ ...current, ...changes }));
  };

  const ActiveSection = SECTION_MAP[active];

  return (
    <PageContainer className="profile_page-container">
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
          <ProfileIntro profile={displayProfile} user={user} />
          {loading ? (
            <div className="profile_loading">
              <div className="profile_loading-bar" />
              <div className="profile_loading-bar profile_loading-bar--short" />
            </div>
          ) : (
            <ActiveSection profile={displayProfile} roles={roles} user={user} onSave={saveProfile} />
          )}
        </main>
      </div>
    </PageContainer>
  );
}
