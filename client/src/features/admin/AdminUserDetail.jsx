import { useMemo, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  IconChevronLeft,
  IconChevronRight,
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
import Breadcrumb from '../../components/ui/Breadcrumb.jsx';
import {
  ADMIN_PLATFORM_USERS,
  ALL_ROLES,
  formatCurrency,
} from './adminMockData.js';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.png';

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
  { id: '#48057', at: 'Thu · 18:33', vendor: 'Science Block Café', total: 54.0, status: 'completed' },
  { id: '#48021', at: 'Wed · 13:15', vendor: 'Library Bistro', total: 89.0, status: 'completed' },
  { id: '#47988', at: 'Tue · 20:05', vendor: 'Main Campus Cafe', total: 112.5, status: 'completed' },
  { id: '#47955', at: 'Mon · 12:45', vendor: 'Grill House Court', total: 76.0, status: 'refunded' },
  { id: '#47912', at: 'Sun · 19:30', vendor: 'Dining Hall Central', total: 45.5, status: 'completed' },
  { id: '#47880', at: 'Sat · 14:20', vendor: 'Library Bistro', total: 98.0, status: 'completed' },
  { id: '#47841', at: 'Fri · 11:00', vendor: 'Science Block Café', total: 67.5, status: 'completed' },
  { id: '#47805', at: 'Thu · 17:55', vendor: 'Main Campus Cafe', total: 134.0, status: 'completed' },
  { id: '#47770', at: 'Wed · 12:30', vendor: 'Grill House Court', total: 58.0, status: 'refunded' },
  { id: '#47733', at: 'Tue · 19:45', vendor: 'Library Bistro', total: 145.0, status: 'completed' },
];

