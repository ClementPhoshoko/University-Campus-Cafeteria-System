import { useMemo, useState } from 'react';
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
import {
  ADMIN_ORDERS,
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  formatCurrency,
} from './adminMockData.js';

const SAMPLE_ITEMS = [
  { name: 'Chicken Wrap & Salad', qty: 1, price: 45.0 },
  { name: 'House Cappuccino', qty: 1, price: 32.0 },
  { name: 'Berry Scone', qty: 2, price: 28.0 },
  { name: 'Iced Vanilla Latte', qty: 1, price: 32.0 },
  { name: 'Vegetable Pasta', qty: 1, price: 40.0 },
  { name: 'Premium Lager 330ml', qty: 1, price: 35.0 },
];

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

function InterventionModal({ option, order, onConfirm, onCancel }) {
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
            onClick={() => onConfirm(option)}
          >
            Confirm action
          </button>
        </footer>
      </div>
    </div>
  );
}

function TimelineItem({ entry, isLast }) {
  return (
    <li className="admin-timeline__item">
      <span className={`admin-timeline__dot admin-timeline__dot--${ORDER_STATUS_TONES[entry.status] || 'info'}`} />
      <div className="admin-timeline__body">
        <span className="admin-timeline__title">{ORDER_STATUS_LABELS[entry.status] || entry.status}</span>
        <span className="admin-timeline__meta">
          {entry.at} · {entry.actor}
          {entry.reason && <> · <em>{entry.reason}</em></>}
        </span>
      </div>
      {!isLast && <span className="admin-timeline__line" aria-hidden="true" />}
    </li>
  );
}

export default function AdminOrderDetail() {
  const { orderId } = useParams();
  const order = useMemo(() => ADMIN_ORDERS.find((o) => o.id === orderId), [orderId]);
  const [intervention, setIntervention] = useState(null);

  if (!order) {
    return (
      <div className="admin-empty">
        <IconReceipt size={32} stroke={1.4} />
        <h3>Order not found</h3>
        <p>This order may have been removed or archived.</p>
        <Link to="/admin/orders" className="admin-action admin-action--approve">
          <IconChevronLeft size={13} stroke={2} />
          Back to orders
        </Link>
      </div>
    );
  }

  const subtotal = SAMPLE_ITEMS.reduce((sum, item) => sum + item.price * item.qty, 0);
  const serviceFee = subtotal * 0.05;
  const tax = (subtotal - serviceFee) * 0.0;

  const isIssue = [
    ORDER_STATUS.PAYMENT_PENDING,
    ORDER_STATUS.REFUND_PENDING,
    ORDER_STATUS.CANCELLED,
    ORDER_STATUS.REJECTED,
    ORDER_STATUS.COLLECTION_NOT_COMPLETED,
  ].includes(order.status);

  return (
    <div className="admin-order-detail">
      <Link to="/admin/orders" className="admin-back-link">
        <IconChevronLeft size={14} stroke={2} />
        Back to orders
      </Link>

      {/* Hero */}
      <section className={`admin-order-hero${isIssue ? ' admin-order-hero--issue' : ''}`}>
        <div className="admin-order-hero__head">
          <div>
            <span className="admin-vendor-hero__slug">Order</span>
            <h2 className="admin-order-hero__id">#{order.id}</h2>
            <div className="admin-order-hero__meta">
              <StatusPill status={order.status} />
              {order.flags?.map((flag) => (
                <span key={flag} className={`admin-flag admin-flag--${flag === 'urgent' ? 'warning' : flag === 'refund' ? 'success' : flag.includes('cancel') || flag.includes('rejected') || flag === 'uncollected' ? 'error' : 'info'}`}>
                  {flag}
                </span>
              ))}
            </div>
          </div>
          <div className="admin-order-hero__actions">
            <button type="button" className="admin-action">
              <IconHistory size={14} stroke={2} />
              View history
            </button>
            <button type="button" className="admin-action admin-action--approve">
              <IconCircleCheck size={14} stroke={2} />
              Mark resolved
            </button>
          </div>
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
                <span className="admin-card__eyebrow">{order.items} item{order.items !== 1 ? 's' : ''}</span>
                <h3 className="admin-card__title">Order contents</h3>
              </div>
              <span className="admin-card__chip">Total · {formatCurrency(order.total)}</span>
            </header>
            <ul className="admin-order-items">
              {SAMPLE_ITEMS.slice(0, order.items).map((item, idx) => (
                <li key={idx} className="admin-order-item">
                  <span className="admin-order-item__qty">{item.qty}×</span>
                  <div className="admin-order-item__body">
                    <span className="admin-order-item__name">{item.name}</span>
                    <span className="admin-order-item__price">{formatCurrency(item.price * item.qty)}</span>
                  </div>
                </li>
              ))}
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
            <ol className="admin-timeline">
              {order.timeline.map((entry, idx) => (
                <TimelineItem
                  key={`${entry.status}-${idx}`}
                  entry={entry}
                  isLast={idx === order.timeline.length - 1}
                />
              ))}
            </ol>
          </section>
        </div>

        {/* Right column */}
        <div className="admin-order-grid__side">
          {/* Customer */}
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Customer</span>
                <h3 className="admin-card__title">Order info</h3>
              </div>
            </header>

            <div className="admin-vendor-section">
              <h4 className="admin-vendor-section__heading">Customer</h4>
              <InfoRow icon={IconUser} label="Name" value={order.customerName} />
              <InfoRow icon={IconInfoCircle} label="Employee #" value={order.customerNumber} />
              <InfoRow icon={IconMail} label="Email" value={`${order.customerName.split(' ')[0].toLowerCase()}@merchantmunnies.local`} />
            </div>

            <div className="admin-vendor-section">
              <h4 className="admin-vendor-section__heading">Order details</h4>
              <InfoRow icon={IconBuildingStore} label="Vendor" value={order.vendorName} />
              <InfoRow icon={IconMapPin} label="Collection point" value={order.collectionPoint} />
              <InfoRow icon={IconClock} label="Collection slot" value={order.collectionSlot} />
              <InfoRow icon={IconCash} label="Payment" value={`${order.paymentMethod} · ${order.paymentStatus}`} />
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
                  onClick={setIntervention}
                />
              ))}
            </div>
          </section>
        </div>
      </div>

      <InterventionModal
        option={intervention}
        order={order}
        onConfirm={() => setIntervention(null)}
        onCancel={() => setIntervention(null)}
      />
    </div>
  );
}
