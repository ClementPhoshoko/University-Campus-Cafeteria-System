import { useEffect, useState } from 'react';
import { IconActivity, IconAlertTriangle, IconCheck, IconChevronDown, IconCircleCheck, IconClock, IconDownload, IconFileText, IconFilter, IconRefresh, IconSearch, IconWorld } from '@tabler/icons-react';
import Pagination from '../../components/ui/Pagination.jsx';
import { listAuditLogs } from '../../services/adminApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.png';

const RESOURCE_OPTIONS = [
  { id: '', label: 'All resources' },
  { id: 'public.sites', label: 'Sites' },
  { id: 'public.buildings', label: 'Buildings' },
  { id: 'public.floors', label: 'Floors' },
  { id: 'public.collection_points', label: 'Collection points' },
  { id: 'public.delivery_locations', label: 'Delivery locations' },
  { id: 'public.vendors', label: 'Vendors' },
  { id: 'public.vendor_locations', label: 'Vendor locations' },
  { id: 'public.vendor_users', label: 'Staff members' },
  { id: 'public.menu_categories', label: 'Menu categories' },
  { id: 'public.user_roles', label: 'Roles' },
  { id: 'public.orders', label: 'Orders' },
];

const ACTION_OPTIONS = [
  { id: '', label: 'All actions' },
  { id: 'INSERT', label: 'Created' },
  { id: 'UPDATE', label: 'Updated' },
  { id: 'DELETE', label: 'Deleted' },
];

const CATEGORY_OPTIONS = [
  { id: '', label: 'All categories' },
  { id: 'data', label: 'Data' },
  { id: 'access', label: 'Access' },
  { id: 'config', label: 'Configuration' },
  { id: 'lifecycle', label: 'Lifecycle' },
];

const ACTION_TONE = { INSERT: 'success', UPDATE: 'info', DELETE: 'error' };
const CATEGORY_TONE = { data: 'info', access: 'warning', config: 'default', lifecycle: 'success' };

function StatTile({ label, value, icon: Icon }) {
  return (
    <div className="admin-kpi">
      <span className="admin-kpi__icon-wrap"><Icon size={20} /></span>
      <div className="admin-kpi__body">
        <span className="admin-kpi__label">{label}</span>
        <span className="admin-kpi__value">{value}</span>
      </div>
    </div>
  );
}

function Avatar({ name }) {
  const initials = (name || 'System').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  return <span className="admin-user-avatar admin-audit-avatar--admin" style={{ width: 32, height: 32, fontSize: 12 }}>{initials}</span>;
}

