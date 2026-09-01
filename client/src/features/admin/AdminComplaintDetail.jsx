import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  IconChevronLeft,
  IconAlertTriangle,
  IconUser,
  IconReceipt,
  IconBuildingStore,
  IconStar,
  IconStarFilled,
  IconMessage,
  IconClock,
  IconCheck,
  IconUserPlus,
  IconLock,
  IconShield,
  IconHistory,
  IconArrowBackUp,
  IconNote,
} from '@tabler/icons-react';
import {
  COMPLAINTS,
  COMPLAINT_MESSAGES,
  COMPLAINT_ACTIVITY,
  COMPLAINT_TEAM,
  COMPLAINT_STATUSES,
  COMPLAINT_CATEGORIES,
  formatCurrency,
} from './adminMockData.js';

const PRIORITY_TONE = {
  urgent: 'error',
  high: 'warning',
  medium: 'info',
  low: 'success',
};

function Stars({ value, max = 5, label }) {
  if (value === null || value === undefined) {
    return (
      <div className="admin-cmp-rating__line">
        <span className="admin-cmp-rating__label">{label}</span>
        <span className="admin-stars__na">n/a</span>
      </div>
    );
  }
  return (
    <div className="admin-cmp-rating__line">
      <span className="admin-cmp-rating__label">{label}</span>
      <span className="admin-stars">
        {Array.from({ length: max }).map((_, i) => (
          i < value ? (
            <IconStarFilled key={i} size={13} stroke={0} className="admin-stars__on" />
          ) : (
            <IconStar key={i} size={13} stroke={1.5} className="admin-stars__off" />
          )
        ))}
      </span>
      <span className="admin-cmp-rating__value">{value}.0</span>
    </div>
  );
}

function StatusPill({ status }) {
  const cfg = COMPLAINT_STATUSES.find((s) => s.id === status);
  if (!cfg) return null;
  return <span className={`admin-status admin-status--${cfg.tone}`}>{cfg.label}</span>;
}

function PriorityPill({ priority }) {
  return (
    <span className={`admin-status admin-status--${PRIORITY_TONE[priority]}`}>{priority}</span>
  );
}

