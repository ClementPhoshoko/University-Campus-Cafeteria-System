import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconSearch,
  IconUser,
  IconUsers,
  IconCheck,
  IconClock,
  IconX,
  IconUserCircle,
  IconBuildingStore,
  IconChevronRight,
  IconUserPlus,
  IconDownload,
} from '@tabler/icons-react';
import {
  ADMIN_PLATFORM_USERS,
  ALL_ROLES,
  USER_STATUS_FILTERS,
  ROLE_FILTERS,
  ROLE_FILTER_MATCH,
} from './adminMockData.js';

const ALL_ROLES_BY_ID = ALL_ROLES.reduce((acc, role) => {
  acc[role.id] = role;
  return acc;
}, {});

function Avatar({ name, size = 36 }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span className="admin-user-avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </span>
  );
}

function StatusPill({ is_active }) {
  const map = {
    true: { label: 'Active', tone: 'success' },
    false: { label: 'Inactive', tone: 'info' },
  };
  const cfg = map[String(is_active)] || { label: is_active ? 'Active' : 'Inactive', tone: 'info' };
  return <span className={`admin-status admin-status--${cfg.tone}`}>{cfg.label}</span>;
}

function RoleBadge({ role }) {
  const cfg = ALL_ROLES_BY_ID[role];
  if (!cfg) return <span className="admin-tag">{role}</span>;
  return (
    <span className={`admin-tag admin-tag--${cfg.tone}`}>
      {cfg.label}
    </span>
  );
}

function UserRow({ user }) {
  return (
    <tr className="admin-order-row">
      <td>
        <div className="admin-user-cell">
          <Avatar name={user.full_name} />
          <div className="admin-user-cell__body">
            <Link to={`/admin/users/${user.id}`} className="admin-user-cell__name">
              {user.full_name}
            </Link>
            <span className="admin-user-cell__email">{user.email}</span>
          </div>
        </div>
      </td>
      <td>
        <span className="admin-user-num">{user.number}</span>
      </td>
      <td>
        <div className="admin-user-loc">
          <span>{user.site}</span>
          <span className="admin-user-loc__meta">{user.building}</span>
        </div>
      </td>
      <td>
        <div className="admin-user-roles">
          {user.roles.map((role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </div>
      </td>
      <td>
        <StatusPill is_active={user.is_active} />
        {user.vendor_id && (
          <div className="admin-user-vendor">
            <IconBuildingStore size={11} stroke={1.8} />
            {user.vendor_id}
          </div>
        )}
      </td>
      <td className="admin-user-meta">
        <span className="admin-user-meta__orders">
          <strong>{user.order_count}</strong> orders
        </span>
        <span className="admin-user-meta__seen">{user.last_seen_at}</span>
      </td>
      <td className="admin-order-cta">
        <Link to={`/admin/users/${user.id}`} className="admin-link-cta">
          Manage <IconChevronRight size={13} stroke={2} />
        </Link>
      </td>
    </tr>
  );
}

function StatBlock({ label, value, sub, tone, icon: Icon }) {
  return (
    <div className={`admin-kpi admin-kpi--${tone || 'blue'}`}>
      <span className="admin-kpi__label">
        {Icon && <Icon size={14} stroke={1.8} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />}
        {label}
      </span>
      <span className="admin-kpi__value">{value}</span>
      {sub && <span className="admin-kpi__sub">{sub}</span>}
    </div>
  );
}

export default function AdminUserList() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  const filtered = useMemo(() => {
    return ADMIN_PLATFORM_USERS.filter((user) => {
      const matchesQuery = !query
        || `${user.full_name} ${user.email} ${user.employee_number}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && user.is_active) || (statusFilter === 'inactive' && !user.is_active) || (statusFilter === 'pending' && !user.is_active);
      const matchesRole = ROLE_FILTER_MATCH[roleFilter](user);
      return matchesQuery && matchesStatus && matchesRole;
    });
  }, [query, statusFilter, roleFilter]);

  const totalUsers = ADMIN_PLATFORM_USERS.length;
  const activeCount = ADMIN_PLATFORM_USERS.filter((u) => u.is_active).length;
  const pendingCount = ADMIN_PLATFORM_USERS.filter((u) => !u.is_active).length;
  const adminCount = ADMIN_PLATFORM_USERS.filter((u) => u.roles.includes('admin')).length;

  return (
    <div className="admin-orders">
      <header className="admin-vendors__header">
        <div>
          <span className="admin-card__eyebrow">Identity & access</span>
          <p className="admin-vendors__sub">
            Search employees, vendors and admins. Manage roles, activation status and access boundaries across the platform.
          </p>
        </div>
        <div className="admin-vendors__actions">
          <button type="button" className="admin-action">
            <IconDownload size={13} stroke={2} />
            Export
          </button>
          <button type="button" className="admin-action admin-action--approve">
            <IconUserPlus size={13} stroke={2} />
            Invite user
          </button>
        </div>
      </header>

      <section className="admin-kpis" aria-label="User metrics">
        <StatBlock label="Total users" value={totalUsers} sub="across all roles" tone="blue" icon={IconUsers} />
        <StatBlock label="Active accounts" value={activeCount} sub={`${Math.round((activeCount / totalUsers) * 100)}% active`} tone="green" icon={IconCheck} />
        <StatBlock label="Pending activation" value={pendingCount} sub="awaiting first sign-in" tone="amber" icon={IconClock} />
        <StatBlock label="Admin users" value={adminCount} sub="company administrators" tone="blue" icon={IconUserCircle} />
      </section>

      <div className="admin-orders__filters">
        <div className="admin-vendors__search admin-orders__search">
          <IconSearch size={16} stroke={1.8} />
          <input
            type="search"
            placeholder="Search users by name, email or employee number..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search users"
          />
        </div>

        <div className="admin-vendors__chips" role="group" aria-label="Status filter">
          {USER_STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`admin-vendors__chip${statusFilter === filter.id ? ' admin-vendors__chip--active' : ''}`}
              onClick={() => setStatusFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <select
          className="admin-orders__vendor-select"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Role filter"
        >
          {ROLE_FILTERS.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      </div>

      {filtered.length > 0 ? (
        <div className="admin-card admin-card--full">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Number</th>
                <th>Location</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Activity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <UserRow key={user.id} user={user} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-empty">
          <IconUser size={32} stroke={1.4} />
          <h3>No users match those filters</h3>
          <p>Try clearing the search or selecting a different status / role.</p>
          <button
            type="button"
            className="admin-action"
            onClick={() => { setQuery(''); setStatusFilter('all'); setRoleFilter('all'); }}
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
