import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  IconChevronLeft,
  IconUser,
  IconMail,
  IconShield,
  IconCheck,
  IconX,
  IconUserCircle,
  IconBuildingStore,
  IconReceipt,
  IconClock,
  IconNotes,
  IconUserOff,
  IconLock,
  IconMessage,
  IconReload,
  IconEdit,
  IconInfoCircle,
} from '@tabler/icons-react';
import {
  ADMIN_PLATFORM_USERS,
  ALL_ROLES,
  formatCurrency,
} from './adminMockData.js';

const ALL_ROLES_BY_ID = ALL_ROLES.reduce((acc, role) => {
  acc[role.id] = role;
  return acc;
}, {});

const USER_ORDERS = [
  { id: '#48211', at: 'Today · 11:48', vendor: 'Library Bistro', total: 142.5, status: 'completed' },
  { id: '#48182', at: 'Yesterday · 13:12', vendor: 'Main Campus Cafe', total: 68.0, status: 'completed' },
  { id: '#48144', at: 'Mon · 12:30', vendor: 'Grill House Court', total: 96.0, status: 'completed' },
  { id: '#48120', at: 'Sun · 19:18', vendor: 'Dining Hall Central', total: 32.0, status: 'completed' },
  { id: '#48092', at: 'Fri · 12:04', vendor: 'Library Bistro', total: 124.5, status: 'refunded' },
];

const USER_AUDIT = [
  { id: 'l1', at: 'Today · 14:02', action: 'Placed order #48211', actor: 'User', target: 'Library Bistro' },
  { id: 'l2', at: 'Today · 11:48', action: 'Added card ending 6789', actor: 'User', target: 'Payment methods' },
  { id: 'l3', at: 'Yesterday · 17:11', action: 'Password changed', actor: 'User', target: 'Account security' },
  { id: 'l4', at: '3 days ago', action: 'Favourited Library Bistro', actor: 'User', target: 'Preferences' },
  { id: 'l5', at: '1 week ago', action: 'Refunded order #48092 by support', actor: 'Thuli M. (support)', target: 'Order detail' },
];

function Avatar({ name, size = 72 }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span className="admin-user-avatar admin-user-avatar--lg" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </span>
  );
}

function StatusPill({ status }) {
  const map = {
    active: { label: 'Active', tone: 'success' },
    pending: { label: 'Pending', tone: 'warning' },
    inactive: { label: 'Inactive', tone: 'info' },
  };
  const cfg = map[status] || { label: status, tone: 'info' };
  return <span className={`admin-status admin-status--${cfg.tone}`}>{cfg.label}</span>;
}

function RoleBadge({ role }) {
  const cfg = ALL_ROLES_BY_ID[role];
  if (!cfg) return <span className="admin-tag">{role}</span>;
  return <span className={`admin-tag admin-tag--${cfg.tone}`}>{cfg.label}</span>;
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="admin-vendor-info-row">
      <span className="admin-vendor-info-row__icon">
        <Icon size={14} stroke={1.8} />
      </span>
      <div className="admin-vendor-info-row__text">
        <span className="admin-vendor-info-row__label">{label}</span>
        <span className="admin-vendor-info-row__value">{value}</span>
      </div>
    </div>
  );
}

