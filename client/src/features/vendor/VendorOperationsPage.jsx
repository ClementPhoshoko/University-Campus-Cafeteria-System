import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconRefresh, IconShoppingBag, IconSoup } from '@tabler/icons-react';
import PageContainer from '../../components/layout/PageContainer.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import {
  listMyVendors,
  listVendorQueue,
  listVendorOperationsMenu,
  updateVendorOrderStatus,
  updateVendorAvailability,
} from '../../services/vendorApi.js';
import './vendor-operations.css';

const ORDER_ACTIONS = {
  payment_confirmed: [{ status: 'received_by_vendor', label: 'Receive order' }],
  received_by_vendor: [{ status: 'accepted', label: 'Accept order' }, { status: 'rejected', label: 'Reject' }],
  accepted: [{ status: 'preparing', label: 'Start preparing' }, { status: 'rejected', label: 'Reject' }],
  preparing: [{ status: 'ready_for_collection', label: 'Ready for collection' }],
  ready_for_collection: [{ status: 'collected', label: 'Confirm collection' }],
};
const AVAILABILITY = [
  { value: 'available', label: 'Available' },
  { value: 'limited', label: 'Limited' },
  { value: 'sold_out', label: 'Sold out' },
  { value: 'unavailable', label: 'Unavailable' },
];

function formatMoney(amount, currency = 'ZAR') {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(Number(amount || 0));
}

function formatStatus(status = '') {
  return status.replaceAll('_', ' ');
}

function OrderCard({ order, busy, onStatus }) {
  const actions = ORDER_ACTIONS[order.status] || [];
  const [rejectReason, setRejectReason] = useState('');
  const [collectionCode, setCollectionCode] = useState('');
  const slotTime = order.collection_slot?.starts_at
    ? new Date(order.collection_slot.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <article className="vendor-ops-order">
      <div className="vendor-ops-order__top">
        <div>
          <p className="vendor-ops-order__reference">{order.order_reference || 'Order'}</p>
          <p className="vendor-ops-order__customer">{order.customer_name}</p>
        </div>
        <span className={`vendor-ops-status vendor-ops-status--${order.status}`}>{formatStatus(order.status)}</span>
      </div>
      <div className="vendor-ops-order__meta">
        {slotTime && <span>Collection {slotTime}</span>}
        {order.collection_point_name && <span>{order.collection_point_name}</span>}
        <strong>{formatMoney(order.total, order.currency)}</strong>
      </div>
      <ul className="vendor-ops-order__items">
        {(order.items || []).map((item, index) => (
          <li key={`${order.id}-${index}`}>
            <span><b>{item.quantity}×</b> {item.item_name_snapshot}</span>
            {item.special_instructions && <small>{item.special_instructions}</small>}
          </li>
        ))}
      </ul>
      {order.notes && <p className="vendor-ops-order__note">Order note: {order.notes}</p>}
      {actions.length > 0 && (
        <div className="vendor-ops-order__actions">
          {actions.map((action) => action.status === 'rejected' || action.status === 'collected' ? (
            <form key={action.status} className="vendor-ops-reject" onSubmit={(event) => { event.preventDefault(); onStatus(order, action.status, action.status === 'rejected' ? rejectReason : collectionCode); }}>
              <input
                aria-label={action.status === 'rejected' ? 'Reason for rejecting order' : 'Customer collection code'}
                placeholder={action.status === 'rejected' ? 'Reason required' : '4-character code'}
                maxLength={action.status === 'collected' ? 4 : undefined}
                value={action.status === 'rejected' ? rejectReason : collectionCode}
                onChange={(event) => action.status === 'rejected' ? setRejectReason(event.target.value) : setCollectionCode(event.target.value.toUpperCase())}
              />
              <button className={`vendor-ops-button ${action.status === 'rejected' ? 'vendor-ops-button--quiet' : ''}`} type="submit" disabled={busy || !(action.status === 'rejected' ? rejectReason.trim() : /^[A-Z0-9]{4}$/.test(collectionCode))}>{busy ? 'Saving…' : action.label}</button>
            </form>
          ) : (
            <button key={action.status} className="vendor-ops-button" type="button" disabled={busy} onClick={() => onStatus(order, action.status)}>{busy ? 'Saving…' : action.label}</button>
          ))}
        </div>
      )}
      {order.status === 'ready_for_collection' && <p className="vendor-ops-order__waiting">Verify the customer’s collection code to complete handover.</p>}
    </article>
  );
}

