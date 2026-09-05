import { useMemo, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  IconSearch,
  IconUser,
  IconUsers,
  IconCheck,
  IconClock,
  IconX,
  IconUserCircle,
  IconChevronRight,
  IconUserPlus,
  IconDownload,
  IconChevronDown,
} from '@tabler/icons-react';
import {
  ADMIN_PLATFORM_USERS,
  ADMIN_SITES,
  ADMIN_BUILDINGS,
  ALL_ROLES,
  USER_STATUS_FILTERS,
  ROLE_FILTERS,
  ROLE_FILTER_MATCH,
} from './adminMockData.js';
import Pagination from '../../components/ui/Pagination.jsx';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.png';

const ITEMS_PER_PAGE = 10;

const ALL_ROLES_BY_ID = ALL_ROLES.reduce((acc, role) => {
  acc[role.id] = role;
  return acc;
}, {});

const ALL_SITES_BY_ID = ADMIN_SITES.reduce((acc, site) => {
  acc[site.id] = site;
  return acc;
}, {});

const ALL_BUILDINGS_BY_ID = ADMIN_BUILDINGS.reduce((acc, building) => {
  acc[building.id] = building;
  return acc;
}, {});

function getUserLocation(user) {
  const site = ALL_SITES_BY_ID[user.site_id];
  const building = ALL_BUILDINGS_BY_ID[user.building_id];
  if (!site) return { site: '—', building: '—' };
  return {
    site: site.name,
    building: building ? building.name : '—',
  };
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
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

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
  const location = getUserLocation(user);
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
        <span className="admin-user-num">{user.employee_number}</span>
      </td>
      <td>
        <div className="admin-user-loc">
          <span>{location.site}</span>
          <span className="admin-user-loc__meta">{location.building}</span>
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
      </td>
      <td className="admin-user-meta">
        <span className="admin-user-meta__orders">
          <strong>{user.order_count}</strong> orders
        </span>
        <span className="admin-user-meta__seen">{formatSeenTime(user.last_seen_at)}</span>
      </td>
      <td className="admin-order-cta">
        <Link to={`/admin/users/${user.id}`} className="admin-link-cta">
          Manage <IconChevronRight size={13} stroke={2} />
        </Link>
      </td>
    </tr>
  );
}

function StatBlock({ label, value, sub, icon: Icon }) {
  return (
    <div className="admin-users-kpi">
      <span className="admin-users-kpi__icon">
        {Icon && <Icon size={24} stroke={1.6} />}
      </span>
      <div className="admin-users-kpi__body">
        <span className="admin-users-kpi__label">{label}</span>
        <span className="admin-users-kpi__value">{value}</span>
        {sub && <span className="admin-users-kpi__sub">{sub}</span>}
      </div>
    </div>
  );
}

export default function AdminUserList() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [page, setPage] = useState(1);
  const roleDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (roleDropdownRef.current && !e.target.closest('.admin-orders__vendor-select-wrapper')) {
        setRoleDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    return ADMIN_PLATFORM_USERS.filter((user) => {
      const matchesQuery = !query
        || `${user.full_name} ${user.email} ${user.employee_number}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && user.is_active) || (statusFilter === 'inactive' && !user.is_active) || (statusFilter === 'pending' && !user.is_active);
      const matchesRole = ROLE_FILTER_MATCH[roleFilter](user);
      return matchesQuery && matchesStatus && matchesRole;
    });
  }, [query, statusFilter, roleFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedUsers = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, roleFilter]);

  const totalUsers = ADMIN_PLATFORM_USERS.length;
  const activeCount = ADMIN_PLATFORM_USERS.filter((u) => u.is_active).length;
  const pendingCount = ADMIN_PLATFORM_USERS.filter((u) => !u.is_active).length;
  const adminCount = ADMIN_PLATFORM_USERS.filter((u) => u.roles.includes('admin')).length;

  return (
    <div className="admin-orders">
      <header className="admin-users-header">
        <div className="admin-users-header__info">
          <span className="admin-users-header__eyebrow">Identity & access</span>
          <p className="admin-users-header__sub">
            Search employees, vendors and admins. Manage roles, activation status and access boundaries across the platform.
          </p>
        </div>
        <div className="admin-users-header__actions">
          <button type="button" className="admin-action--ghost">
            <IconDownload size={14} stroke={2} />
            Export
          </button>
          <button type="button" className="admin-action--ghost">
            <IconUserPlus size={14} stroke={2} />
            Invite user
          </button>
        </div>
      </header>

      <section className="admin-users-kpis" aria-label="User metrics">
        <StatBlock label="Total users" value={totalUsers} sub="across all roles" icon={IconUsers} />
        <StatBlock label="Active accounts" value={activeCount} sub={`${Math.round((activeCount / totalUsers) * 100)}% active`} icon={IconCheck} />
        <StatBlock label="Pending activation" value={pendingCount} sub="awaiting first sign-in" icon={IconClock} />
        <StatBlock label="Admin users" value={adminCount} sub="company administrators" icon={IconUserCircle} />
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

        <div className="admin-orders__vendor-select-wrapper" ref={roleDropdownRef}>
          <button
            type="button"
            className="admin-orders__vendor-select"
            onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
            aria-label="Filter by role"
          >
            {ROLE_FILTERS.find((r) => r.id === roleFilter)?.label || 'All roles'}
            <IconChevronDown size={14} stroke={2} />
          </button>
          {roleDropdownOpen && (
            <div className="admin-orders__vendor-select-dropdown">
              {ROLE_FILTERS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`admin-orders__vendor-select-option${roleFilter === r.id ? ' admin-orders__vendor-select-option--active' : ''}`}
                  onClick={() => {
                    setRoleFilter(r.id);
                    setRoleDropdownOpen(false);
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {filtered.length > 0 ? (
        <>
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
                {paginatedUsers.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filtered.length}
            itemsPerPage={ITEMS_PER_PAGE}
            label="users"
            onPageChange={setPage}
          />
        </>
      ) : (
        <div className="admin-empty">
          <img src={emptyStateAvatar} alt="" className="admin-empty__avatar" />
          <h3>No users match those filters</h3>
          <p>Try clearing the search or selecting a different status / role.</p>
          <button
            type="button"
            className="admin-action--ghost"
            onClick={() => { setQuery(''); setStatusFilter('all'); setRoleFilter('all'); }}
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
