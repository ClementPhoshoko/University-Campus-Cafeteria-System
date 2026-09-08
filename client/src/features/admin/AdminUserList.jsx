import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { IconCheck, IconChevronDown, IconChevronRight, IconClock, IconSearch, IconUserCircle, IconUsers } from '@tabler/icons-react';
import Pagination from '../../components/ui/Pagination.jsx';
import { listUsers } from '../../services/adminApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { ALL_ROLES, ROLE_FILTERS, USER_STATUS_FILTERS } from './adminMockData.js';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.png';

const ITEMS_PER_PAGE = 10;
const ROLE_FILTER_MAP = { all: undefined, employee: 'employee', vendor: 'vendor_staff', finance: 'finance', support: 'support', admin: 'admin' };
const roleMeta = ALL_ROLES.reduce((map, role) => ({ ...map, [role.id]: role }), {});

function Avatar({ name = '' }) { return <span className="admin-user-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>; }
function StatusPill({ active }) { return <span className={`admin-status admin-status--${active ? 'success' : 'info'}`}>{active ? 'Active' : 'Inactive'}</span>; }
function RoleBadge({ role }) { const meta = roleMeta[role]; return <span className={`admin-tag admin-tag--${meta?.tone || 'info'}`}>{meta?.label || role}</span>; }
function UserRow({ user }) { return <tr className="admin-order-row"><td><div className="admin-user-cell"><Avatar name={user.full_name || user.email} /><div className="admin-user-cell__body"><Link to={`/admin/users/${user.id}`} className="admin-user-cell__name">{user.full_name || 'Unnamed user'}</Link><span className="admin-user-cell__email">{user.email}</span></div></div></td><td><span className="admin-user-num">{user.employee_number || '—'}</span></td><td><div className="admin-user-loc"><span>{user.department || '—'}</span><span className="admin-user-loc__meta">{new Date(user.created_at).toLocaleDateString('en-ZA')}</span></div></td><td><div className="admin-user-roles">{user.roles?.length ? user.roles.map((role) => <RoleBadge key={role} role={role} />) : <span className="admin-tag">No roles</span>}</div></td><td><StatusPill active={user.is_active} /></td><td className="admin-order-cta"><Link to={`/admin/users/${user.id}`} className="admin-link-cta">Manage <IconChevronRight size={13} /></Link></td></tr>; }
function StatBlock({ label, value, icon: Icon }) { return <div className="admin-users-kpi"><span className="admin-users-kpi__icon"><Icon size={24} /></span><div className="admin-users-kpi__body"><span className="admin-users-kpi__label">{label}</span><span className="admin-users-kpi__value">{value}</span></div></div>; }

export default function AdminUserList() {
  const { session, initialized } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 0 });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [page, setPageState] = useState(() => parseInt(searchParams.get('page')) || 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const roleDropdownRef = useRef(null);
  const token = session?.access_token;

  useEffect(() => {
    const urlPage = parseInt(searchParams.get('page')) || 1;
    if (urlPage !== page) setPageState(urlPage);
  }, [searchParams]);

  const setPage = (value) => {
    setPageState(value);
    setSearchParams((prev) => {
      if (value === 1 || value === undefined) prev.delete('page');
      else prev.set('page', String(value));
      return prev;
    });
  };

  useEffect(() => { const close = (event) => { if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target)) setRoleDropdownOpen(false); }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close); }, []);
  useEffect(() => { setPage(1); }, [query, statusFilter, roleFilter]);
  useEffect(() => {
    if (!initialized || !token) return;
    let cancelled = false;
    setLoading(true); setError('');
    listUsers(token, { page, limit: ITEMS_PER_PAGE, search: query, role: ROLE_FILTER_MAP[roleFilter] })
      .then((response) => { if (!cancelled) { setUsers(response.users || []); setPagination(response.pagination || {}); } })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load users.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [initialized, page, query, roleFilter, token]);

  const visibleUsers = useMemo(() => users.filter((user) => statusFilter === 'all' || (statusFilter === 'active' && user.is_active) || (statusFilter !== 'active' && !user.is_active)), [statusFilter, users]);
  const activeCount = users.filter((user) => user.is_active).length;
  const adminCount = users.filter((user) => user.roles?.includes('admin')).length;

  return <div className="admin-orders"><header className="admin-users-header"><div className="admin-users-header__info"><span className="admin-users-header__eyebrow">Identity & access</span><p className="admin-users-header__sub">Search employees, vendors and admins. Manage roles and access across the platform.</p></div></header><section className="admin-users-kpis"><StatBlock label="Users on page" value={users.length} icon={IconUsers} /><StatBlock label="Active on page" value={activeCount} icon={IconCheck} /><StatBlock label="Inactive on page" value={users.length - activeCount} icon={IconClock} /><StatBlock label="Admins on page" value={adminCount} icon={IconUserCircle} /></section><div className="admin-orders__filters"><div className="admin-vendors__search admin-orders__search"><IconSearch size={16} /><input type="search" placeholder="Search users by name, email or employee number..." value={query} onChange={(e) => setQuery(e.target.value)} /></div><div className="admin-vendors__chips">{USER_STATUS_FILTERS.map((filter) => <button key={filter.id} type="button" className={`admin-vendors__chip${statusFilter === filter.id ? ' admin-vendors__chip--active' : ''}`} onClick={() => setStatusFilter(filter.id)}>{filter.label}</button>)}</div><div className="admin-orders__vendor-select-wrapper" ref={roleDropdownRef}><button type="button" className="admin-orders__vendor-select" onClick={() => setRoleDropdownOpen((open) => !open)}> {ROLE_FILTERS.find((role) => role.id === roleFilter)?.label || 'All roles'} <IconChevronDown size={14} /></button>{roleDropdownOpen && <div className="admin-orders__vendor-select-dropdown">{ROLE_FILTERS.map((role) => <button key={role.id} type="button" className="admin-orders__vendor-select-option" onClick={() => { setRoleFilter(role.id); setRoleDropdownOpen(false); }}>{role.label}</button>)}</div>}</div></div>{loading ? <div className="admin-vendor-detail__loading"><div className="admin-vendor-detail__loading-spinner" /><p>Loading users...</p></div> : error ? <div className="admin-empty"><h3>Could not load users</h3><p>{error}</p></div> : visibleUsers.length ? <><div className="admin-card admin-card--full"><table className="admin-table"><thead><tr><th>User</th><th>Number</th><th>Department / joined</th><th>Roles</th><th>Status</th><th /></tr></thead><tbody>{visibleUsers.map((user) => <UserRow key={user.id} user={user} />)}</tbody></table></div><Pagination currentPage={page} totalPages={pagination.totalPages || 1} totalItems={pagination.total || visibleUsers.length} itemsPerPage={ITEMS_PER_PAGE} label="users" onPageChange={setPage} /></> : <div className="admin-empty"><img src={emptyStateAvatar} alt="" className="admin-empty__avatar" /><h3>No users match those filters</h3><p>Try clearing the search or changing the role filter.</p></div>}</div>;
}
