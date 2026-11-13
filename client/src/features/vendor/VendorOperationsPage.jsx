import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { IconRefresh, IconShoppingBag, IconSoup, IconClockHour4, IconAlertTriangle, IconCalendar, IconUsers } from '@tabler/icons-react';
import PageContainer from '../../components/layout/PageContainer.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { listMyVendors, listVendorQueue, listVendorOperationsMenu, updateVendorOrderStatus, updateVendorAvailability } from '../../services/vendorApi.js';
import { MenuItemCard, OrderCard, SummaryCard, VendorSection, formatTime } from './components/VendorDashboardComponents.jsx';
import { MenuItemModal } from '../admin/VendorForms.jsx';
import { archiveVendorMenuItem, createVendorMenuItem, listVendorMenuCategories, updateVendorMenuItem, uploadVendorMenuItemAsset } from '../../services/vendorApi.js';
import VendorMenuPlanningPage from './VendorMenuPlanningPage.jsx';
import VendorTeamManagementPage from './VendorTeamManagementPage.jsx';
import { VendorDashboardSkeleton, VendorMenuItemsSkeleton, VendorQueueSkeleton, VendorSummarySkeleton } from './VendorLoadingSkeletons.jsx';
import './vendor-operations.css';

const QUEUE_FILTERS = [
  { value: 'active', label: 'Active' }, { value: 'needs_attention', label: 'Needs attention' },
  { value: 'ready_for_collection', label: 'Ready for collection' },
];
const VENDOR_LIST_PAGE_SIZE = 5;
function collectionTime(order) {
  return order.collection_slot?.starts_at ? new Date(order.collection_slot.starts_at).getTime() : Number.MAX_SAFE_INTEGER;
}

function isUrgent(order, now) {
  if (!order.collection_slot?.starts_at || ['ready_for_collection'].includes(order.status)) return false;
  const minutes = (new Date(order.collection_slot.starts_at).getTime() - now) / 60000;
  return minutes <= 15;
}

