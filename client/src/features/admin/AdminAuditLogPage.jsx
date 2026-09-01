import { useMemo, useState } from 'react';
import {
  IconSearch,
  IconShieldCheck,
  IconLock,
  IconAlertTriangle,
  IconCheck,
  IconDownload,
  IconRefresh,
  IconCircleCheck,
  IconUser,
  IconBuildingStore,
  IconReceipt,
  IconBuilding,
  IconSettings,
  IconFileText,
  IconWorld,
  IconClock,
  IconActivity,
} from '@tabler/icons-react';
import {
  AUDIT_LOGS,
  SECURITY_EVENTS,
  AUDIT_TABS,
  AUDIT_RESOURCE_TYPES,
  AUDIT_ACTION_TYPES,
  AUDIT_SUMMARY,
} from './adminMockData.js';

const ROLE_TONE = {
  admin: 'error',
  finance: 'warning',
  support: 'warning',
  vendor_manager: 'success',
  vendor_staff: 'success',
  employee: 'info',
  system: 'info',
};

const ROLE_LABEL = {
  admin: 'Admin',
  finance: 'Finance',
  support: 'Support',
  vendor_manager: 'Vendor manager',
  vendor_staff: 'Vendor staff',
  employee: 'Employee',
  system: 'System',
};

const ACTION_TONE = {
  create: 'success',
  update: 'info',
  delete: 'error',
  approve: 'success',
  reject: 'error',
  refund: 'warning',
  login: 'info',
  role: 'warning',
};

const SEVERITY_TONE = {
  info: 'info',
  warning: 'warning',
  high: 'error',
  critical: 'error',
};

const RESOURCE_ICON = {
  Vendor: IconBuildingStore,
  'Menu item': IconFileText,
  Order: IconReceipt,
  User: IconUser,
  Building: IconBuilding,
  Settings: IconSettings,
  Profile: IconUser,
  Settlement: IconReceipt,
  Report: IconFileText,
  Cart: IconReceipt,
};

