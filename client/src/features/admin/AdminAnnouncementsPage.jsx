import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconSearch,
  IconSpeakerphone,
  IconBell,
  IconCircleCheck,
  IconClock,
  IconFileText,
  IconEdit,
  IconTrash,
  IconArchive,
  IconPlus,
  IconCalendar,
  IconUsers,
  IconBuilding,
  IconTag,
  IconChevronRight,
  IconDownload,
  IconEye,
  IconExternalLink,
} from '@tabler/icons-react';
import {
  ANNOUNCEMENTS,
  ANNOUNCEMENT_TABS,
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_CHANNELS,
  ANNOUNCEMENT_SUMMARY,
  ANNOUNCEMENT_ACTIVITY,
  formatCurrency,
} from './adminMockData.js';

const SEVERITY_TONE = {
  info: 'info',
  success: 'success',
  warning: 'warning',
};

const CHANNEL_LABEL = {
  in_app: 'In-app',
  push: 'Push',
  email: 'Email',
};

function StatusPill({ status }) {
  const map = {
    active: { label: 'Active', tone: 'success' },
    scheduled: { label: 'Scheduled', tone: 'info' },
    draft: { label: 'Draft', tone: 'warning' },
    archived: { label: 'Archived', tone: 'info' },
  };
  const cfg = map[status] || { label: status, tone: 'info' };
  return <span className={`admin-status admin-status--${cfg.tone}`}>{cfg.label}</span>;
}

function SeverityPill({ severity }) {
  return (
    <span className={`admin-status admin-status--${SEVERITY_TONE[severity] || 'info'}`}>
      {severity}
    </span>
  );
}