export default function VendorOperationsPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const token = session?.access_token;
  const showingMenuPlanning = searchParams.get('view') === 'menus';
  const showingTeamManagement = searchParams.get('view') === 'team';
  const showingManagerView = showingMenuPlanning || showingTeamManagement;
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState('');
  const [vendorsState, setVendorsState] = useState('loading');
  const [vendorError, setVendorError] = useState('');
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [menu, setMenu] = useState(null);
  const [menuCategories, setMenuCategories] = useState([]);
  const [ordersState, setOrdersState] = useState('loading');
  const [menuState, setMenuState] = useState('loading');
  const [ordersError, setOrdersError] = useState('');
  const [menuError, setMenuError] = useState('');
  const [busyOrder, setBusyOrder] = useState('');
  const [busyItem, setBusyItem] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [savingEditor, setSavingEditor] = useState(false);
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('active');
  const [queuePage, setQueuePage] = useState(1);
  const [menuPage, setMenuPage] = useState(1);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    listMyVendors({ token, signal: controller.signal }).then((response) => {
      const rows = response.vendors || [];
      setVendors(rows);
      setVendorId((current) => rows.some((row) => row.id === current) ? current : (rows[0]?.id || ''));
      setVendorsState('ready'); setVendorError('');
    }).catch((error) => { if (error.name !== 'AbortError') { setVendorsState('error'); setVendorError(error.message || 'Could not load your vendor access.'); } });
    return () => controller.abort();
  }, [token]);

  const loadOrders = useCallback(async (signal) => {
    if (!vendorId) return;
    try { const response = await listVendorQueue(vendorId, { token, signal }); setOrders(response.orders || []); setOrdersState('ready'); setOrdersError(''); }
    catch (error) { if (error.name !== 'AbortError') { setOrdersError(error.message || 'Could not refresh the order queue.'); setOrdersState((current) => current === 'loading' ? 'error' : 'ready'); } }
  }, [token, vendorId]);

  const loadMenu = useCallback(async (signal) => {
    if (!vendorId) return;
    try {
      const [response, categoryResponse] = await Promise.all([
        listVendorOperationsMenu(vendorId, { token, signal }), listVendorMenuCategories(vendorId, { token, signal }),
      ]);
      setMenuItems(response.items || []); setMenu(response.menu || null); setMenuCategories(categoryResponse.categories || []); setMenuState('ready'); setMenuError('');
    }
    catch (error) { if (error.name !== 'AbortError') { setMenuError(error.message || 'Could not load today’s menu.'); setMenuState((current) => current === 'loading' ? 'error' : 'ready'); } }
  }, [token, vendorId]);

  useEffect(() => {
    if (!vendorId) return undefined;
    const controller = new AbortController(); setOrdersState('loading'); setMenuState('loading');
    loadOrders(controller.signal); loadMenu(controller.signal);
    const refresh = window.setInterval(() => { if (document.visibilityState === 'visible') loadOrders(); }, 20_000);
    return () => { controller.abort(); window.clearInterval(refresh); };
  }, [vendorId, loadOrders, loadMenu]);

  const selectedVendor = useMemo(() => vendors.find((vendor) => vendor.id === vendorId), [vendors, vendorId]);
  const visibleOrders = useMemo(() => orders.slice().sort((a, b) => collectionTime(a) - collectionTime(b)).filter((order) => {
    if (filter === 'ready_for_collection') return order.status === filter;
    if (filter === 'needs_attention') return isUrgent(order, now) || order.status === 'payment_confirmed';
    return true;
  }), [orders, filter, now]);
  const queueTotalPages = Math.max(1, Math.ceil(visibleOrders.length / VENDOR_LIST_PAGE_SIZE));
  const safeQueuePage = Math.min(queuePage, queueTotalPages);
  const pagedOrders = visibleOrders.slice((safeQueuePage - 1) * VENDOR_LIST_PAGE_SIZE, safeQueuePage * VENDOR_LIST_PAGE_SIZE);
  const menuTotalPages = Math.max(1, Math.ceil(menuItems.length / VENDOR_LIST_PAGE_SIZE));
  const safeMenuPage = Math.min(menuPage, menuTotalPages);
  const pagedMenuItems = menuItems.slice((safeMenuPage - 1) * VENDOR_LIST_PAGE_SIZE, safeMenuPage * VENDOR_LIST_PAGE_SIZE);
  const urgentCount = orders.filter((order) => isUrgent(order, now)).length;
  const readyCount = orders.filter((order) => order.status === 'ready_for_collection').length;
  const nextCollection = orders.filter((order) => order.collection_slot?.starts_at).sort((a, b) => collectionTime(a) - collectionTime(b))[0];

  useEffect(() => { setQueuePage(1); }, [filter, vendorId]);
  useEffect(() => { setMenuPage(1); }, [vendorId]);
  useEffect(() => { if (queuePage > queueTotalPages) setQueuePage(queueTotalPages); }, [queuePage, queueTotalPages]);
  useEffect(() => { if (menuPage > menuTotalPages) setMenuPage(menuTotalPages); }, [menuPage, menuTotalPages]);

  async function handleOrderStatus(order, status, detail) {
    setBusyOrder(order.id); setNotice('');
    try { await updateVendorOrderStatus(order.id, status, { token, reason: status === 'rejected' ? detail : undefined, collectionCode: status === 'collected' ? detail : undefined }); await loadOrders(); setNotice(`Order ${order.order_reference || ''} updated.`); }
    catch (error) { setNotice(error.message || 'Could not update that order. Refresh the queue and try again.'); }
    finally { setBusyOrder(''); }
  }

  async function handleAvailability(item, status) {
    setBusyItem(item.id); setNotice('');
    try { await updateVendorAvailability(item.id, { status, menu_id: item.menu_id }, { token }); await loadMenu(); setNotice(`${item.name} availability updated.`); }
    catch (error) { setNotice(error.message || 'Could not update menu availability.'); }
    finally { setBusyItem(''); }
  }

  async function handleMenuItemSave(payload) {
    setSavingEditor(true); setNotice(''); setMenuError('');
    const { image_file: imageFile, ...itemPayload } = payload;
    const editing = editingItem && !editingItem.isNew;
    let saved = false;
    try {
      let itemId = editing ? editingItem.id : null;
      if (editing) {
        await updateVendorMenuItem(itemId, itemPayload, { token });
      } else {
        const response = await createVendorMenuItem(vendorId, { ...itemPayload, menu_id: menu.id }, { token });
        itemId = response?.menuItem?.id;
      }
      saved = true;
      if (imageFile) {
        if (!itemId) throw new Error('The saved item could not be identified for image upload.');
        await uploadVendorMenuItemAsset(itemId, imageFile, { token });
      }
      await loadMenu();
      setEditingItem(null);
      setNotice(editing ? 'Menu item updated.' : 'Menu item added to today’s published menu.');
    } catch (error) {
      if (saved) {
        await loadMenu();
        setEditingItem(null);
        setMenuError(`Menu item saved, but its image could not be uploaded: ${error.message}`);
      } else {
        setMenuError(error.message || 'Could not save the menu item.');
      }
    }
    finally { setSavingEditor(false); }
  }

  async function handleArchiveMenuItem(item) {
    if (!window.confirm(`Archive “${item.name}”? It will no longer appear on customer menus.`)) return;
    setBusyItem(item.id); setNotice('');
    try { await archiveVendorMenuItem(item.id, { token }); await loadMenu(); setNotice(`${item.name} archived.`); }
    catch (error) { setNotice(error.message || 'Could not archive that item.'); }
    finally { setBusyItem(''); }
  }

  if (showingManagerView && selectedVendor?.role !== 'manager' && vendorsState === 'ready') {
    return <Navigate to="/vendor" replace />;
  }

  if (vendorsState === 'loading') {
    if (showingMenuPlanning) {
      return <PageContainer className="vendor-ops-page-container"><div className="vendor-ops-page">
        <VendorMenuPlanningPage vendorId="" vendorName="" onBack={() => setSearchParams({})} />
      </div></PageContainer>;
    }
    return <PageContainer className="vendor-ops-page-container"><div className="vendor-ops-page">
      <VendorDashboardSkeleton />
    </div></PageContainer>;
  }

  const headerActions = (vendors.length > 1 || (selectedVendor?.role === 'manager' && !showingManagerView)) && (
    <div className="vendor-ops-header-actions">
      {vendors.length > 1 && <label className="vendor-ops-picker">Vendor<select value={vendorId} onChange={(event) => setVendorId(event.target.value)}>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>}
      {selectedVendor?.role === 'manager' && !showingManagerView && <>
        <PrimaryButton size="sm" icon={IconCalendar} onClick={() => setSearchParams({ view: 'menus' })}>Plan menus</PrimaryButton>
        <PrimaryButton size="sm" icon={IconUsers} onClick={() => setSearchParams({ view: 'team' })}>Manage staff</PrimaryButton>
      </>}
    </div>
  );

  return <PageContainer className="vendor-ops-page-container"><div className="vendor-ops-page">
    <PageHeader eyebrow="Vendor workspace" title={selectedVendor?.name || 'Vendor operations'} subtitle="A clear view of what needs preparing and what customers can order today." actions={headerActions} />
    {vendorsState === 'error' && <div className="vendor-ops-alert" role="alert">{vendorError}</div>}
    {vendorsState === 'ready' && !vendors.length && <div className="vendor-ops-empty"><IconShoppingBag size={30} /><h3>No vendor access yet</h3><p>Your account is not assigned to a vendor. Ask an administrator to add you to the vendor team.</p></div>}
    {selectedVendor && <>
      {notice && <p className="vendor-ops-notice" role="status">{notice}</p>}
      {!showingManagerView && ordersState === 'loading' && <VendorSummarySkeleton />}
      {!showingManagerView && ordersState !== 'loading' && <div className="vendor-ops-summary">
        <SummaryCard label="Active orders" value={orders.length} detail="In your live queue" Icon={IconShoppingBag} />
        <SummaryCard label="Needs attention" value={urgentCount} detail="Collection within 15 minutes" Icon={IconAlertTriangle} tone={urgentCount ? 'warning' : ''} />
        <SummaryCard label="Ready to collect" value={readyCount} detail="Waiting for customer pickup" Icon={IconSoup} tone="blue" />
        <SummaryCard label="Next collection" value={nextCollection ? formatTime(nextCollection.collection_slot?.starts_at) : '—'} detail={nextCollection?.order_reference || 'No scheduled orders'} Icon={IconClockHour4} />
      </div>}
      {showingMenuPlanning
        ? <VendorMenuPlanningPage
          vendorId={vendorId}
          vendorName={selectedVendor.name}
          onBack={() => setSearchParams({})}
        />
        : showingTeamManagement
          ? <VendorTeamManagementPage
            vendorId={vendorId}
            vendorName={selectedVendor.name}
            token={token}
            onBack={() => setSearchParams({})}
          />
        : <>
        <div className="vendor-ops-grid">
        <VendorSection title="Live order queue" description="Sorted by collection time · refreshes automatically" Icon={IconShoppingBag} className="vendor-ops-section--queue" action={<button className="vendor-ops-refresh" type="button" onClick={() => loadOrders()} aria-label="Refresh orders"><IconRefresh size={18} /></button>}>
          <div className="vendor-queue-filters" role="group" aria-label="Filter orders">{QUEUE_FILTERS.map((item) => <button key={item.value} type="button" className={filter === item.value ? 'is-active' : ''} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}{item.value === 'needs_attention' && urgentCount > 0 ? <span>{urgentCount}</span> : null}</button>)}</div>
          <div className="vendor-queue-list">
            {ordersState === 'loading' && <VendorQueueSkeleton />}
            {ordersError && ordersState !== 'error' && <div className="vendor-ops-inline-error" role="status">Queue refresh failed: {ordersError} Showing the last loaded orders.</div>}
            {ordersState === 'error' && <div className="vendor-ops-inline-error" role="alert">{ordersError}</div>}
            {ordersState === 'ready' && !visibleOrders.length && <div className="vendor-ops-section-empty">{orders.length ? 'No orders match this filter.' : 'No active orders. New paid orders will appear here.'}</div>}
            {ordersState === 'ready' && pagedOrders.map((order) => <OrderCard key={order.id} order={order} busy={busyOrder === order.id} urgent={isUrgent(order, now)} onStatus={handleOrderStatus} />)}
            <div className="vendor-list-pagination-slot"><Pagination currentPage={safeQueuePage} totalPages={queueTotalPages} totalItems={visibleOrders.length} itemsPerPage={VENDOR_LIST_PAGE_SIZE} label="orders" onPageChange={setQueuePage} /></div>
          </div>
        </VendorSection>
        <VendorSection title="Today’s menu" description="Manage the items customers can order today" Icon={IconSoup} className="vendor-ops-section--menu" action={selectedVendor.role === 'manager' && menu ? <PrimaryButton onClick={() => setEditingItem({ isNew: true })}>Add item</PrimaryButton> : null}>
          <div className="vendor-menu-list">
            {menuState === 'loading' && <VendorMenuItemsSkeleton />}
            {menuError && menuState !== 'error' && <div className="vendor-ops-inline-error" role="status">Menu refresh failed: {menuError}</div>}
            {menuState === 'error' && <div className="vendor-ops-inline-error" role="alert">{menuError}</div>}
            {menuState === 'ready' && !menu && <div className="vendor-ops-section-empty">There is no published menu for today. Ask an administrator to publish the menu before adding items.</div>}
            {menuState === 'ready' && menu && !menuItems.length && <div className="vendor-ops-section-empty">No items are on a published menu today.</div>}
            {menuState === 'ready' && pagedMenuItems.map((item) => <div className="vendor-menu-item-wrap" key={item.id}><MenuItemCard item={item} busy={busyItem === item.id} onSave={handleAvailability} />{selectedVendor.role === 'manager' && <div className="vendor-menu-item-wrap__actions"><PrimaryButton size="sm" onClick={() => setEditingItem(item)}>Edit details</PrimaryButton><PrimaryButton size="sm" className="primary-btn primary-btn--sm vendor-menu-danger-button" onClick={() => handleArchiveMenuItem(item)} disabled={busyItem === item.id}>Archive</PrimaryButton></div>}</div>)}
            <div className="vendor-list-pagination-slot"><Pagination currentPage={safeMenuPage} totalPages={menuTotalPages} totalItems={menuItems.length} itemsPerPage={VENDOR_LIST_PAGE_SIZE} label="menu items" onPageChange={setMenuPage} /></div>
        </div>
        </VendorSection>
      </div>
      <p className="vendor-ops-footnote">Availability indicates whether an item can be ordered. Quantity-based stock is not enabled yet.</p>
      {editingItem && <MenuItemModal item={editingItem.isNew ? null : editingItem} categories={menuCategories} submitting={savingEditor} usePrimaryButtons onClose={() => setEditingItem(null)} onSubmit={handleMenuItemSave} />}
      </>}
    </>}
  </div></PageContainer>;
}