export default function VendorOperationsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState('');
  const [vendorsState, setVendorsState] = useState('loading');
  const [vendorError, setVendorError] = useState('');
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [ordersState, setOrdersState] = useState('loading');
  const [menuState, setMenuState] = useState('loading');
  const [ordersError, setOrdersError] = useState('');
  const [menuError, setMenuError] = useState('');
  const [busyOrder, setBusyOrder] = useState('');
  const [busyItem, setBusyItem] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    listMyVendors({ token, signal: controller.signal }).then((response) => {
      const rows = response.vendors || [];
      setVendors(rows);
      setVendorId((current) => rows.some((row) => row.id === current) ? current : (rows[0]?.id || ''));
      setVendorsState('ready');
      setVendorError('');
    }).catch((error) => {
      if (error.name === 'AbortError') return;
      setVendorsState('error');
      setVendorError(error.message || 'Could not load your vendor access.');
    });
    return () => controller.abort();
  }, [token]);

  const loadOrders = useCallback(async (signal) => {
    if (!vendorId) return;
    try {
      const response = await listVendorQueue(vendorId, { token, signal });
      setOrders(response.orders || []);
      setOrdersState('ready');
      setOrdersError('');
    } catch (error) {
      if (error.name === 'AbortError') return;
      setOrdersError(error.message || 'Could not refresh the order queue.');
      setOrdersState((current) => current === 'loading' ? 'error' : 'ready');
    }
  }, [token, vendorId]);

  const loadMenu = useCallback(async (signal) => {
    if (!vendorId) return;
    try {
      const response = await listVendorOperationsMenu(vendorId, { token, signal });
      setMenuItems(response.items || []);
      setMenuState('ready');
      setMenuError('');
    } catch (error) {
      if (error.name === 'AbortError') return;
      setMenuError(error.message || 'Could not load today’s menu.');
      setMenuState((current) => current === 'loading' ? 'error' : 'ready');
    }
  }, [token, vendorId]);

  useEffect(() => {
    if (!vendorId) return undefined;
    const controller = new AbortController();
    setOrdersState('loading');
    setMenuState('loading');
    loadOrders(controller.signal);
    loadMenu(controller.signal);
    const refresh = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadOrders();
    }, 20000);
    return () => { controller.abort(); window.clearInterval(refresh); };
  }, [vendorId, loadOrders, loadMenu]);

  const selectedVendor = useMemo(() => vendors.find((vendor) => vendor.id === vendorId), [vendors, vendorId]);

  async function handleOrderStatus(order, status, detail) {
    setBusyOrder(order.id);
    setNotice('');
    try {
      await updateVendorOrderStatus(order.id, status, { token, reason: status === 'rejected' ? detail : undefined, collectionCode: status === 'collected' ? detail : undefined });
      await loadOrders();
      setNotice(`Order ${order.order_reference || ''} updated.`);
    } catch (error) {
      setNotice(error.message || 'Could not update that order. Refresh the queue and try again.');
    } finally { setBusyOrder(''); }
  }

  async function handleAvailability(item, status) {
    setBusyItem(item.id);
    setNotice('');
    try {
      await updateVendorAvailability(item.id, { status, menu_id: item.menu_id }, { token });
      await loadMenu();
      setNotice(`${item.name} availability updated.`);
    } catch (error) {
      setNotice(error.message || 'Could not update menu availability.');
    } finally { setBusyItem(''); }
  }

  return (
    <PageContainer className="vendor-ops-page-container">
      <div className="vendor-ops-page">
        <PageHeader
          eyebrow="Vendor operations"
          title={selectedVendor?.name || 'Vendor operations'}
          subtitle="Manage incoming orders and today’s menu availability. The queue refreshes automatically."
          actions={vendors.length > 1 ? <label className="vendor-ops-picker">Vendor<select value={vendorId} onChange={(event) => setVendorId(event.target.value)}>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label> : null}
        />

        {vendorsState === 'loading' && <div className="vendor-ops-loading"><Skeleton height={72} /><Skeleton height={72} /></div>}
        {vendorsState === 'error' && <div className="vendor-ops-alert" role="alert">{vendorError}</div>}
        {vendorsState === 'ready' && !vendors.length && <div className="vendor-ops-empty"><IconShoppingBag size={30} /><h3>No vendor access yet</h3><p>Your account is not assigned to a vendor. Ask an administrator to add you to the vendor team.</p></div>}
        {selectedVendor && <>
          {notice && <p className="vendor-ops-notice" role="status">{notice}</p>}
          <div className="vendor-ops-grid">
            <section className="vendor-ops-section" aria-labelledby="vendor-queue-title">
              <div className="vendor-ops-section__heading">
                <div><span className="vendor-ops-section__icon"><IconShoppingBag size={19} /></span><div><h3 id="vendor-queue-title">Live order queue</h3><p>{orders.length} active {orders.length === 1 ? 'order' : 'orders'}</p></div></div>
                <button className="vendor-ops-refresh" type="button" onClick={() => loadOrders()} aria-label="Refresh orders"><IconRefresh size={18} /></button>
              </div>
              {ordersState === 'loading' && <div className="vendor-ops-loading"><Skeleton height={190} /><Skeleton height={190} /></div>}
              {ordersError && ordersState !== 'error' && <div className="vendor-ops-inline-error" role="status">Queue refresh failed: {ordersError} Showing the last loaded orders.</div>}
              {ordersState === 'error' && <div className="vendor-ops-inline-error" role="alert">{ordersError}</div>}
              {ordersState === 'ready' && !orders.length && <div className="vendor-ops-section-empty">No active orders. New paid orders will appear here.</div>}
              {orders.map((order) => <OrderCard key={order.id} order={order} busy={busyOrder === order.id} onStatus={handleOrderStatus} />)}
            </section>

            <section className="vendor-ops-section" aria-labelledby="vendor-menu-title">
              <div className="vendor-ops-section__heading">
                <div><span className="vendor-ops-section__icon"><IconSoup size={19} /></span><div><h3 id="vendor-menu-title">Today’s menu</h3><p>Availability changes update the employee menu</p></div></div>
              </div>
              {menuState === 'loading' && <div className="vendor-ops-loading"><Skeleton height={92} /><Skeleton height={92} /></div>}
              {menuError && menuState !== 'error' && <div className="vendor-ops-inline-error" role="status">Menu refresh failed: {menuError}</div>}
              {menuState === 'error' && <div className="vendor-ops-inline-error" role="alert">{menuError}</div>}
              {menuState === 'ready' && !menuItems.length && <div className="vendor-ops-section-empty">No items are on a published menu today.</div>}
              {menuItems.map((item) => <MenuAvailability key={item.id} item={item} busy={busyItem === item.id} onSave={handleAvailability} />)}
            </section>
          </div>
        </>}
      </div>
    </PageContainer>
  );
}

function MenuAvailability({ item, busy, onSave }) {
  const [status, setStatus] = useState(item.status);
  useEffect(() => { setStatus(item.status); }, [item.status]);
  const changed = status !== item.status;
  return (
    <article className="vendor-ops-menu-item">
      <div className="vendor-ops-menu-item__main">
        <div><h4>{item.name}</h4><p>{item.menu_categories?.name || 'Menu item'} · {formatMoney(item.base_price, item.currency)}</p></div>
        <span className={`vendor-ops-status vendor-ops-status--${item.status}`}>{formatStatus(item.status)}</span>
      </div>
      <div className="vendor-ops-menu-item__controls">
        <label>Availability<select value={status} onChange={(event) => setStatus(event.target.value)}>{AVAILABILITY.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <button type="button" className="vendor-ops-button vendor-ops-button--small" disabled={busy || !changed} onClick={() => onSave(item, status)}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </article>
  );
}
