import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  IconChevronLeft,
  IconSpeakerphone,
  IconEye,
  IconCheck,
  IconCalendar,
  IconUsers,
  IconBuilding,
  IconTag,
  IconExternalLink,
  IconEdit,
  IconArchive,
  IconTrash,
  IconCopy,
  IconCircleCheck,
  IconAlertTriangle,
} from '@tabler/icons-react';
import {
  ANNOUNCEMENTS,
  ANNOUNCEMENT_ACTIVITY,
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_CHANNELS,
} from './adminMockData.js';

const SEVERITY_TONE = {
  info: 'info',
  success: 'success',
  warning: 'warning',
};

const SEVERITY_BORDER = {
  info: 'admin-ann-hero--info',
  success: 'admin-ann-hero--success',
  warning: 'admin-ann-hero--warning',
};

const STATUS_TONE = {
  active: 'success',
  scheduled: 'info',
  draft: 'warning',
  archived: 'info',
};

const STATUS_LABEL = {
  active: 'Active',
  scheduled: 'Scheduled',
  draft: 'Draft',
  archived: 'Archived',
};

const CHANNEL_LABEL = {
  in_app: 'In-app',
  push: 'Push',
  email: 'Email',
};

function StatusPill({ status }) {
  return (
    <span className={`admin-status admin-status--${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status] || status}
    </span>
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

function StatTile({ label, value, sub, tone }) {
  return (
    <div className={`admin-kpi admin-kpi--${tone || 'blue'}`}>
      <span className="admin-kpi__label">{label}</span>
      <span className="admin-kpi__value">{value}</span>
      {sub && <span className="admin-kpi__sub">{sub}</span>}
    </div>
  );
}

export default function AdminAnnouncementDetail() {
  const { announcementId } = useParams();
  const announcement = useMemo(
    () => ANNOUNCEMENTS.find((a) => a.id === announcementId),
    [announcementId]
  );

  if (!announcement) {
    return (
      <div className="admin-empty">
        <IconSpeakerphone size={32} stroke={1.4} />
        <h3>Announcement not found</h3>
        <p>This announcement may have been removed.</p>
        <Link to="/admin/announcements" className="admin-action admin-action--approve">
          <IconChevronLeft size={13} stroke={2} />
          Back to announcements
        </Link>
      </div>
    );
  }

  const reach = announcement.reach;
  const openRate = reach && reach.delivered > 0
    ? Math.round((reach.opened / reach.delivered) * 100)
    : 0;
  const clickRate = reach && reach.delivered > 0
    ? Math.round((reach.clicked / reach.delivered) * 100)
    : 0;

  return (
    <div className="admin-order-detail">
      <Link to="/admin/announcements" className="admin-back-link">
        <IconChevronLeft size={14} stroke={2} />
        Back to announcements
      </Link>

      {/* Hero */}
      <section className={`admin-ann-hero ${SEVERITY_BORDER[announcement.severity] || ''}`}>
        <div className="admin-ann-hero__top">
          <div className="admin-vendor-hero__head">
            <span className="admin-vendor-hero__slug">{announcement.id}</span>
            <StatusPill status={announcement.status} />
            <span className="admin-tag admin-tag--blue">{announcement.categoryLabel}</span>
            <span className={`admin-status admin-status--${SEVERITY_TONE[announcement.severity]}`}>
              {announcement.severity}
            </span>
          </div>
          <h2 className="admin-ann-hero__title">{announcement.title}</h2>
          <p className="admin-ann-hero__copy">{announcement.body}</p>

          <div className="admin-ann-hero__schedule">
            <span><IconCalendar size={13} stroke={1.8} /> Starts {announcement.startsAt}</span>
            <span><IconCalendar size={13} stroke={1.8} /> Ends {announcement.endsAt}</span>
            <span>· Created by {announcement.createdBy}</span>
          </div>
        </div>
        <div className="admin-order-hero__actions">
          <button type="button" className="admin-action">
            <IconEdit size={13} stroke={2} />
            Edit
          </button>
          <button type="button" className="admin-action">
            <IconEye size={13} stroke={2} />
            Preview
          </button>
          <button type="button" className="admin-action">
            <IconCopy size={13} stroke={2} />
            Duplicate
          </button>
          {announcement.status !== 'archived' ? (
            <button type="button" className="admin-action admin-action--reject">
              <IconArchive size={13} stroke={2} />
              Archive
            </button>
          ) : (
            <button type="button" className="admin-action admin-action--reject">
              <IconTrash size={13} stroke={2} />
              Delete
            </button>
          )}
        </div>
      </section>

      {/* Reach KPIs (only when targeting data exists) */}
      {reach && (
        <section className="admin-kpis" aria-label="Reach metrics">
          <StatTile label="Targeted" value={reach.targeted.toLocaleString()} sub="eligible users" tone="blue" />
          <StatTile label="Delivered" value={reach.delivered.toLocaleString()} sub={`${Math.round((reach.delivered / reach.targeted) * 100)}% of target`} tone="green" />
          <StatTile label="Open rate" value={`${openRate}%`} sub={`${reach.opened.toLocaleString()} opens`} tone="blue" />
          <StatTile label="Click rate" value={`${clickRate}%`} sub={`${reach.clicked.toLocaleString()} click-throughs`} tone="amber" />
        </section>
      )}

      <div className="admin-order-grid">
        <div className="admin-order-grid__main">
          {/* Preview card */}
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">User preview</span>
                <h3 className="admin-card__title">How it appears to a targeted user</h3>
              </div>
              <span className="admin-card__chip admin-card__chip--success">
                <IconCircleCheck size={13} stroke={2} /> Live preview
              </span>
            </header>

            <div className="admin-ann-preview">
              <div className="admin-ann-preview__chrome">
                <span className="admin-ann-preview__dot" />
                <span className="admin-ann-preview__dot" />
                <span className="admin-ann-preview__dot" />
                <span>Merchant Munchies · In-app</span>
              </div>
              <div className={`admin-ann-preview__banner admin-ann-preview__banner--${announcement.severity}`}>
                <span className="admin-ann-preview__icon">
                  <IconSpeakerphone size={16} stroke={1.8} />
                </span>
                <div>
                  <span className="admin-ann-preview__title">{announcement.title}</span>
                  <span className="admin-ann-preview__copy">{announcement.body}</span>
                </div>
              </div>
              <div className="admin-ann-preview__body">
                <span className="admin-ann-preview__placeholder">Home page content remains visible while the banner is shown.</span>
                <span className="admin-ann-preview__placeholder">Users can dismiss the banner via the × control.</span>
              </div>
            </div>
          </section>

          {/* Reach funnel */}
          {reach && (
            <section className="admin-card">
              <header className="admin-card__head">
                <div>
                  <span className="admin-card__eyebrow">Reach funnel</span>
                  <h3 className="admin-card__title">Audience breakdown</h3>
                </div>
              </header>
              <ul className="admin-reach-funnel">
                <li className="admin-reach-funnel__row">
                  <span className="admin-reach-funnel__label">Targeted users</span>
                  <div className="admin-reach-funnel__bar">
                    <span className="admin-reach-funnel__bar-fill" style={{ width: '100%' }} />
                  </div>
                  <span className="admin-reach-funnel__value">{reach.targeted.toLocaleString()}</span>
                </li>
                <li className="admin-reach-funnel__row">
                  <span className="admin-reach-funnel__label">Delivered</span>
                  <div className="admin-reach-funnel__bar">
                    <span className="admin-reach-funnel__bar-fill admin-reach-funnel__bar-fill--success" style={{ width: `${(reach.delivered / reach.targeted) * 100}%` }} />
                  </div>
                  <span className="admin-reach-funnel__value">{reach.delivered.toLocaleString()}</span>
                </li>
                <li className="admin-reach-funnel__row">
                  <span className="admin-reach-funnel__label">Opened</span>
                  <div className="admin-reach-funnel__bar">
                    <span className="admin-reach-funnel__bar-fill admin-reach-funnel__bar-fill--blue" style={{ width: `${(reach.opened / reach.targeted) * 100}%` }} />
                  </div>
                  <span className="admin-reach-funnel__value">{reach.opened.toLocaleString()}</span>
                </li>
                <li className="admin-reach-funnel__row">
                  <span className="admin-reach-funnel__label">Clicked</span>
                  <div className="admin-reach-funnel__bar">
                    <span className="admin-reach-funnel__bar-fill admin-reach-funnel__bar-fill--amber" style={{ width: `${(reach.clicked / reach.targeted) * 100}%` }} />
                  </div>
                  <span className="admin-reach-funnel__value">{reach.clicked.toLocaleString()}</span>
                </li>
                <li className="admin-reach-funnel__row">
                  <span className="admin-reach-funnel__label">Dismissed</span>
                  <div className="admin-reach-funnel__bar">
                    <span className="admin-reach-funnel__bar-fill admin-reach-funnel__bar-fill--danger" style={{ width: `${(reach.dismissed / reach.targeted) * 100}%` }} />
                  </div>
                  <span className="admin-reach-funnel__value">{reach.dismissed.toLocaleString()}</span>
                </li>
              </ul>
            </section>
          )}
        </div>

        <div className="admin-order-grid__side">
          {/* Targeting card */}
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Targeting</span>
                <h3 className="admin-card__title">Audience &amp; channels</h3>
              </div>
            </header>

            <div className="admin-vendor-section">
              <h4 className="admin-vendor-section__heading">Audience roles</h4>
              <div className="admin-ann-target-chips">
                {announcement.audienceRoles.map((role) => (
                  <span key={role} className="admin-tag admin-tag--blue">
                    <IconUsers size={11} stroke={1.8} /> {role.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>

            <div className="admin-vendor-section">
              <h4 className="admin-vendor-section__heading">Sites</h4>
              <div className="admin-ann-target-chips">
                <span className="admin-tag admin-tag--success">
                    <IconBuilding size={11} stroke={1.8} /> {announcement.site_name || 'All campuses'}
                  </span>
              </div>
            </div>

            <div className="admin-vendor-section">
              <h4 className="admin-vendor-section__heading">Channels</h4>
              <div className="admin-ann-target-chips">
                {announcement.channels.map((c) => (
                  <span key={c} className="admin-tag">
                    <IconTag size={11} stroke={1.8} /> {CHANNEL_LABEL[c] || c}
                  </span>
                ))}
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
              <button type="button" className="admin-intervention admin-intervention--info">
                <span className="admin-intervention__icon">
                  <IconEdit size={16} stroke={1.8} />
                </span>
                <div className="admin-intervention__body">
                  <span className="admin-intervention__label">Edit announcement</span>
                  <span className="admin-intervention__desc">Update copy, schedule or audience.</span>
                </div>
              </button>
              <button type="button" className="admin-intervention admin-intervention--success">
                <span className="admin-intervention__icon">
                  <IconEye size={16} stroke={1.8} />
                </span>
                <div className="admin-intervention__body">
                  <span className="admin-intervention__label">Live preview</span>
                  <span className="admin-intervention__desc">See how each channel renders.</span>
                </div>
              </button>
              <button type="button" className="admin-intervention admin-intervention--warning">
                <span className="admin-intervention__icon">
                  <IconExternalLink size={16} stroke={1.8} />
                </span>
                <div className="admin-intervention__body">
                  <span className="admin-intervention__label">Resend / recap</span>
                  <span className="admin-intervention__desc">Trigger delivery to non-openers.</span>
                </div>
              </button>
              <button type="button" className="admin-intervention admin-intervention--error">
                <span className="admin-intervention__icon">
                  <IconArchive size={16} stroke={1.8} />
                </span>
                <div className="admin-intervention__body">
                  <span className="admin-intervention__label">Archive</span>
                  <span className="admin-intervention__desc">Hide from end-users immediately.</span>
                </div>
              </button>
            </div>
          </section>

          {/* Audit trail */}
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Audit trail</span>
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