const USER_AUDIT = [
  { id: 'l1', at: 'Today · 14:02', action: 'Placed order #48211', actor: 'User', target: 'Library Bistro' },
  { id: 'l2', at: 'Today · 11:48', action: 'Added card ending 6789', actor: 'User', target: 'Payment methods' },
  { id: 'l3', at: 'Yesterday · 17:11', action: 'Password changed', actor: 'User', target: 'Account security' },
  { id: 'l4', at: '3 days ago', action: 'Favourited Library Bistro', actor: 'User', target: 'Preferences' },
  { id: 'l5', at: '1 week ago', action: 'Refunded order #48092 by support', actor: 'Thuli M. (support)', target: 'Order detail' },
  { id: 'l6', at: '1 week ago', action: 'Updated profile photo', actor: 'User', target: 'Account settings' },
  { id: 'l7', at: '2 weeks ago', action: 'Placed order #47988', actor: 'User', target: 'Main Campus Cafe' },
  { id: 'l8', at: '2 weeks ago', action: 'Logged in from new device', actor: 'User', target: 'Device: MacBook Pro' },
  { id: 'l9', at: '2 weeks ago', action: 'Added campus building', actor: 'User', target: 'Engineering Block' },
  { id: 'l10', at: '3 weeks ago', action: 'Submitted complaint #312', actor: 'User', target: 'Order #47955' },
  { id: 'l11', at: '3 weeks ago', action: 'Subscribed to newsletter', actor: 'User', target: 'Marketing preferences' },
  { id: 'l12', at: '1 month ago', action: 'Activated account', actor: 'System', target: 'Welcome email sent' },
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

function formatSeenTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
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

function QuickActionRow({ icon: Icon, title, description, variant, onClick }) {
  return (
    <button type="button" className="admin-quick-action-row" onClick={onClick}>
      <span className={`admin-quick-action-row__icon admin-quick-action-row__icon--${variant}`}>
        <Icon size={16} stroke={1.8} />
      </span>
      <div className="admin-quick-action-row__body">
        <span className="admin-quick-action-row__label">{title}</span>
        <span className="admin-quick-action-row__desc">{description}</span>
      </div>
      <span className="admin-quick-action-row__chevron">
        <IconChevronRight size={16} stroke={2} />
      </span>
    </button>
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
              {user.full_name} · {user.employee_number}
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
                    {role.id === 'admin' && 'Full platform control and configuration access.'}
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
  const [orderCount, setOrderCount] = useState(6);
  const [orderLoading, setOrderLoading] = useState(false);
  const [auditCount, setAuditCount] = useState(6);
  const [auditLoading, setAuditLoading] = useState(false);

  const handleLoadMoreOrders = () => {
    setOrderLoading(true);
    setTimeout(() => {
      setOrderCount((c) => Math.min(c + 5, USER_ORDERS.length));
      setOrderLoading(false);
    }, 600);
  };

  const handleLoadMoreAudit = () => {
    setAuditLoading(true);
    setTimeout(() => {
      setAuditCount((c) => Math.min(c + 5, USER_AUDIT.length));
      setAuditLoading(false);
    }, 600);
  };

  if (!user) {
    return (
      <div className="admin-empty">
        <img src={emptyStateAvatar} alt="" className="admin-empty__avatar" />
        <h3>User not found</h3>
        <p>The user profile may have been archived.</p>
        <Link to="/admin/users" className="admin-action--ghost">
          <IconChevronLeft size={13} stroke={2} />
          Back to users
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-user-detail-wrapper">
      <Breadcrumb
        homeLabel="Dashboard"
        homeTo="/admin"
        items={[
          { label: 'Users', to: '/admin/users' },
          { label: user.full_name }
        ]}
      />

      {/* Hero */}
      <section className={`admin-user-hero${!user.is_active ? ' admin-user-hero--inactive' : ''}`}>
        <div className="admin-user-hero__avatar">
          <Avatar name={user.full_name} />
        </div>
        <div className="admin-user-hero__info">
          <div className="admin-user-hero__head">
            <span className="admin-user-hero__slug">{user.employee_number}</span>
            <StatusPill status={user.is_active ? 'active' : 'inactive'} />
          </div>
          <h2 className="admin-user-hero__name">{user.full_name}</h2>
          <span className="admin-user-hero__email">{user.email}</span>
          <div className="admin-user-hero__roles">
            {user.roles.map((role) => (
              <RoleBadge key={role} role={role} />
            ))}
          </div>
        </div>
        <div className="admin-order-hero__actions">
          <button type="button" className="admin-action--ghost">
            <IconMessage size={14} stroke={2} />
            Message
          </button>
          {user.is_active ? (
            <button type="button" className="admin-action--ghost admin-action--ghost-danger">
              <IconUserOff size={14} stroke={2} />
              Suspend
            </button>
          ) : (
            <button type="button" className="admin-action--ghost">
              <IconCheck size={14} stroke={2} />
              Activate
            </button>
          )}
          <button
            type="button"
            className="admin-action--ghost"
            onClick={() => setAssigning(true)}
          >
            <IconShield size={14} stroke={2} />
            Manage roles
          </button>
        </div>
      </section>

      <div className="admin-user-detail-grid">
        <div className="admin-user-cards-row">
          {/* Recent orders */}
          {user.order_count > 0 && (
            <section className="admin-card">
              <header className="admin-card__head">
                <div>
                  <span className="admin-card__eyebrow">{user.order_count} lifetime orders</span>
                  <h3 className="admin-card__title">Order history</h3>
                </div>
                <span className="admin-card__chip">Last 7 days</span>
              </header>
              <div className="admin-user-detail-wrap">
                <div className="admin-user-detail-scroll">
                  <ul className="admin-user-timeline">
                    {USER_ORDERS.slice(0, orderCount).map((order) => (
                      <li key={order.id} className="admin-user-timeline-item">
                        <div className="admin-user-timeline-item__marker">
                          <span className="admin-user-timeline-item__time">{order.at}</span>
                          <span className={`admin-user-timeline-item__dot admin-user-timeline-item__dot--${order.status}`} />
                        </div>
                        <div className="admin-user-timeline-item__content">
                          <div className="admin-user-timeline-item__info">
                            <span className="admin-user-timeline-item__vendor">{order.vendor}</span>
                            <div className="admin-user-timeline-item__meta">
                              <span className="admin-user-timeline-item__id">{order.id}</span>
                              <span>·</span>
                              <span className={`admin-user-timeline-item__status admin-user-timeline-item__status--${order.status}`}>
                                {order.status}
                              </span>
                            </div>
                          </div>
                          <div className="admin-user-timeline-item__amount">
                            <span className="admin-user-timeline-item__total">{formatCurrency(order.total)}</span>
                          </div>
                        </div>
                      </li>
                    ))}
                    {orderLoading && (
                      <li className="admin-user-timeline-item">
                        <div className="admin-user-timeline-item__marker">
                          <span className="admin-user-timeline-item__time">Loading...</span>
                          <span className="admin-user-timeline-item__dot" />
                        </div>
                      </li>
                    )}
                  </ul>
                </div>
                {orderCount < USER_ORDERS.length && !orderLoading && (
                  <button
                    type="button"
                    className="admin-activity-load-more"
                    onClick={handleLoadMoreOrders}
                  >
                    Load more
                  </button>
                )}
              </div>
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
            <div className="admin-user-detail-wrap">
              <div className="admin-user-detail-scroll">
                <ul className="admin-activity-list">
                  {USER_AUDIT.slice(0, auditCount).map((entry) => (
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
                  {auditLoading && (
                    <li className="admin-activity admin-activity--info">
                      <span className="admin-activity__dot" aria-hidden="true" />
                      <div className="admin-activity__body">
                        <span className="admin-activity__line">Loading...</span>
                      </div>
                    </li>
                  )}
                </ul>
              </div>
              {auditCount < USER_AUDIT.length && !auditLoading && (
                <button
                  type="button"
                  className="admin-activity-load-more"
                  onClick={handleLoadMoreAudit}
                >
                  Load more
                </button>
              )}
            </div>
          </section>
        </div>

        <div className="admin-user-cards-row-2">
          {/* Account info */}
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Identity</span>
                <h3 className="admin-card__title">Account details</h3>
              </div>
            </header>

            <div className="admin-user-detail-sections">
              <div className="admin-vendor-section">
                <h4 className="admin-vendor-section__heading">Profile</h4>
                <InfoRow icon={IconUser} label="Name" value={user.full_name} />
                <InfoRow icon={IconInfoCircle} label="Employee #" value={user.employee_number} />
                <InfoRow icon={IconMail} label="Email" value={user.email} />
                <InfoRow icon={IconClock} label="Joined" value={formatSeenTime(user.created_at)} />
              </div>

              <div className="admin-vendor-section">
                <h4 className="admin-vendor-section__heading">Location & vendor</h4>
                <InfoRow icon={IconUserCircle} label="Campus" value={user.site_id} />
                <InfoRow icon={IconBuildingStore} label="Building" value={user.building_id} />
                {user.vendor_id && <InfoRow icon={IconBuildingStore} label="Vendor" value={user.vendor_id} />}
              </div>

              <div className="admin-vendor-section">
                <h4 className="admin-vendor-section__heading">Preferences</h4>
                <InfoRow
                  icon={IconReceipt}
                  label="Dietary"
                  value={user.dietary_preferences?.length ? user.dietary_preferences.join(', ') : 'None'}
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
              <QuickActionRow
                icon={IconShield}
                title="Assign or remove roles"
                description="Open the role picker and update access."
                variant="info"
                onClick={() => setAssigning(true)}
              />
              <QuickActionRow
                icon={IconReload}
                title="Resend activation email"
                description="Send a fresh verification link."
                variant="success"
              />
              <QuickActionRow
                icon={IconLock}
                title="Reset MFA / password"
                description="Force re-authentication on next sign-in."
                variant="warning"
              />
              <QuickActionRow
                icon={IconUserOff}
                title="Deactivate account"
                description="Immediate access revocation. Audit-logged."
                variant="error"
              />
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