function DiffBlock({ entry }) {
  if (entry.action === 'UPDATE' && entry.old_data && entry.new_data) {
    const keys = [...new Set([...Object.keys(entry.old_data), ...Object.keys(entry.new_data)])];
    const changed = keys.filter((k) => JSON.stringify(entry.old_data[k]) !== JSON.stringify(entry.new_data[k]));
    if (!changed.length) return null;
    return (
      <div className="admin-audit-row__delta">
        {changed.slice(0, 8).map((key) => (
          <div key={key} className="admin-audit-row__delta-row">
            <span className="admin-audit-row__delta-label">{key}</span>
            <span className="admin-audit-row__delta-from">{String(entry.old_data[key] ?? '—')}</span>
            <span className="admin-audit-row__delta-arrow">→</span>
            <span className="admin-audit-row__delta-to">{String(entry.new_data[key] ?? '—')}</span>
          </div>
        ))}
      </div>
    );
  }
  if (entry.action === 'INSERT' && entry.new_data) {
    const keys = Object.keys(entry.new_data).filter((k) => entry.new_data[k] != null);
    if (!keys.length) return null;
    return (
      <div className="admin-audit-row__delta">
        {keys.slice(0, 8).map((key) => (
          <div key={key} className="admin-audit-row__delta-row">
            <span className="admin-audit-row__delta-label">{key}</span>
            <span className="admin-audit-row__delta-to">{String(entry.new_data[key])}</span>
          </div>
        ))}
      </div>
    );
  }
  if (entry.action === 'DELETE' && entry.old_data) {
    const keys = Object.keys(entry.old_data).filter((k) => entry.old_data[k] != null);
    if (!keys.length) return null;
    return (
      <div className="admin-audit-row__delta">
        {keys.slice(0, 8).map((key) => (
          <div key={key} className="admin-audit-row__delta-row">
            <span className="admin-audit-row__delta-label">{key}</span>
            <span className="admin-audit-row__delta-from">{String(entry.old_data[key])}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function AuditEntry({ entry, isLast }) {
  const tone = ACTION_TONE[entry.action] || 'info';
  return (
    <li className={`admin-audit-row admin-audit-row--${tone}`}>
      <div className="admin-audit-row__rail">
        <span className="admin-audit-resource-icon"><IconFileText size={14} /></span>
        {!isLast && <span className="admin-audit-row__line" />}
      </div>
      <div className="admin-audit-row__body">
        <header className="admin-audit-row__head">
          <div className="admin-audit-row__lead">
            <Avatar name={entry.actor_name} />
            <span className="admin-audit-row__actor">{entry.actor_name}<span className="admin-tag admin-tag--error">Admin</span></span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {entry.category && <span className={`admin-tag admin-tag--${CATEGORY_TONE[entry.category] || 'default'}`}>{entry.category}</span>}
            <span className={`admin-audit-row__action admin-status admin-status--${tone}`}>{entry.action}</span>
          </div>
        </header>
        <div className="admin-audit-row__detail">
          <span className="admin-audit-row__resource"><strong>{entry.tableName}:</strong> {entry.resource_name}</span>
          <span className="admin-audit-row__meta"><IconClock size={11} /> {new Date(entry.created_at).toLocaleString('en-ZA')} <span>·</span><IconWorld size={11} /> {entry.ipAddress}</span>
        </div>
        {entry.reason && <div className="admin-audit-row__reason" style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 4, fontStyle: 'italic' }}>&ldquo;{entry.reason}&rdquo;</div>}
        <DiffBlock entry={entry} />
      </div>
    </li>
  );
}

export default function AdminAuditLogPage() {
  const { session, initialized } = useAuth();
  const [logs, setLogs] = useState([]);
  const [actionCounts, setActionCounts] = useState({ INSERT: 0, UPDATE: 0, DELETE: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [query, setQuery] = useState('');
  const [resource, setResource] = useState('');
  const [action, setAction] = useState('');
  const [category, setCategory] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [resourceDropdownOpen, setResourceDropdownOpen] = useState(false);
  const [actionDropdownOpen, setActionDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const token = session?.access_token;

  useEffect(() => { setPage(1); }, [query, resource, action, category, dateFrom, dateTo]);
  useEffect(() => {
    if (!initialized || !token) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    const params = { page, limit: 25, search: query, table_name: resource, action, category };
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    listAuditLogs(token, params)
      .then((response) => {
        if (!cancelled) {
          setLogs(response.logs || []);
          setActionCounts(response.action_counts || { INSERT: 0, UPDATE: 0, DELETE: 0 });
          setPagination(response.pagination || {});
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load audit logs.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [action, category, dateFrom, dateTo, initialized, page, query, resource, token]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (resourceDropdownOpen && !e.target.closest('.admin-orders__resource-select-wrapper')) setResourceDropdownOpen(false);
      if (actionDropdownOpen && !e.target.closest('.admin-orders__action-select-wrapper')) setActionDropdownOpen(false);
      if (categoryDropdownOpen && !e.target.closest('.admin-orders__category-select-wrapper')) setCategoryDropdownOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [resourceDropdownOpen, actionDropdownOpen, categoryDropdownOpen]);

  const selectedResource = RESOURCE_OPTIONS.find((o) => o.id === resource);
  const selectedAction = ACTION_OPTIONS.find((o) => o.id === action);
  const selectedCategory = CATEGORY_OPTIONS.find((o) => o.id === category);
  const hasActiveFilters = resource || action || category || dateFrom || dateTo;

  return (
    <div className="admin-orders">
      <header className="admin-vendors__header">
        <div><span className="admin-card__eyebrow">Compliance &amp; security</span><p className="admin-vendors__sub">Searchable record of admin changes and system mutations.</p></div>
        <div className="admin-vendors__actions"><button type="button" className="admin-action" onClick={() => setPage(1)}><IconRefresh size={13} /> Refresh</button><button type="button" className="admin-action admin-action--approve" disabled><IconDownload size={13} /> Export CSV</button></div>
      </header>

      <section className="admin-kpis" aria-label="Audit summary">
        <div className="admin-kpis__row">
          <StatTile label="Total events" value={pagination.total || 0} icon={IconFileText} />
          <StatTile label="Creates" value={actionCounts.INSERT || 0} icon={IconCheck} />
          <StatTile label="Updates" value={actionCounts.UPDATE || 0} icon={IconActivity} />
          <StatTile label="Deletes" value={actionCounts.DELETE || 0} icon={IconAlertTriangle} />
        </div>
      </section>

      <div className="admin-orders__filters">
        <div className="admin-vendors__search admin-orders__search">
          <IconSearch size={16} />
          <input type="search" placeholder="Search action, table, record or reason..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="admin-orders__resource-select-wrapper">
          <button type="button" className="admin-orders__vendor-select" onClick={() => setResourceDropdownOpen(!resourceDropdownOpen)} aria-label="Filter by resource">
            {selectedResource?.label || 'All resources'}
            <IconChevronDown size={14} stroke={2} />
          </button>
          {resourceDropdownOpen && (
            <div className="admin-orders__vendor-select-dropdown">
              {RESOURCE_OPTIONS.map((option) => (
                <button key={option.id} type="button" className={`admin-orders__vendor-select-option${resource === option.id ? ' admin-orders__vendor-select-option--active' : ''}`} onClick={() => { setResource(option.id); setResourceDropdownOpen(false); }}>
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="admin-orders__action-select-wrapper">
          <button type="button" className="admin-orders__vendor-select" onClick={() => setActionDropdownOpen(!actionDropdownOpen)} aria-label="Filter by action">
            {selectedAction?.label || 'All actions'}
            <IconChevronDown size={14} stroke={2} />
          </button>
          {actionDropdownOpen && (
            <div className="admin-orders__vendor-select-dropdown">
              {ACTION_OPTIONS.map((option) => (
                <button key={option.id} type="button" className={`admin-orders__vendor-select-option${action === option.id ? ' admin-orders__vendor-select-option--active' : ''}`} onClick={() => { setAction(option.id); setActionDropdownOpen(false); }}>
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className={`admin-action ${showFilters ? 'admin-action--active' : ''}`} onClick={() => setShowFilters((prev) => !prev)}><IconFilter size={13} /> Filters {hasActiveFilters ? '(active)' : ''}</button>
      </div>

      {showFilters && (
        <div className="admin-orders__filters" style={{ gap: 12, padding: '12px 16px' }}>
          <div className="admin-orders__category-select-wrapper">
            <button type="button" className="admin-orders__vendor-select" onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)} aria-label="Filter by category">
              {selectedCategory?.label || 'All categories'}
              <IconChevronDown size={14} stroke={2} />
            </button>
            {categoryDropdownOpen && (
              <div className="admin-orders__vendor-select-dropdown">
                {CATEGORY_OPTIONS.map((option) => (
                  <button key={option.id} type="button" className={`admin-orders__vendor-select-option${category === option.id ? ' admin-orders__vendor-select-option--active' : ''}`} onClick={() => { setCategory(option.id); setCategoryDropdownOpen(false); }}>
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
            From
            <input type="date" className="admin-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: '6px 8px', fontSize: '0.78rem' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
            To
            <input type="date" className="admin-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: '6px 8px', fontSize: '0.78rem' }} />
          </label>
          {hasActiveFilters && <button type="button" className="admin-action--ghost" onClick={() => { setQuery(''); setResource(''); setAction(''); setCategory(''); setDateFrom(''); setDateTo(''); }}>Clear all</button>}
        </div>
      )}

      {loading ? <div className="admin-vendor-detail__loading"><div className="admin-vendor-detail__loading-spinner" /><p>Loading audit logs...</p></div> : error ? <div className="admin-empty"><img src={emptyStateAvatar} alt="" className="admin-empty__avatar" /><h3>Could not load audit logs</h3><p>{error}</p><button type="button" className="admin-action--ghost" onClick={() => setPage(1)}>Try again</button></div> : logs.length ? <><section className="admin-card admin-card--full"><header className="admin-card__head"><div><span className="admin-card__eyebrow">Activity stream</span><h3 className="admin-card__title">Audit trail</h3></div><span className="admin-card__chip"><IconCircleCheck size={13} /> Database records</span></header><ul className="admin-audit-list">{logs.map((entry, index) => <AuditEntry key={entry.id} entry={entry} isLast={index === logs.length - 1} />)}</ul></section><Pagination currentPage={page} totalPages={pagination.totalPages || 1} totalItems={pagination.total || logs.length} itemsPerPage={pagination.limit || 25} label="events" onPageChange={setPage} /></> : <div className="admin-empty"><img src={emptyStateAvatar} alt="" className="admin-empty__avatar" /><h3>No audit entries found</h3><p>There are no events matching the selected filters.</p><button type="button" className="admin-action--ghost" onClick={() => { setQuery(''); setResource(''); setAction(''); setCategory(''); setDateFrom(''); setDateTo(''); }}>Clear filters</button></div>}
    </div>
  );
}
