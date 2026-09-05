import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconSearch,
  IconAlertTriangle,
  IconUser,
  IconBuildingStore,
  IconReceipt,
  IconChevronRight,
  IconCircleCheck,
  IconClock,
  IconStar,
  IconStarFilled,
  IconAdjustments,
  IconMessage,
  IconShield,
  IconDownload,
  IconFilter,
} from '@tabler/icons-react';
import {
  COMPLAINTS,
  COMPLAINT_TABS,
  COMPLAINT_TEAM,
  COMPLAINTS_SUMMARY,
  COMPLAINT_STATUSES,
  COMPLAINT_CATEGORIES,
  COMPLAINT_METRICS,
  formatCurrency,
} from './adminMockData.js';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.png';

const PRIORITY_TONE = {
  urgent: 'error',
  high: 'warning',
  medium: 'info',
  low: 'success',
};

const PRIORITY_LABEL = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

function StatusPill({ status }) {
  const cfg = COMPLAINT_STATUSES.find((s) => s.id === status);
  if (!cfg) return null;
  return <span className={`admin-status admin-status--${cfg.tone}`}>{cfg.label}</span>;
}

function PriorityPill({ priority }) {
  return (
    <span className={`admin-status admin-status--${PRIORITY_TONE[priority]}`}>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

function Stars({ value, max = 5 }) {
  if (value === null || value === undefined) return <span className="admin-stars__na">—</span>;
  return (
    <span className="admin-stars">
      {Array.from({ length: max }).map((_, i) => (
        i < value ? (
          <IconStarFilled key={i} size={12} stroke={0} className="admin-stars__on" />
        ) : (
          <IconStar key={i} size={12} stroke={1.5} className="admin-stars__off" />
        )
      ))}
    </span>
  );
}

function SlaPill({ sla }) {
  let tone = 'success';
  if (sla?.includes('breached')) tone = 'error';
  else if (sla?.includes('at risk')) tone = 'warning';
  return (
    <span className={`admin-cmp-sla admin-cmp-sla--${tone}`}>
      <IconClock size={11} stroke={1.8} /> {sla}
    </span>
  );
}

function Avatar({ name, size = 32 }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '??';
  return (
    <span className="admin-user-avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </span>
  );
}

function ComplaintRow({ complaint }) {
  return (
    <tr className="admin-order-row">
      <td>
        <Link to={`/admin/complaints/${complaint.id}`} className="admin-cmp-id">
          {complaint.id}
        </Link>
      </td>
      <td>
        <div className="admin-cmp-subject">
          <span className="admin-cmp-subject__title">{complaint.subject}</span>
          <span className="admin-cmp-subject__meta">
            {complaint.order ? `#${complaint.order.replace('#', '')} · ` : ''}
            {complaint.categoryLabel}
          </span>
        </div>
      </td>
      <td>
        <div className="admin-cmp-customer">
          <Avatar name={complaint.user_name} />
          <div>
            <span className="admin-cmp-customer__name">{complaint.user_name}</span>
            <span className="admin-cmp-customer__num">{complaint.employee_number}</span>
          </div>
        </div>
      </td>
      <td>
        <span className="admin-cmp-vendor">
          <IconBuildingStore size={12} stroke={1.8} />
          {complaint.vendor_name}
        </span>
      </td>
      <td>
        <Stars value={complaint.rating?.overall} />
      </td>
      <td>
        <div className="admin-cmp-status-cell">
          <StatusPill status={complaint.status} />
          <SlaPill sla={complaint.sla} />
        </div>
      </td>
      <td>
        <div className="admin-cmp-priority-cell">
          <PriorityPill priority={complaint.priority} />
          <span className="admin-cmp-time">{complaint.created_at}</span>
        </div>
      </td>
      <td className="admin-order-cta">
        <Link to={`/admin/complaints/${complaint.id}`} className="admin-link-cta">
          View <IconChevronRight size={13} stroke={2} />
        </Link>
      </td>
    </tr>
  );
}

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

export default function AdminComplaintsPage() {
  const [tab, setTab] = useState('open');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');

  const filtered = useMemo(() => {
    return COMPLAINTS.filter((c) => {
      const inTab =
        tab === 'open' ? c.status === 'open' :
        tab === 'in_progress' ? ['assigned', 'in_review'].includes(c.status) :
        ['resolved', 'closed'].includes(c.status);
      const matchesQuery = !query
        || `${c.subject} ${c.user} ${c.vendor} ${c.id}`.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || c.category === categoryFilter;
      const matchesTeam = teamFilter === 'all' || c.assigned_to === teamFilter || (teamFilter === 'unassigned' && !c.assigned_to);
      return inTab && matchesQuery && matchesCategory && matchesTeam;
    });
  }, [tab, query, categoryFilter, teamFilter]);

  return (
    <div className="admin-orders">
      <header className="admin-vendors__header">
        <div>
          <span className="admin-card__eyebrow">Support &amp; feedback</span>
          <p className="admin-vendors__sub">
            Triage complaints routed from orders, ratings and support cases. SLA tracked per category.
          </p>
        </div>
        <div className="admin-vendors__actions">
          <button type="button" className="admin-action">
            <IconDownload size={13} stroke={2} />
            Export
          </button>
          <button type="button" className="admin-action admin-action--approve">
            <IconAdjustments size={13} stroke={2} />
            SLA rules
          </button>
        </div>
      </header>

      <section className="admin-kpis">
        <StatTile label="Open" value={COMPLAINTS_SUMMARY.open} sub="awaiting triage" tone="amber" icon={IconAlertTriangle} />
        <StatTile label="In progress" value={COMPLAINTS_SUMMARY.in_progress} sub="assigned + in review" tone="blue" icon={IconClock} />
        <StatTile label="Resolved" value={COMPLAINTS_SUMMARY.resolved} sub="this period" tone="green" icon={IconCircleCheck} />
        <StatTile label="Avg resolution" value={`${COMPLAINTS_SUMMARY.avg_resolution_hours} h`} sub={`${COMPLAINTS_SUMMARY.sla_percent}% within SLA`} tone="blue" icon={IconShield} />
      </section>

      <div className="admin-vendors__tabs" role="tablist">
        {COMPLAINT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`admin-vendors__tab${tab === t.id ? ' admin-vendors__tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.id === 'open' && <IconAlertTriangle size={16} stroke={1.8} />}
            {t.id === 'in_progress' && <IconClock size={16} stroke={1.8} />}
            {t.id === 'resolved' && <IconCircleCheck size={16} stroke={1.8} />}
            {t.label}
            <span className="admin-vendors__tab-count">
              {t.id === 'open' ? COMPLAINTS_SUMMARY.open : t.id === 'in_progress' ? COMPLAINTS_SUMMARY.in_progress : COMPLAINTS_SUMMARY.resolved}
            </span>
          </button>
        ))}
      </div>

      <div className="admin-orders__filters">
        <div className="admin-vendors__search admin-orders__search">
          <IconSearch size={16} stroke={1.8} />
          <input
            type="search"
            placeholder="Search complaint ID, subject, customer or vendor..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search complaints"
          />
        </div>
        <select
          className="admin-orders__vendor-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Category filter"
        >
          <option value="all">All categories</option>
          {COMPLAINT_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <select
          className="admin-orders__vendor-select"
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          aria-label="Assigned filter"
        >
          <option value="all">Any assignee</option>
          <option value="unassigned">Unassigned</option>
          {COMPLAINT_TEAM.map((t) => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="admin-order-grid">
        <div className="admin-order-grid__main">
          {filtered.length > 0 ? (
            <div className="admin-card admin-card--full">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Complaint</th>
                    <th>Subject</th>
                    <th>Customer</th>
                    <th>Vendor</th>
                    <th>Rating</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <ComplaintRow key={c.id} complaint={c} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty">
              <img src={emptyStateAvatar} alt="" className="admin-empty__avatar" />
              <h3>No complaints in this view</h3>
              <p>Try adjusting the filters or selecting a different tab.</p>
            </div>
          )}
        </div>

        <div className="admin-order-grid__side">
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Volume by category</span>
                <h3 className="admin-card__title">Complaints mix · 30d</h3>
              </div>
            </header>
            <ul className="admin-report-list">
              {COMPLAINT_METRICS.byCategory.map((cat) => (
                <li key={cat.name} className="admin-report-row">
                  <span className="admin-report-row__label">{cat.name}</span>
                  <div className="admin-report-row__bar">
                    <span className="admin-report-row__bar-fill" style={{ width: `${cat.percent}%` }} />
                  </div>
                  <span className="admin-report-row__value">
                    <strong>{cat.count}</strong>
                    <small>{cat.percent}%</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Support team</span>
                <h3 className="admin-card__title">Workload</h3>
              </div>
            </header>
            <ul className="admin-cmp-team">
              {COMPLAINT_TEAM.map((member) => {
                const open = COMPLAINTS.filter((c) => c.assigned_to === member.name && c.status !== 'resolved' && c.status !== 'closed').length;
                return (
                  <li key={member.id} className="admin-cmp-team__row">
                    <Avatar name={member.name} />
                    <div className="admin-cmp-team__body">
                      <span className="admin-cmp-team__name">{member.name}</span>
                      <span className="admin-cmp-team__role">
                        Support · {open} open
                      </span>
                    </div>
                    <span className={`admin-status admin-status--${open > 5 ? 'warning' : 'info'}`}>
                      {open} open
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
