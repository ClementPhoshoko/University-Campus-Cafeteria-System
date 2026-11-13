import { useEffect, useState } from 'react';
import { IconAlertTriangle, IconClockHour4, IconMapPin } from '@tabler/icons-react';
import PrimaryButton from '../../../components/PrimaryButton.jsx';

export const formatMoney = (amount, currency = 'ZAR') => new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(Number(amount || 0));
export const formatStatus = (status = '') => status.replaceAll('_', ' ');
export const formatTime = (value) => value ? new Date(value).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : null;

export function StatusBadge({ status }) {
  return <span className={`vendor-ops-status vendor-ops-status--${status}`}>{formatStatus(status)}</span>;
}

export function SummaryCard({ label, value, detail, Icon, tone = '' }) {
  return <article className={`vendor-summary-card${tone ? ` vendor-summary-card--${tone}` : ''}`}>
    <span className="vendor-summary-card__icon"><Icon size={20} /></span>
    <div><p>{label}</p><strong>{value}</strong><span>{detail}</span></div>
  </article>;
}

export function VendorSection({ title, description, Icon, action, children, className = '' }) {
  return <section className={`vendor-ops-section ${className}`}>
    <div className="vendor-ops-section__heading">
      <div className="vendor-ops-section__title-wrap"><span className="vendor-ops-section__icon"><Icon size={19} /></span><div><h3>{title}</h3><p>{description}</p></div></div>
      {action}
    </div>
    {children}
  </section>;
}

