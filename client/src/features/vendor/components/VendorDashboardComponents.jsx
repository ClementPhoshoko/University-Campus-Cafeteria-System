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
  const [collectionCode, setCollectionCode] = useState('');
  const slotTime = order.collection_slot?.starts_at ? new Date(order.collection_slot.starts_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : null;
  const paymentLabel = order.payment_status === 'succeeded' ? 'Paid' : formatStatus(order.payment_status || 'unknown');
  const actionsContent = actions.length > 0 && <div className="vendor-order-card__actions">{actions.map((action) => action.status === 'rejected' || action.status === 'collected' ? <form key={action.status} className="vendor-order-card__form" onSubmit={(event) => { event.preventDefault(); onStatus(order, action.status, action.status === 'rejected' ? rejectReason : collectionCode); }}>
    <input aria-label={action.status === 'rejected' ? 'Reason for rejecting order' : 'Customer collection code'} placeholder={action.status === 'rejected' ? 'Reason required' : '4-character code'} maxLength={action.status === 'collected' ? 4 : undefined} value={action.status === 'rejected' ? rejectReason : collectionCode} onChange={(event) => action.status === 'rejected' ? setRejectReason(event.target.value) : setCollectionCode(event.target.value.toUpperCase())} />
    <button className={`vendor-ops-button${action.status === 'rejected' ? ' vendor-ops-button--quiet' : ''}`} type="submit" disabled={busy || !(action.status === 'rejected' ? rejectReason.trim() : /^[A-Z0-9]{4}$/.test(collectionCode))}>{busy ? 'Saving…' : action.label}</button>
  </form> : action.status === 'received_by_vendor' ? <PrimaryButton key={action.status} size="md" className="primary-btn primary-btn--md vendor-order-card__receive-button" disabled={busy} onClick={() => onStatus(order, action.status)}>{busy ? 'Receiving…' : action.label}</PrimaryButton> : <button key={action.status} className="vendor-ops-button" type="button" disabled={busy} onClick={() => onStatus(order, action.status)}>{busy ? 'Saving…' : action.label}</button>)}</div>;
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
    {urgent ? <>
      <header className="vendor-order-card__urgent-header">
        <div><p className="vendor-order-card__reference">{order.order_reference || 'Order'}</p><p className="vendor-order-card__customer">{order.customer_name ? `${order.customer_name} is buying this item` : 'Customer placed this order'}</p></div>
        <div className="vendor-order-card__urgent-status"><StatusBadge status={order.status} /></div>
      </header>
      <div className="vendor-order-card__urgent-details">
        <div className="vendor-order-card__pickup-time"><span>Collection time</span><strong><IconClockHour4 size={17} />{slotTime || 'Not scheduled'}</strong></div>
        <div className="vendor-order-card__pickup-point"><span>Pickup point</span><strong><IconMapPin size={16} />{order.collection_point_name || 'To be confirmed'}</strong></div>
        <div className="vendor-order-card__urgent-total"><span>Order total</span><strong>{formatMoney(order.total, order.currency)}</strong></div>
      </div>
      <p className="vendor-order-card__alert"><IconAlertTriangle size={16} aria-hidden="true" />Collection time is approaching</p>
      {itemList}
      {order.notes && <p className="vendor-order-card__note">Order note: {order.notes}</p>}
      {actionsContent}
    </> : <>
      <div className="vendor-order-card__top"><div><p className="vendor-order-card__reference">{order.order_reference || 'Order'}</p><p className="vendor-order-card__customer">{order.customer_name || 'Customer'}</p></div><StatusBadge status={order.status} /></div>
      <div className="vendor-order-card__meta">{slotTime && <span><IconClockHour4 size={15} /> Collection {slotTime}</span>}{order.collection_point_name && <span>{order.collection_point_name}</span>}<span className="vendor-order-card__payment">Payment: {paymentLabel}</span><strong>{formatMoney(order.total, order.currency)}</strong></div>
      {itemList}
      {order.notes && <p className="vendor-order-card__note">Order note: {order.notes}</p>}
      {actionsContent}
    </>}
    {order.status === 'ready_for_collection' && <p className="vendor-order-card__hint">Verify the customer’s collection code before completing handover.</p>}
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

export function VendorMenuItemForm({ item, categories, saving, onCancel, onSubmit }) {
  const [form, setForm] = useState({
    name: item?.name || '', description: item?.description || '', category_id: item?.category_id || '',
    base_price: item?.base_price ?? '', prep_minutes: item?.prep_minutes ?? '',
    portion_description: item?.portion_description || '',
    ingredients: Array.isArray(item?.ingredients) ? item.ingredients.join(', ') : '', status: item?.status || 'available',
  });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    onSubmit({
      name: form.name.trim(), description: form.description.trim() || null,
      category_id: form.category_id || null, base_price: Number(form.base_price),
      prep_minutes: form.prep_minutes === '' ? null : Number(form.prep_minutes),
      portion_description: form.portion_description.trim() || null,
      ingredients: form.ingredients.split(',').map((value) => value.trim()).filter(Boolean), status: form.status,
    });
  };
  return <div className="vendor-menu-editor__backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <form className="vendor-menu-editor" role="dialog" aria-modal="true" aria-labelledby="vendor-menu-editor-title" onSubmit={submit}>
      <header><div><p>Menu management</p><h3 id="vendor-menu-editor-title">{item ? 'Edit menu item' : 'Add menu item'}</h3></div><button type="button" onClick={onCancel} aria-label="Close editor">×</button></header>
      <div className="vendor-menu-editor__fields">
        <label>Item name<input required maxLength={120} value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
        <div className="vendor-menu-editor__row"><label>Price (ZAR)<input required type="number" min="0" step="0.01" value={form.base_price} onChange={(event) => update('base_price', event.target.value)} /></label><label>Prep time (minutes)<input type="number" min="1" max="1440" value={form.prep_minutes} onChange={(event) => update('prep_minutes', event.target.value)} /></label></div>
        <label>Category<select value={form.category_id} onChange={(event) => update('category_id', event.target.value)}><option value="">Uncategorized</option>{categories.filter((category) => category.is_active || category.id === item?.category_id).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Description<textarea rows="3" maxLength={2000} value={form.description} onChange={(event) => update('description', event.target.value)} /></label>
        <label>Ingredients <span>Separate items with commas</span><input value={form.ingredients} onChange={(event) => update('ingredients', event.target.value)} /></label>
        <div className="vendor-menu-editor__row"><label>Portion<input maxLength={120} value={form.portion_description} onChange={(event) => update('portion_description', event.target.value)} /></label><label>Availability<select value={form.status} onChange={(event) => update('status', event.target.value)}>{['available', 'limited', 'sold_out', 'unavailable'].map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}</select></label></div>
      </div>
      <footer><button type="button" className="vendor-ops-button vendor-ops-button--quiet" onClick={onCancel}>Cancel</button><button type="submit" className="vendor-ops-button" disabled={saving || !form.name.trim() || form.base_price === ''}>{saving ? 'Saving…' : item ? 'Save changes' : 'Add item'}</button></footer>
    </form>
  </div>;
}
