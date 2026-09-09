import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  IconChevronLeft,
  IconReceipt,
  IconBuildingStore,
  IconUser,
  IconMail,
  IconClock,
  IconMapPin,
  IconCash,
  IconInfoCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconBan,
  IconArrowBackUp,
  IconArrowRight,
  IconHistory,
  IconFlag,
  IconNotes,
} from '@tabler/icons-react';
import Breadcrumb from '../../components/ui/Breadcrumb.jsx';
import SkeletonTable from '../../components/ui/SkeletonTable.jsx';
import { getOrder, cancelOrder, refundOrder, addOrderNote } from '../../services/adminApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  formatCurrency,
} from './adminMockData.js';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.png';

const INTERVENTION_OPTIONS = [
  {
    id: 'refund',
    label: 'Issue refund',
    description: 'Refund the customer in full. Order will be marked as refunded.',
    tone: 'success',
    icon: IconArrowBackUp,
  },
  {
    id: 'cancel',
    label: 'Force cancel',
    description: 'Cancel this order on behalf of the customer and refund if payment was taken.',
    tone: 'error',
    icon: IconBan,
  },
  {
    id: 'escalate',
    label: 'Escalate to support',
    description: 'Route this order to the support team for manual handling.',
    tone: 'warning',
    icon: IconFlag,
  },
  {
    id: 'note',
    label: 'Add admin note',
    description: 'Attach an internal note visible to admins and support.',
    tone: 'info',
    icon: IconNotes,
  },
];

function StatusPill({ status }) {
  const label = ORDER_STATUS_LABELS[status] || status;
  const tone = ORDER_STATUS_TONES[status] || 'info';
  return <span className={`admin-status admin-status--${tone}`}>{label}</span>;
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

function InterventionCard({ option, onClick }) {
  const Icon = option.icon;
  return (
    <button type="button" className={`admin-intervention admin-intervention--${option.tone}`} onClick={() => onClick(option)}>
      <span className="admin-intervention__icon">
        <Icon size={16} stroke={1.8} />
      </span>
      <div className="admin-intervention__body">
        <span className="admin-intervention__label">{option.label}</span>
        <span className="admin-intervention__desc">{option.description}</span>
      </div>
    </button>
  );
}

function InterventionModal({ option, order, onConfirm, onCancel, api }) {
  if (!option) return null;
  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <div className="admin-modal__overlay" onClick={onCancel} />
      <div className="admin-modal__card">
        <header className="admin-modal__head">
          <div className={`admin-modal__icon admin-modal__icon--${option.tone}`}>
            <option.icon size={20} stroke={2} />
          </div>
          <div>
            <h3 className="admin-modal__title">{option.label}</h3>
            <p className="admin-modal__sub">
              Order #{order?.id} · {formatCurrency(order?.total || 0)}
            </p>
          </div>
        </header>

        <p className="admin-modal__copy">{option.description}</p>

        <label className="admin-modal__field">
          <span>Reason / notes {option.id !== 'note' && <em>(required)</em>}</span>
          <textarea
            className="admin-modal__textarea"
            placeholder="Provide context for the audit log..."
            rows={4}
          />
        </label>

        {(option.id === 'refund' || option.id === 'cancel') && (
          <div className="admin-modal__check">
            <input type="checkbox" id="notify-customer" defaultChecked />
            <label htmlFor="notify-customer">Notify customer by email</label>
          </div>
        )}

        <footer className="admin-modal__foot">
          <button type="button" className="admin-action" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className={`admin-action admin-action--${option.tone === 'error' ? 'reject' : option.tone === 'success' ? 'approve' : 'approve'}`}
            onClick={() => onConfirm(option, api)}
          >
            Confirm action
          </button>
        </footer>
      </div>
    </div>
  );
}

function TimelineItem({ entry, isLast }) {
  const status = entry.new_status;
  const label = ORDER_STATUS_LABELS[status] || status;
  const tone = ORDER_STATUS_TONES[status] || 'info';
  const time = entry.changed_at ? new Date(entry.changed_at).toLocaleString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  const actor = entry.changed_by ? entry.changed_by.substring(0, 8) + '...' : 'System';

  return (
    <li className="admin-timeline__item">
      <span className={`admin-timeline__dot admin-timeline__dot--${tone}`} />
      <div className="admin-timeline__body">
        <span className="admin-timeline__title">{label}</span>
        <span className="admin-timeline__meta">
          {time} · {actor}
          {entry.reason && <> · <em>{entry.reason}</em></>}
        </span>
      </div>
      {!isLast && <span className="admin-timeline__line" aria-hidden="true" />}
    </li>
  );
}