export function OrderCard({ order, busy, urgent, onStatus }) {
  const actions = {
    payment_confirmed: [{ status: 'received_by_vendor', label: 'Receive order' }],
    received_by_vendor: [{ status: 'accepted', label: 'Accept order' }, { status: 'rejected', label: 'Reject' }],
    accepted: [{ status: 'preparing', label: 'Start preparing' }, { status: 'rejected', label: 'Reject' }],
    preparing: [{ status: 'ready_for_collection', label: 'Ready for collection' }],
    ready_for_collection: [{ status: 'collected', label: 'Confirm collection' }],
  }[order.status] || [];
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [collectionCode, setCollectionCode] = useState('');
  const slotTime = order.collection_slot?.starts_at ? new Date(order.collection_slot.starts_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : null;
  const paymentLabel = order.payment_status === 'succeeded' ? 'Paid' : formatStatus(order.payment_status || 'unknown');
  const actionsContent = actions.length > 0 && <div className="vendor-order-card__actions">{actions.map((action) => action.status === 'rejected' ? <div key={action.status} className="vendor-order-card__reject-action">
    {showRejectReason ? <form className="vendor-order-card__form" onSubmit={(event) => { event.preventDefault(); onStatus(order, action.status, rejectReason); }}>
      <input aria-label="Reason for rejecting order" placeholder="Reason for rejection (max 500 characters)" maxLength={500} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
      <button className="vendor-ops-button vendor-ops-button--quiet" type="submit" disabled={busy || !rejectReason.trim()}>{busy ? 'Saving...' : 'Confirm reject'}</button>
      <button className="vendor-order-card__cancel" type="button" onClick={() => { setShowRejectReason(false); setRejectReason(''); }}>Cancel</button>
    </form> : <button className="vendor-ops-button vendor-ops-button--quiet" type="button" disabled={busy} onClick={() => setShowRejectReason(true)}>{action.label}</button>}
  </div> : action.status === 'collected' ? <form key={action.status} className="vendor-order-card__form" onSubmit={(event) => { event.preventDefault(); onStatus(order, action.status, collectionCode); }}>
    <input aria-label="Customer collection code" placeholder="4-character code" maxLength={4} value={collectionCode} onChange={(event) => setCollectionCode(event.target.value.toUpperCase())} />
    <PrimaryButton type="submit" size="md" disabled={busy || !/^[A-Z0-9]{4}$/.test(collectionCode)}>{busy ? 'Saving...' : action.label}</PrimaryButton>
  </form> : action.status === 'received_by_vendor' || action.status === 'accepted' || action.status === 'preparing' || action.status === 'ready_for_collection' ? <PrimaryButton key={action.status} size="md" className="primary-btn primary-btn--md vendor-order-card__receive-button" disabled={busy} onClick={() => onStatus(order, action.status)}>{busy ? 'Saving...' : action.label}</PrimaryButton> : <button key={action.status} className="vendor-ops-button" type="button" disabled={busy} onClick={() => onStatus(order, action.status)}>{busy ? 'Saving...' : action.label}</button>)}</div>;
  const itemList = <ul className="vendor-order-card__items">{(order.items || []).map((item, index) => {
    const itemTotal = item.line_total ?? (item.unit_price_snapshot != null ? Number(item.unit_price_snapshot) * Number(item.quantity || 0) : null);
    return <li key={`${order.id}-${index}`}>
      <div className="vendor-order-card__item-row"><span><b>{item.quantity}×</b> {item.item_name_snapshot}</span>{itemTotal != null && <strong>{formatMoney(itemTotal, order.currency)}</strong>}</div>
      {Array.isArray(item.customization_snapshot) && item.customization_snapshot.length > 0 && <small>Options: {item.customization_snapshot.map((option) => `${option.quantity > 1 ? `${option.quantity}× ` : ''}${option.name || option.label || option.option_name || 'Option'}`).join(', ')}</small>}
      {Array.isArray(item.dietary_snapshot) && item.dietary_snapshot.length > 0 && <small>Dietary: {item.dietary_snapshot.join(', ')}</small>}
      {item.special_instructions && <small>Note: {item.special_instructions}</small>}
    </li>;
  })}</ul>;

  return <article className={`vendor-order-card${urgent ? ' vendor-order-card--urgent' : ''}`}>
    <details className="vendor-order-card__disclosure">
      <summary className="vendor-order-card__summary">
        <span className="vendor-order-card__summary-identity">
          <span className="vendor-order-card__reference">{order.order_reference || 'Order'}</span>
          <span className="vendor-order-card__customer">{order.customer_name ? `${order.customer_name} is buying this item` : 'Customer placed this order'}</span>
        </span>
        <span className="vendor-order-card__summary-time"><IconClockHour4 size={15} />{slotTime || 'No collection time'}</span>
        <StatusBadge status={order.status} />
        <strong className="vendor-order-card__summary-total">{formatMoney(order.total, order.currency)}</strong>
        <span className="vendor-order-card__expand-icon" aria-hidden="true" />
      </summary>
      <div className="vendor-order-card__expanded">
        <div className="vendor-order-card__detail-bar">
          {urgent && <p className="vendor-order-card__alert"><IconAlertTriangle size={16} aria-hidden="true" />Collection time is approaching</p>}
          <div className="vendor-order-card__expanded-meta">
            <span><IconMapPin size={15} />{order.collection_point_name || 'Pickup point to be confirmed'}</span>
            <span className="vendor-order-card__payment">Payment: {paymentLabel}</span>
          </div>
        </div>
        {itemList}
        {order.notes && <p className="vendor-order-card__note">Order note: {order.notes}</p>}
        {order.status === 'ready_for_collection' && <p className="vendor-order-card__hint">Verify the customer's collection code before completing handover.</p>}
        {actionsContent}
      </div>
    </details>
  </article>;
}

export function MenuItemCard({ item, busy, onSave }) {
  const [status, setStatus] = useState(item.status);
  useEffect(() => setStatus(item.status), [item.status]);
  return <article className="vendor-menu-item">
    <div className="vendor-menu-item__main"><div><h4>{item.name}</h4><p>{item.menu_categories?.name || 'Menu item'} · {formatMoney(item.base_price, item.currency)}</p></div><StatusBadge status={item.status} /></div>
    <div className="vendor-menu-item__controls"><label>Availability<select value={status} onChange={(event) => setStatus(event.target.value)}>{['available', 'limited', 'sold_out', 'unavailable'].map((value) => <option key={value} value={value}>{formatStatus(value)}</option>)}</select></label>
      <button type="button" className="vendor-ops-button vendor-ops-button--small" disabled={busy || status === item.status} onClick={() => onSave(item, status)}>{busy ? 'Saving…' : 'Save availability'}</button>
    </div>
  </article>;
}