function Avatar({ name, size = 36 }) {
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

function MessageBubble({ message, isLast }) {
  const isSupport = message.role === 'support';
  return (
    <li className={`admin-cmp-thread__item admin-cmp-thread__item--${isSupport ? 'support' : 'customer'}`}>
      <Avatar name={message.sender} />
      <div className="admin-cmp-thread__bubble">
        <div className="admin-cmp-thread__head">
          <span className="admin-cmp-thread__name">{message.sender}</span>
          <span className="admin-cmp-thread__time">{message.time}</span>
        </div>
        <p className="admin-cmp-thread__body">{message.body}</p>
      </div>
    </li>
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

function AssignModal({ onClose, onAssign }) {
  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <div className="admin-modal__overlay" onClick={onClose} />
      <div className="admin-modal__card">
        <header className="admin-modal__head">
          <div className="admin-modal__icon admin-modal__icon--info">
            <IconUserPlus size={20} stroke={2} />
          </div>
          <div>
            <h3 className="admin-modal__title">Assign to support agent</h3>
            <p className="admin-modal__sub">Pick the team member who should own this complaint.</p>
          </div>
        </header>

        <ul className="admin-role-list">
          {COMPLAINT_TEAM.map((member) => (
            <li key={member.id} className="admin-role-list__item admin-role-list__item--clickable">
              <Avatar name={member.name} />
              <label className="admin-role-list__label">
                <span className="admin-cmp-team__name">{member.name}</span>
                <span className="admin-role-list__hint">Support agent · {member.role}</span>
              </label>
              <input type="radio" name="assign" defaultChecked={member.id === 't-thuli'} />
            </li>
          ))}
        </ul>

        <label className="admin-modal__field">
          <span>Internal note (added to timeline)</span>
          <textarea
            className="admin-modal__textarea"
            placeholder="Optional context for the agent…"
            rows={3}
          />
        </label>

        <footer className="admin-modal__foot">
          <button type="button" className="admin-action" onClick={onClose}>Cancel</button>
          <button type="button" className="admin-action admin-action--approve" onClick={onAssign}>
            <IconCheck size={13} stroke={2} />
            Assign
          </button>
        </footer>
      </div>
    </div>
  );
}

function ResolveModal({ onClose, onConfirm }) {
  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <div className="admin-modal__overlay" onClick={onClose} />
      <div className="admin-modal__card">
        <header className="admin-modal__head">
          <div className="admin-modal__icon admin-modal__icon--success">
            <IconCheck size={20} stroke={2} />
          </div>
          <div>
            <h3 className="admin-modal__title">Resolve complaint</h3>
            <p className="admin-modal__sub">Document the resolution for the audit trail and notify the customer.</p>
          </div>
        </header>

        <label className="admin-modal__field">
          <span>Resolution notes (required)</span>
          <textarea
            className="admin-modal__textarea"
            placeholder="What was the resolution? Refund issued? Vendor contacted? Updated menu?"
            rows={4}
          />
        </label>

        <div className="admin-modal__check">
          <input type="checkbox" id="notify-resolution" defaultChecked />
          <label htmlFor="notify-resolution">Notify customer by email</label>
        </div>

        <footer className="admin-modal__foot">
          <button type="button" className="admin-action" onClick={onClose}>Cancel</button>
          <button type="button" className="admin-action admin-action--approve" onClick={onConfirm}>
            <IconCheck size={13} stroke={2} />
            Mark resolved
          </button>
        </footer>
      </div>
    </div>
  );
}

function RefundModal({ onClose, onConfirm }) {
  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <div className="admin-modal__overlay" onClick={onClose} />
      <div className="admin-modal__card">
        <header className="admin-modal__head">
          <div className="admin-modal__icon admin-modal__icon--success">
            <IconArrowBackUp size={20} stroke={2} />
          </div>
          <div>
            <h3 className="admin-modal__title">Issue refund</h3>
            <p className="admin-modal__sub">Refund is processed through the payment provider · 1–2 days.</p>
          </div>
        </header>

        <div className="admin-form-grid">
          <label className="admin-modal__field admin-modal__field--full">
            <span>Order</span>
            <input type="text" className="admin-input" defaultValue="#48201" />
          </label>
          <label className="admin-modal__field">
            <span>Amount (ZAR)</span>
            <input type="text" className="admin-input" defaultValue="215.00" />
          </label>
          <label className="admin-modal__field">
            <span>Refund method</span>
            <select className="admin-input">
              <option>Original payment method</option>
              <option>Bank credit</option>
              <option>Voucher credit</option>
            </select>
          </label>
        </div>

        <label className="admin-modal__field">
          <span>Reason for refund</span>
          <textarea
            className="admin-modal__textarea"
            placeholder="e.g. Order wrong item; vendor confirmed mispack."
            rows={3}
          />
        </label>

        <footer className="admin-modal__foot">
          <button type="button" className="admin-action" onClick={onClose}>Cancel</button>
          <button type="button" className="admin-action admin-action--approve" onClick={onConfirm}>
            <IconArrowBackUp size={13} stroke={2} />
            Issue refund
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function AdminComplaintDetail() {
  const { complaintId } = useParams();
  const complaint = useMemo(() => COMPLAINTS.find((c) => c.id === complaintId), [complaintId]);
  const [assigning, setAssigning] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [refunding, setRefunding] = useState(false);

  if (!complaint) {
    return (
      <div className="admin-empty">
        <IconAlertTriangle size={32} stroke={1.4} />
        <h3>Complaint not found</h3>
        <p>This complaint may have been removed or archived.</p>
        <Link to="/admin/complaints" className="admin-action admin-action--approve">
          <IconChevronLeft size={13} stroke={2} />
          Back to complaints
        </Link>
      </div>
    );
  }

  const isResolved = ['resolved', 'closed'].includes(complaint.status);
  const rating = complaint.rating;
  const categoryCfg = COMPLAINT_CATEGORIES.find((c) => c.id === complaint.category);

  return (
    <div className="admin-order-detail">
      <Link to="/admin/complaints" className="admin-back-link">
        <IconChevronLeft size={14} stroke={2} />
        Back to complaints
      </Link>

      {/* Hero */}
      <section className={`admin-cmp-hero${complaint.priority === 'urgent' ? ' admin-cmp-hero--urgent' : ''}`}>
        <div className="admin-cmp-hero__top">
          <div className="admin-cmp-hero__head">
            <span className="admin-vendor-hero__slug">{complaint.id}</span>
            <PriorityPill priority={complaint.priority} />
            <StatusPill status={complaint.status} />
            <span className="admin-tag admin-tag--blue">{categoryCfg?.label}</span>
          </div>
          <h2 className="admin-cmp-hero__title">{complaint.subject}</h2>
          <p className="admin-cmp-hero__copy">{complaint.description}</p>

          <div className="admin-cmp-hero__meta">
            <span><IconClock size={13} stroke={1.8} /> {complaint.submitted}</span>
            {complaint.vendor && (
              <Link to={`/admin/vendors/${complaint.vendorId}`} className="admin-cmp-hero__vendor">
                <IconBuildingStore size={13} stroke={1.8} /> {complaint.vendor}
              </Link>
            )}
            {complaint.order && (
              <Link to={`/admin/orders/${complaint.order.replace('#', '')}`} className="admin-cmp-hero__vendor">
                <IconReceipt size={13} stroke={1.8} /> {complaint.order}
              </Link>
            )}
          </div>
        </div>

        <div className="admin-order-hero__actions">
          <button type="button" className="admin-action" onClick={() => setAssigning(true)}>
            <IconUserPlus size={13} stroke={2} />
            {complaint.assignedTo ? 'Reassign' : 'Assign'}
          </button>
          <button type="button" className="admin-action" onClick={() => setRefunding(true)}>
            <IconArrowBackUp size={13} stroke={2} />
            Issue refund
          </button>
          {!isResolved && (
            <button type="button" className="admin-action admin-action--approve" onClick={() => setResolving(true)}>
              <IconCheck size={13} stroke={2} />
              Resolve
            </button>
          )}
        </div>
      </section>

      <div className="admin-order-grid">
        <div className="admin-order-grid__main">
          {/* Conversation thread */}
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Conversation</span>
                <h3 className="admin-card__title">Thread · {COMPLAINT_MESSAGES.length} messages</h3>
              </div>
              <span className="admin-card__chip admin-card__chip--success">
                <IconLock size={13} stroke={2} /> Encrypted
              </span>
            </header>

            <ul className="admin-cmp-thread">
              {COMPLAINT_MESSAGES.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </ul>

            <div className="admin-cmp-thread__compose">
              <textarea
                className="admin-input admin-cmp-thread__textarea"
                placeholder="Type your reply here…"
                rows={3}
              />
              <div className="admin-cmp-thread__compose-actions">
                <label className="admin-modal__check">
                  <input type="checkbox" defaultChecked />
                  <span>Send copy to internal team</span>
                </label>
                <button type="button" className="admin-action admin-action--approve">
                  <IconMessage size={13} stroke={2} />
                  Send reply
                </button>
              </div>
            </div>
          </section>

          {/* Activity log */}
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Audit trail</span>
                <h3 className="admin-card__title">Case activity</h3>
              </div>
              <span className="admin-card__chip">
                <IconHistory size={13} stroke={2} /> Auto-tracked
              </span>
            </header>
            <ul className="admin-activity-list">
              {COMPLAINT_ACTIVITY.map((entry) => (
                <ActivityItem key={entry.id} item={entry} />
              ))}
            </ul>
          </section>
        </div>

        <div className="admin-order-grid__side">
          {/* Customer */}
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Customer</span>
                <h3 className="admin-card__title">About the customer</h3>
              </div>
            </header>

            <div className="admin-vendor-section">
              <h4 className="admin-vendor-section__heading">Identity</h4>
              <div className="admin-cmp-customer-large">
                <Avatar name={complaint.user} size={48} />
                <div>
                  <span className="admin-cmp-customer-large__name">{complaint.user}</span>
                  <span className="admin-cmp-customer-large__num">{complaint.userNumber}</span>
                </div>
              </div>
            </div>

            <div className="admin-vendor-section">
              <h4 className="admin-vendor-section__heading">Recent ratings</h4>
              <div className="admin-cmp-rating">
                <Stars label="Overall" value={rating?.overall} />
                <Stars label="Food" value={rating?.food} />
                <Stars label="Prep time" value={rating?.prep} />
                <Stars label="Collection" value={rating?.collection} />
                <Stars label="Service" value={rating?.service} />
              </div>
            </div>
          </section>

          {/* Resolution */}
          {isResolved && complaint.resolution && (
            <section className="admin-card admin-cmp-resolved">
              <header className="admin-card__head">
                <div>
                  <span className="admin-card__eyebrow">
                    <IconCheck size={12} stroke={2} /> Closed
                  </span>
                  <h3 className="admin-card__title">Resolution</h3>
                </div>
              </header>
              <p className="admin-cmp-resolved__copy">{complaint.resolution}</p>
              <span className="admin-cmp-resolved__time">
                <IconClock size={11} stroke={1.8} /> Resolved {complaint.resolvedAt}
              </span>
            </section>
          )}

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
                  <IconUserPlus size={16} stroke={1.8} />
                </span>
                <div className="admin-intervention__body">
                  <span className="admin-intervention__label">Assign / reassign</span>
                  <span className="admin-intervention__desc">Route to a support agent.</span>
                </div>
              </button>
              <button
                type="button"
                className="admin-intervention admin-intervention--warning"
                onClick={() => setRefunding(true)}
              >
                <span className="admin-intervention__icon">
                  <IconArrowBackUp size={16} stroke={1.8} />
                </span>
                <div className="admin-intervention__body">
                  <span className="admin-intervention__label">Issue refund</span>
                  <span className="admin-intervention__desc">Process via payment provider.</span>
                </div>
              </button>
              <button
                type="button"
                className={`admin-intervention ${isResolved ? 'admin-intervention--info' : 'admin-intervention--success'}`}
                onClick={() => setResolving(true)}
              >
                <span className="admin-intervention__icon">
                  <IconCheck size={16} stroke={1.8} />
                </span>
                <div className="admin-intervention__body">
                  <span className="admin-intervention__label">{isResolved ? 'Re-open case' : 'Mark resolved'}</span>
                  <span className="admin-intervention__desc">{isResolved ? 'Customer appealed or new evidence.' : 'Document the resolution.'}</span>
                </div>
              </button>
              <button type="button" className="admin-intervention admin-intervention--error">
                <span className="admin-intervention__icon">
                  <IconNote size={16} stroke={1.8} />
                </span>
                <div className="admin-intervention__body">
                  <span className="admin-intervention__label">Vendor warning</span>
                  <span className="admin-intervention__desc">Send formal note to vendor.</span>
                </div>
              </button>
            </div>
          </section>
        </div>
      </div>

      {assigning && <AssignModal onClose={() => setAssigning(false)} onAssign={() => setAssigning(false)} />}
      {resolving && <ResolveModal onClose={() => setResolving(false)} onConfirm={() => setResolving(false)} />}
      {refunding && <RefundModal onClose={() => setRefunding(false)} onConfirm={() => setRefunding(false)} />}
    </div>
  );
}