export default function AdminOrderDetail() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [intervention, setIntervention] = useState(null);
  const { session } = useAuth();
  const token = session?.access_token;

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId || !token) return;
      try {
        const response = await getOrder(token, orderId);
        setOrder(response.order);
      } catch (err) {
        console.error('Failed to fetch order:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, token]);

  if (loading) return <div className="admin-order-detail"><Breadcrumb homeLabel="Dashboard" homeTo="/admin" items={[{ label: 'Orders', to: '/admin/orders' }, { label: 'Loading...' }]} /><section className="admin-user-hero"><div className="admin-user-hero__avatar admin-user-hero__avatar--order"><span className="skeleton" style={{ width: 56, height: 56, borderRadius: 'var(--radius-full)' }} /></div><div className="admin-user-hero__info"><div className="admin-user-hero__head"><span className="skeleton skeleton--kpi-value" style={{ width: 100 }} /></div><div className="skeleton skeleton--title" style={{ width: '30%', marginTop: 8 }} /><div className="skeleton skeleton--text" style={{ width: '40%', marginTop: 8 }} /></div></section><SkeletonTable rows={4} columns={3} /></div>;
  if (!order) {
    return (
      <div className="admin-empty">
        <img src={emptyStateAvatar} alt="" className="admin-empty__avatar" />
        <h3>Order not found</h3>
        <p>This order may have been removed or archived.</p>
        <Link to="/admin/orders" className="admin-action--ghost">
          <IconChevronLeft size={13} stroke={2} />
          Back to orders
        </Link>
      </div>
    );
  }

  const subtotal = order.subtotal || 0;
  const serviceFee = order.service_fee || 0;
  const tax = order.tax || 0;

  const ISSUE_STATUSES = ['payment_pending', 'refund_pending', 'cancelled', 'rejected', 'collection_not_completed'];
  const isIssue = ISSUE_STATUSES.includes(order.status);

  const api = {
    post: (path, body) => {
      // In a real implementation, this would make an actual API call
      // For now, we'll just log the action
      console.log(`API POST ${path}`, body);
    },
  };

  return (
    <div className="admin-order-detail">
      <Breadcrumb
        homeLabel="Dashboard"
        homeTo="/admin"
        items={[
          { label: 'Orders', to: '/admin/orders' },
          { label: `#${order.id}` }
        ]}
      />

      {/* Hero */}
      <section className={`admin-user-hero${isIssue ? ' admin-user-hero--inactive' : ''}`}>
        <div className="admin-user-hero__avatar admin-user-hero__avatar--order">
          <IconReceipt size={32} stroke={1.6} />
        </div>
        <div className="admin-user-hero__info">
          <div className="admin-user-hero__head">
            <span className="admin-user-hero__slug">Order #{order.id}</span>
            <StatusPill status={order.status} />
            {order.flags?.filter((f) => !['refund', 'uncollected', 'cancelled', 'rejected'].includes(f)).map((flag) => (
              <span key={flag} className={`admin-flag admin-flag--${flag === 'urgent' ? 'warning' : 'info'}`}>
                {flag}
              </span>
            ))}
          </div>
          <h2 className="admin-user-hero__name">{order.vendor_name}</h2>
          <span className="admin-user-hero__email">{order.user_full_name} · {order.employee_number}</span>
          <div className="admin-user-hero__roles">
            <span className="admin-user-hero__vendor">
              <IconBuildingStore size={12} stroke={1.8} />
              {order.item_count} items · {formatCurrency(order.total)}
            </span>
            <span className="admin-user-hero__vendor">
              <IconClock size={12} stroke={1.8} />
              {order.collection_point_name}
            </span>
          </div>
        </div>
        <div className="admin-order-hero__actions">
          <button type="button" className="admin-action--ghost">
            <IconHistory size={14} stroke={2} />
            View history
          </button>
          <button type="button" className="admin-action--ghost">
            <IconCircleCheck size={14} stroke={2} />
            Mark resolved
          </button>
        </div>
      </section>

      {/* Main grid */}
      <div className="admin-order-grid">
        {/* Left column */}
        <div className="admin-order-grid__main">
          {/* Items */}
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">{order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}</span>
                <h3 className="admin-card__title">Order contents</h3>
              </div>
              <span className="admin-card__chip">Total · {formatCurrency(order.total)}</span>
            </header>
            <ul className="admin-order-items">
              {(order.items || []).map((item) => (
                <li key={item.id} className="admin-order-item">
                  <span className="admin-order-item__qty">{item.quantity}×</span>
                  <div className="admin-order-item__body">
                    <span className="admin-order-item__name">{item.item_name_snapshot}</span>
                    <span className="admin-order-item__price">{formatCurrency(item.line_total)}</span>
                  </div>
                </li>
              ))}
              {(!order.items || order.items.length === 0) && <li className="admin-order-item"><span className="admin-order-item__name" style={{ color: 'var(--color-text-tertiary)' }}>No item details available</span></li>}
            </ul>

            <div className="admin-order-totals">
              <div className="admin-order-total-row">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="admin-order-total-row">
                <span>Service fee</span>
                <span>{formatCurrency(serviceFee)}</span>
              </div>
              <div className="admin-order-total-row admin-order-total-row--grand">
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </section>

          {/* Timeline */}
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Status history</span>
                <h3 className="admin-card__title">Order timeline</h3>
              </div>
            </header>
            <div className="admin-order-timeline">
              {order.timeline.map((entry, idx) => {
                const status = entry.new_status;
                const label = ORDER_STATUS_LABELS[status] || status;
                const tone = ORDER_STATUS_TONES[status] || 'info';
                const time = entry.changed_at ? new Date(entry.changed_at).toLocaleString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
                const isLast = idx === order.timeline.length - 1;
                return (
                  <div key={`${status}-${idx}`} className={`admin-order-timeline__step admin-order-timeline__step--${tone}${isLast ? ' admin-order-timeline__step--current' : ''}`}>
                    <div className="admin-order-timeline__marker">
                      <span className="admin-order-timeline__dot" />
                      {!isLast && <span className="admin-order-timeline__connector" />}
                    </div>
                    <div className="admin-order-timeline__content">
                      <span className="admin-order-timeline__label">{label}</span>
                      <span className="admin-order-timeline__time">{time}</span>
                      {entry.reason && <span className="admin-order-timeline__reason">{entry.reason}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="admin-order-grid__side">
          {/* Customer */}
          <section className="admin-card admin-card--order-detail">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Customer</span>
                <h3 className="admin-card__title">Order info</h3>
              </div>
            </header>

            <div className="admin-vendor-section">
              <h4 className="admin-vendor-section__heading">Customer</h4>
              <InfoRow icon={IconUser} label="Name" value={order.user_full_name} />
              <InfoRow icon={IconInfoCircle} label="Employee #" value={order.employee_number} />
              <InfoRow icon={IconMail} label="Email" value={`${order.user_full_name.split(' ')[0].toLowerCase()}@merchantmunnies.local`} />
            </div>

            <div className="admin-vendor-section">
              <h4 className="admin-vendor-section__heading">Order details</h4>
              <InfoRow icon={IconBuildingStore} label="Vendor" value={order.vendor_name} />
              <InfoRow icon={IconMapPin} label="Collection point" value={order.collection_point_name} />
              <InfoRow icon={IconClock} label="Submitted at" value={order.submitted_at} />
              <InfoRow icon={IconCash} label="Payment" value={`${order.payment_method} · ${order.payment_status}`} />
            </div>
          </section>

          {/* Interventions */}
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Tools</span>
                <h3 className="admin-card__title">Intervention actions</h3>
              </div>
              <span className="admin-card__chip admin-card__chip--warning">
                <IconAlertTriangle size={12} stroke={2} />
                {isIssue ? 'Issue detected' : 'Use with care'}
              </span>
            </header>
            <div className="admin-interventions">
              {INTERVENTION_OPTIONS.map((option) => (
                <InterventionCard
                  key={option.id}
                  option={option}
                  onClick={() => setIntervention(option)}
                />
              ))}
            </div>
          </section>
        </div>
      </div>

      <InterventionModal
        option={intervention}
        order={order}
        onConfirm={async (option) => {
          const { id } = option;
          const reason = '';
          try {
            if (id === 'refund') {
              await refundOrder(token, order.id, { reason });
            } else if (id === 'cancel') {
              await cancelOrder(token, order.id, { reason });
            } else if (id === 'note') {
              await addOrderNote(token, order.id, { note: reason || 'Admin note' });
            }
            const refreshed = await getOrder(token, order.id);
            setOrder(refreshed.order);
          } catch (err) {
            console.error('Intervention failed:', err);
          }
          setIntervention(null);
        }}
        onCancel={() => setIntervention(null)}
      />
    </div>
  );
}