function ChannelChips({ channels }) {
  return (
    <span className="admin-ann-channel-chips">
      {channels.map((c) => (
        <span key={c} className="admin-tag admin-tag--blue">{CHANNEL_LABEL[c] || c}</span>
      ))}
    </span>
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

function AnnouncementCard({ announcement }) {
  const reach = announcement.reach;
  const openRate = reach && reach.delivered > 0
    ? Math.round((reach.opened / reach.delivered) * 100)
    : 0;

  return (
    <Link to={`/admin/announcements/${announcement.id}`} className="admin-ann-card">
      <header className="admin-ann-card__head">
        <div className="admin-ann-card__icons">
          <span className={`admin-ann-card__icon admin-ann-card__icon--${announcement.severity}`}>
            <IconSpeakerphone size={16} stroke={1.8} />
          </span>
        </div>
        <div className="admin-ann-card__head-body">
          <span className="admin-ann-card__title">{announcement.title}</span>
          <span className="admin-ann-card__meta">
            <IconCalendar size={11} stroke={1.8} /> {announcement.startsAt} → {announcement.endsAt}
          </span>
        </div>
        <StatusPill status={announcement.status} />
      </header>

      <p className="admin-ann-card__copy">{announcement.body}</p>

      <div className="admin-ann-card__tags">
        <span className="admin-tag">{announcement.categoryLabel}</span>
        <ChannelChips channels={announcement.channels} />
      </div>

      <div className="admin-ann-card__audience">
        <IconUsers size={13} stroke={1.8} />
        <span>{announcement.audience_roles.length} role{announcement.audience_roles.length !== 1 ? 's' : ''}</span>
        <span>·</span>
        <IconBuilding size={13} stroke={1.8} />
        <span>{announcement.site_name || 'All campuses'}</span>
      </div>

      {reach && (
        <div className="admin-ann-card__reach">
          <div className="admin-ann-card__reach-stat">
            <span className="admin-ann-card__reach-num">{reach.targeted.toLocaleString()}</span>
            <span className="admin-ann-card__reach-label">Reached</span>
          </div>
          <div className="admin-ann-card__reach-stat">
            <span className="admin-ann-card__reach-num">{openRate}%</span>
            <span className="admin-ann-card__reach-label">Open rate</span>
          </div>
          <div className="admin-ann-card__reach-stat">
            <span className="admin-ann-card__reach-num">{reach.clicked.toLocaleString()}</span>
            <span className="admin-ann-card__reach-label">Clicked</span>
          </div>
          <div className="admin-ann-card__reach-stat">
            <span className="admin-ann-card__reach-num">{reach.dismissed.toLocaleString()}</span>
            <span className="admin-ann-card__reach-label">Dismissed</span>
          </div>
        </div>
      )}
    </Link>
  );
}

function ActivityItem({ item }) {
  return (
    <li className={`admin-activity admin-activity--${item.tone}`}>
      <span className="admin-activity__dot" aria-hidden="true" />
      <div className="admin-activity__body">
        <span className="admin-activity__line">
          <strong>{item.actor}</strong> {item.action}
        </span>
        <span className="admin-activity__time">{item.at}</span>
      </div>
    </li>
  );
}

export default function AdminAnnouncementsPage() {
  const [tab, setTab] = useState('active');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filtered = useMemo(() => {
    return ANNOUNCEMENTS.filter((a) => {
      const matchesTab = a.status === tab;
      const matchesQuery = !query
        || `${a.title} ${a.body} ${a.id}`.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || a.category === categoryFilter;
      return matchesTab && matchesQuery && matchesCategory;
    });
  }, [tab, query, categoryFilter]);

  return (
    <div className="admin-orders">
      <header className="admin-vendors__header">
        <div>
          <span className="admin-card__eyebrow">Communications</span>
          <h2 className="admin-vendors__title">Announcements &amp; banners</h2>
          <p className="admin-vendors__sub">
            Broadcast operational updates, maintenance windows, compliance notes and promotions across the platform.
          </p>
        </div>
        <div className="admin-vendors__actions">
          <button type="button" className="admin-action">
            <IconDownload size={13} stroke={2} />
            Export log
          </button>
          <button type="button" className="admin-action admin-action--approve">
            <IconPlus size={13} stroke={2} />
            New announcement
          </button>
        </div>
      </header>

      <section className="admin-kpis">
        <StatTile label="Active" value={ANNOUNCEMENT_SUMMARY.active} sub="currently shown to users" tone="success" icon={IconBell} />
        <StatTile label="Users reached · 30d" value={ANNOUNCEMENT_SUMMARY.reaching.toLocaleString()} sub="unique impressions" tone="blue" icon={IconUsers} />
        <StatTile label="Open rate" value={`${ANNOUNCEMENT_SUMMARY.openRate}%`} sub="across channels" tone="green" icon={IconCircleCheck} />
        <StatTile label="Drafts in review" value={ANNOUNCEMENT_SUMMARY.draftPending} sub="awaiting approval" tone="amber" icon={IconFileText} />
      </section>

      <div className="admin-vendors__tabs" role="tablist">
        {ANNOUNCEMENT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`admin-vendors__tab${tab === t.id ? ' admin-vendors__tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.id === 'active' && <IconBell size={16} stroke={1.8} />}
            {t.id === 'scheduled' && <IconClock size={16} stroke={1.8} />}
            {t.id === 'draft' && <IconFileText size={16} stroke={1.8} />}
            {t.id === 'archived' && <IconArchive size={16} stroke={1.8} />}
            {t.label}
            <span className="admin-vendors__tab-count">
              {ANNOUNCEMENTS.filter((a) => a.status === t.id).length}
            </span>
          </button>
        ))}
      </div>

      <div className="admin-orders__filters">
        <div className="admin-vendors__search admin-orders__search">
          <IconSearch size={16} stroke={1.8} />
          <input
            type="search"
            placeholder="Search announcements by title, body or ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search announcements"
          />
        </div>
        <select
          className="admin-orders__vendor-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Category filter"
        >
          <option value="all">All categories</option>
          {ANNOUNCEMENT_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="admin-order-grid">
        <div className="admin-order-grid__main">
          {filtered.length > 0 ? (
            <div className="admin-ann-grid">
              {filtered.map((a) => (
                <AnnouncementCard key={a.id} announcement={a} />
              ))}
            </div>
          ) : (
            <div className="admin-empty">
              <IconSpeakerphone size={32} stroke={1.4} />
              <h3>No announcements in this view</h3>
              <p>Try adjusting the filters or selecting a different status.</p>
            </div>
          )}
        </div>

        <div className="admin-order-grid__side">
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Quick start</span>
                <h3 className="admin-card__title">Targeting templates</h3>
              </div>
            </header>
            <ul className="admin-cmp-team">
              <li className="admin-cmp-team__row">
                <span className="admin-cmp-team__role" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-md)', background: 'var(--color-action-secondary)', color: 'var(--color-action-secondary-text)' }}>
                  <IconUsers size={16} stroke={1.8} />
                </span>
                <div className="admin-cmp-team__body">
                  <span className="admin-cmp-team__name">All employees</span>
                  <span className="admin-cmp-team__role">3 roles · all campuses</span>
                </div>
                <span className="admin-status admin-status--info">11 220</span>
              </li>
              <li className="admin-cmp-team__row">
                <span className="admin-cmp-team__role" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-md)', background: 'var(--color-action-secondary)', color: 'var(--color-action-secondary-text)' }}>
                  <IconBuilding size={16} stroke={1.8} />
                </span>
                <div className="admin-cmp-team__body">
                  <span className="admin-cmp-team__name">Main site</span>
                  <span className="admin-cmp-team__role">Employees only</span>
                </div>
                <span className="admin-status admin-status--info">4 820</span>
              </li>
              <li className="admin-cmp-team__row">
                <span className="admin-cmp-team__role" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-md)', background: 'var(--color-action-secondary)', color: 'var(--color-action-secondary-text)' }}>
                  <IconTag size={16} stroke={1.8} />
                </span>
                <div className="admin-cmp-team__body">
                  <span className="admin-cmp-team__name">Finance &amp; admin</span>
                  <span className="admin-cmp-team__role">Privileged users</span>
                </div>
                <span className="admin-status admin-status--info">18</span>
              </li>
            </ul>
          </section>

          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Recent activity</span>
                <h3 className="admin-card__title">Announcement log</h3>
              </div>
            </header>
            <ul className="admin-activity-list">
              {ANNOUNCEMENT_ACTIVITY.map((entry) => (
                <ActivityItem key={entry.id} item={entry} />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