function StatTile({ label, value, sub, tone, icon: Icon }) {
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

function Avatar({ name, role, size = 32 }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '??';
  return (
    <span
      className={`admin-user-avatar admin-audit-avatar--${role}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

function ResourceIcon({ resource }) {
  const Icon = RESOURCE_ICON[resource] || IconFileText;
  return (
    <span className="admin-audit-resource-icon">
      <Icon size={14} stroke={1.8} />
    </span>
  );
}

function AuditEntry({ entry, isLast }) {
  const actionTone = ACTION_TONE[entry.actionType] || 'info';
  const hasDiff = entry.oldData || entry.newData;

  return (
    <li className={`admin-audit-row admin-audit-row--${actionTone}`}>
      <div className="admin-audit-row__rail">
        <ResourceIcon resource={entry.tableName} />
        {!isLast && <span className="admin-audit-row__line" aria-hidden="true" />}
      </div>

      <div className="admin-audit-row__body">
        <header className="admin-audit-row__head">
          <div className="admin-audit-row__lead">
            <Avatar name={entry.actor_name} role={entry.actor_role} />
            <span className="admin-audit-row__actor">
              {entry.actor_name}
              <span className={`admin-tag admin-tag--${ROLE_TONE[entry.actor_role] || 'info'}`}>
                {ROLE_LABEL[entry.actor_role] || entry.actor_role}
              </span>
            </span>
          </div>
          <span className={`admin-audit-row__action admin-status admin-status--${actionTone}`}>
            {entry.action}
          </span>
        </header>

        <div className="admin-audit-row__detail">
          <span className="admin-audit-row__resource">
            <strong>{entry.tableName}:</strong>{' '}
            {entry.recordKey && (
              <span className="admin-audit-row__resource-name">{entry.resourceName}</span>
            )}
          </span>
          <span className="admin-audit-row__meta">
            <IconClock size={11} stroke={1.8} /> {entry.createdAt}
            {entry.ipAddress && entry.ipAddress !== '—' && (
              <>
                <span>·</span>
                <IconWorld size={11} stroke={1.8} /> {entry.ipAddress}
              </>
            )}
            {entry.userAgent && entry.userAgent !== 'System' && entry.userAgent !== 'Cron' && (
              <>
                <span>·</span>
                <span>{entry.userAgent}</span>
              </>
            )}
          </span>
        </div>

        <p className="admin-audit-row__copy">{entry.detail}</p>

        {hasDiff && (
          <div className="admin-audit-row__delta">
            {Object.entries(entry.newData || entry.oldData || {}).map(([key, newVal]) => {
              const oldVal = entry.oldData?.[key];
              return (
                <div key={key} className="admin-audit-row__delta-row">
                  <span className="admin-audit-row__delta-label">{key}</span>
                  <span className="admin-audit-row__delta-from">{oldVal ?? '—'}</span>
                  <span className="admin-audit-row__delta-arrow">→</span>
                  <span className="admin-audit-row__delta-to">{newVal ?? '—'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </li>
  );
}

function SecurityEntry({ entry }) {
  const sevTone = SEVERITY_TONE[entry.metadata?.severity] || 'info';
  return (
    <li className={`admin-security-row admin-security-row--${sevTone}`}>
      <div className="admin-security-row__icon">
        {entry.success ? (
          <IconCheck size={18} stroke={2} />
        ) : (
          <IconAlertTriangle size={18} stroke={2} />
        )}
      </div>

      <div className="admin-security-row__body">
        <header className="admin-security-row__head">
          <div>
            <span className="admin-security-row__event">{entry.eventType}</span>
            <span className="admin-security-row__user">
              {entry.user}
            </span>
          </div>
          <span className={`admin-status admin-status--${sevTone}`}>
            {entry.metadata?.severity}
          </span>
        </header>

        <span className="admin-audit-row__meta">
          <IconClock size={11} stroke={1.8} /> {entry.createdAt}
          {entry.ipAddress && (
            <>
              <span>·</span>
              <IconWorld size={11} stroke={1.8} /> {entry.ipAddress}
            </>
          )}
          {entry.metadata?.location && (
            <>
              <span>·</span>
              {entry.metadata.location}
            </>
          )}
          {entry.userAgent && (
            <>
              <span>·</span>
              <span>{entry.userAgent}</span>
            </>
          )}
        </span>

        <p className="admin-audit-row__copy">{entry.metadata?.detail}</p>

        {entry.metadata?.actionTaken && (
          <div className="admin-security-row__action">
            <span className="admin-security-row__action-label">Action taken:</span>
            <span>{entry.metadata.actionTaken}</span>
          </div>
        )}
      </div>
    </li>
  );
}

export default function AdminAuditLogPage() {
  const [tab, setTab] = useState('audit');
  const [query, setQuery] = useState('');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  const filteredLogs = useMemo(() => {
    return AUDIT_LOGS.filter((entry) => {
      const matchesQuery = !query
        || `${entry.actor_name} ${entry.resource_name} ${entry.action} ${entry.metadata?.detail}`.toLowerCase().includes(query.toLowerCase());
      const matchesResource = resourceFilter === 'all'
        || entry.table_name.toLowerCase().startsWith(resourceFilter.slice(0, -1));
      const matchesAction = actionFilter === 'all' || entry.action_type === actionFilter;
      return matchesQuery && matchesResource && matchesAction;
    });
  }, [query, resourceFilter, actionFilter]);

  return (
    <div className="admin-orders">
      <header className="admin-vendors__header">
        <div>
          <span className="admin-card__eyebrow">Compliance &amp; security</span>
          <h2 className="admin-vendors__title">Audit logs</h2>
          <p className="admin-vendors__sub">
            Searchable, tamper-evident record of admin and system actions. Retained for {AUDIT_SUMMARY.retention_days} days per POPIA.
          </p>
        </div>
        <div className="admin-vendors__actions">
          <button type="button" className="admin-action">
            <IconRefresh size={13} stroke={2} />
            Refresh
          </button>
          <button type="button" className="admin-action admin-action--approve">
            <IconDownload size={13} stroke={2} />
            Export CSV
          </button>
        </div>
      </header>

      <section className="admin-kpis" aria-label="Audit summary">
        <StatTile label="Total events" value={AUDIT_SUMMARY.total_events.toLocaleString()} sub="lifetime" tone="blue" icon={IconActivity} />
        <StatTile label="Events today" value={AUDIT_SUMMARY.today} sub="across all actors" tone="green" icon={IconClock} />
        <StatTile label="Critical alerts" value={AUDIT_SUMMARY.critical_alerts} sub="last 24 hours" tone="amber" icon={IconAlertTriangle} />
        <StatTile label="Unique actors" value={AUDIT_SUMMARY.unique_actors} sub="employees + vendors + admins" tone="blue" icon={IconUser} />
      </section>

      <div className="admin-vendors__tabs" role="tablist">
        {AUDIT_TABS.map((t) => {
          const Icon = t.icon === 'IconLock' ? IconLock : IconShieldCheck;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`admin-vendors__tab${tab === t.id ? ' admin-vendors__tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon size={16} stroke={1.8} />
              {t.label}
              <span className="admin-vendors__tab-count">
                {t.id === 'audit' ? AUDIT_LOGS.length : SECURITY_EVENTS.length}
              </span>
            </button>
          );
        })}
      </div>

      {tab === 'audit' && (
        <>
          <div className="admin-audit__summary">
            <div className="admin-audit__summary-item">
              <IconFileText size={16} stroke={1.8} />
              <div>
                <span className="admin-audit__summary-value">{AUDIT_SUMMARY.resourceChanges}</span>
                <span className="admin-audit__summary-label">Resource changes · 30d</span>
              </div>
            </div>
            <div className="admin-audit__summary-item">
              <IconAlertTriangle size={16} stroke={1.8} />
              <div>
                <span className="admin-audit__summary-value">{AUDIT_SUMMARY.failedSignIns}</span>
                <span className="admin-audit__summary-label">Failed sign-ins · 24h</span>
              </div>
            </div>
            <div className="admin-audit__summary-item">
              <IconCircleCheck size={16} stroke={1.8} />
              <div>
                <span className="admin-audit__summary-value">Tamper-evident</span>
                <span className="admin-audit__summary-label">Hashed chain · last verified 5 min ago</span>
              </div>
            </div>
          </div>

          <div className="admin-orders__filters">
            <div className="admin-vendors__search admin-orders__search">
              <IconSearch size={16} stroke={1.8} />
              <input
                type="search"
                placeholder="Search actor, resource, action or detail..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search audit log"
              />
            </div>
            <select
              className="admin-orders__vendor-select"
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              aria-label="Resource filter"
            >
              {AUDIT_RESOURCE_TYPES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            <select
              className="admin-orders__vendor-select"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              aria-label="Action filter"
            >
              {AUDIT_ACTION_TYPES.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>

          <section className="admin-card admin-card--full">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Activity stream</span>
                <h3 className="admin-card__title">Audit trail · all actors</h3>
              </div>
              <span className="admin-card__chip admin-card__chip--success">
                <IconCircleCheck size={13} stroke={2} />
                Chain integrity verified
              </span>
            </header>

            {filteredLogs.length > 0 ? (
              <ul className="admin-audit-list">
                {filteredLogs.map((entry, idx) => (
                  <AuditEntry
                    key={entry.id}
                    entry={entry}
                    isLast={idx === filteredLogs.length - 1}
                  />
                ))}
              </ul>
            ) : (
              <div className="admin-empty">
                <IconShieldCheck size={32} stroke={1.4} />
                <h3>No matching audit entries</h3>
                <p>Try clearing the search or selecting a different resource.</p>
              </div>
            )}
          </section>
        </>
      )}

      {tab === 'security' && (
        <>
          <div className="admin-audit__summary">
            <div className="admin-audit__summary-item">
              <IconCheck size={16} stroke={1.8} />
              <div>
                <span className="admin-audit__summary-value">
                  {SECURITY_EVENTS.filter((e) => e.success).length}
                </span>
                <span className="admin-audit__summary-label">Successful events</span>
              </div>
            </div>
            <div className="admin-audit__summary-item">
              <IconAlertTriangle size={16} stroke={1.8} />
              <div>
                <span className="admin-audit__summary-value">
                  {SECURITY_EVENTS.filter((e) => !e.success).length}
                </span>
                <span className="admin-audit__summary-label">Failed/blocked events</span>
              </div>
            </div>
            <div className="admin-audit__summary-item">
              <IconLock size={16} stroke={1.8} />
              <div>
                <span className="admin-audit__summary-value">
                  {SECURITY_EVENTS.filter((e) => e.severity === 'critical').length}
                </span>
                <span className="admin-audit__summary-label">Critical alerts (SLA 1h)</span>
              </div>
            </div>
          </div>

          <section className="admin-card admin-card--full">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Security feed</span>
                <h3 className="admin-card__title">Authentication &amp; security events</h3>
              </div>
              <span className="admin-card__chip">
                <IconLock size={13} stroke={2} /> WORM retention enforced
              </span>
            </header>

            <ul className="admin-security-list">
              {SECURITY_EVENTS.map((entry) => (
                <SecurityEntry key={entry.id} entry={entry} />
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