function RoleAssignmentModal({ user, onSave, onCancel }) {
  if (!user) return null;
  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <div className="admin-modal__overlay" onClick={onCancel} />
      <div className="admin-modal__card admin-modal__card--lg">
        <header className="admin-modal__head">
          <div className="admin-modal__icon admin-modal__icon--success">
            <IconShield size={20} stroke={2} />
          </div>
          <div>
            <h3 className="admin-modal__title">Manage roles</h3>
            <p className="admin-modal__sub">
              {user.name} · {user.number}
            </p>
          </div>
        </header>

        <p className="admin-modal__copy">
          Assign or remove platform roles. Changes apply on next sign-in and are logged to the audit trail.
        </p>

        <ul className="admin-role-list">
          {ALL_ROLES.map((role) => {
            const checked = user.roles.includes(role.id);
            return (
              <li key={role.id} className="admin-role-list__item">
                <input
                  type="checkbox"
                  id={`role-${role.id}`}
                  defaultChecked={checked}
                  className="admin-role-list__checkbox"
                />
                <label htmlFor={`role-${role.id}`} className="admin-role-list__label">
                  <span className={`admin-tag admin-tag--${role.tone}`}>{role.label}</span>
                  <span className="admin-role-list__hint">
                    {role.id === 'company_admin' && 'Full platform control and configuration access.'}
                    {role.id === 'finance' && 'Settlement, reconciliation and refund processing.'}
                    {role.id === 'support' && 'Order intervention, complaints and customer messages.'}
                    {role.id === 'vendor_staff' && 'Manage assigned vendor orders and menu updates.'}
                    {role.id === 'vendor_manager' && 'Vendor profile, staff and operating hours.'}
                    {role.id === 'employee' && 'Standard ordering and collection.'}
                    {role.id === 'executive_assistant' && 'Order on behalf of executives.'}
                    {role.id === 'event_organiser' && 'Submit and track corporate catering orders.'}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <label className="admin-modal__field">
          <span>Reason / audit note (required)</span>
          <textarea
            className="admin-modal__textarea"
            placeholder="e.g. promoted from vendor staff to vendor manager."
            rows={3}
          />
        </label>

        <footer className="admin-modal__foot">
          <button type="button" className="admin-action" onClick={onCancel}>Cancel</button>
          <button type="button" className="admin-action admin-action--approve" onClick={onSave}>
            <IconCheck size={13} stroke={2} />
            Save role changes
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function AdminUserDetail() {
  const { userId } = useParams();
  const user = useMemo(() => ADMIN_PLATFORM_USERS.find((u) => u.id === userId), [userId]);
  const [assigning, setAssigning] = useState(false);

  if (!user) {
    return (
      <div className="admin-empty">
        <IconUser size={32} stroke={1.4} />
        <h3>User not found</h3>
        <p>The user profile may have been archived.</p>
        <Link to="/admin/users" className="admin-action admin-action--approve">
          <IconChevronLeft size={13} stroke={2} />
          Back to users
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-order-detail">
      <Link to="/admin/users" className="admin-back-link">
        <IconChevronLeft size={14} stroke={2} />
        Back to users
      </Link>

      {/* Hero */}
      <section className={`admin-user-hero${user.status !== 'active' ? ' admin-user-hero--inactive' : ''}`}>
        <Avatar name={user.name} />
        <div className="admin-user-hero__info">
          <div className="admin-user-hero__head">
            <span className="admin-vendor-hero__slug">{user.number}</span>
            <StatusPill status={user.status} />
          </div>
          <h2 className="admin-user-hero__name">{user.name}</h2>
          <span className="admin-user-hero__email">{user.email}</span>

          <div className="admin-user-hero__roles">
            {user.roles.map((role) => (
              <RoleBadge key={role} role={role} />
            ))}
            {user.vendor && (
              <span className="admin-tag">
                <IconBuildingStore size={11} stroke={2} />
                {user.vendor}
              </span>
            )}
          </div>
        </div>
        <div className="admin-order-hero__actions">
          <button type="button" className="admin-action">
            <IconMessage size={14} stroke={2} />
            Message
          </button>
          {user.status === 'active' ? (
            <button type="button" className="admin-action admin-action--reject">
              <IconUserOff size={14} stroke={2} />
              Suspend
            </button>
          ) : (
            <button type="button" className="admin-action admin-action--approve">
              <IconCheck size={14} stroke={2} />
              Activate
            </button>
          )}
          <button
            type="button"
            className="admin-action admin-action--approve"
            onClick={() => setAssigning(true)}
          >
            <IconShield size={14} stroke={2} />
            Manage roles
          </button>
        </div>
      </section>

      <div className="admin-order-grid">
        <div className="admin-order-grid__main">
          {/* Recent orders */}
          {user.orders > 0 && (
            <section className="admin-card">
              <header className="admin-card__head">
                <div>
                  <span className="admin-card__eyebrow">{user.orders} lifetime orders</span>
                  <h3 className="admin-card__title">Recent activity</h3>
                </div>
                <span className="admin-card__chip">Last 7 days</span>
              </header>
              <ul className="admin-vendor-orders">
                {USER_ORDERS.map((order) => (
                  <li key={order.id} className="admin-vendor-order">
                    <div className="admin-vendor-order__head">
                      <span className="admin-vendor-order__id">{order.id}</span>
                      <span className="admin-vendor-order__total">{formatCurrency(order.total)}</span>
                    </div>
                    <div className="admin-vendor-order__meta">
                      <span>{order.at}</span>
                      <span>·</span>
                      <span>{order.vendor}</span>
                      <span>·</span>
                      <span className={`admin-vendor-order__status admin-vendor-order__status--${order.status}`}>
                        {order.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Audit log */}
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Audit trail</span>
                <h3 className="admin-card__title">Account activity</h3>
              </div>
              <span className="admin-card__chip">
                <IconReload size={13} stroke={2} /> Auto-refresh
              </span>
            </header>
            <ul className="admin-activity-list">
              {USER_AUDIT.map((entry) => (
                <li key={entry.id} className={`admin-activity admin-activity--info`}>
                  <span className="admin-activity__dot" aria-hidden="true" />
                  <div className="admin-activity__body">
                    <span className="admin-activity__line">
                      <strong>{entry.actor}</strong> {entry.action} <em>{entry.target}</em>
                    </span>
                    <span className="admin-activity__time">{entry.at}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="admin-order-grid__side">
          {/* Account info */}
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Identity</span>
                <h3 className="admin-card__title">Account details</h3>
              </div>
            </header>

            <div className="admin-vendor-section">
              <h4 className="admin-vendor-section__heading">Profile</h4>
              <InfoRow icon={IconUser} label="Name" value={user.name} />
              <InfoRow icon={IconInfoCircle} label="Employee #" value={user.number} />
              <InfoRow icon={IconMail} label="Email" value={user.email} />
              <InfoRow icon={IconClock} label="Joined" value={user.joinedAt} />
            </div>

            <div className="admin-vendor-section">
              <h4 className="admin-vendor-section__heading">Location & vendor</h4>
              <InfoRow icon={IconUserCircle} label="Campus" value={user.site} />
              <InfoRow icon={IconBuildingStore} label="Building" value={user.building} />
              {user.vendor && <InfoRow icon={IconBuildingStore} label="Vendor" value={user.vendor} />}
            </div>

            <div className="admin-vendor-section">
              <h4 className="admin-vendor-section__heading">Preferences</h4>
              <InfoRow
                icon={IconReceipt}
                label="Dietary"
                value={user.dietary?.length ? user.dietary.join(', ') : 'None'}
              />
              <InfoRow
                icon={IconBuildingStore}
                label="Favourites"
                value={`${user.favourites?.length || 0} vendors`}
              />
              <InfoRow
                icon={IconLock}
                label="Payment method"
                value={user.cardOnFile ? 'Card on file (tokenised)' : 'Not stored'}
              />
            </div>
          </section>

          {/* Tools */}
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Tools</span>
                <h3 className="admin-card__title">Quick actions</h3>
              </div>
            </header>
            <div className="admin-interventions">
              <button
                type="button"
                className="admin-intervention admin-intervention--info"
                onClick={() => setAssigning(true)}
              >
                <span className="admin-intervention__icon">
                  <IconShield size={16} stroke={1.8} />
                </span>
                <div className="admin-intervention__body">
                  <span className="admin-intervention__label">Assign or remove roles</span>
                  <span className="admin-intervention__desc">Open the role picker and update access.</span>
                </div>
              </button>
              <button type="button" className="admin-intervention admin-intervention--success">
                <span className="admin-intervention__icon">
                  <IconReload size={16} stroke={1.8} />
                </span>
                <div className="admin-intervention__body">
                  <span className="admin-intervention__label">Resend activation email</span>
                  <span className="admin-intervention__desc">Send a fresh verification link.</span>
                </div>
              </button>
              <button type="button" className="admin-intervention admin-intervention--warning">
                <span className="admin-intervention__icon">
                  <IconLock size={16} stroke={1.8} />
                </span>
                <div className="admin-intervention__body">
                  <span className="admin-intervention__label">Reset MFA / password</span>
                  <span className="admin-intervention__desc">Force re-authentication on next sign-in.</span>
                </div>
              </button>
              <button type="button" className="admin-intervention admin-intervention--error">
                <span className="admin-intervention__icon">
                  <IconUserOff size={16} stroke={1.8} />
                </span>
                <div className="admin-intervention__body">
                  <span className="admin-intervention__label">Deactivate account</span>
                  <span className="admin-intervention__desc">Immediate access revocation. Audit-logged.</span>
                </div>
              </button>
            </div>
          </section>
        </div>
      </div>

      <RoleAssignmentModal
        user={assigning ? user : null}
        onSave={() => setAssigning(false)}
        onCancel={() => setAssigning(false)}
      />
    </div>
  );
}
