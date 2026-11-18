import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { IconRefresh, IconShoppingBag, IconSoup, IconClockHour4, IconAlertTriangle } from '@tabler/icons-react';
import PageContainer from '../../components/layout/PageContainer.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import { useConfirm } from '../../components/confirmation/ConfirmProvider.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { listMyVendors, listVendorQueue, listVendorOperationsMenu, updateVendorOrderStatus, updateVendorAvailability, createVendorCatalogItem } from '../../services/vendorApi.js';
import { MenuItemCard, OrderCard, SummaryCard, VendorSection, formatTime } from './components/VendorDashboardComponents.jsx';
import { MenuItemModal } from '../admin/VendorForms.jsx';
import { archiveVendorMenuItem, listVendorMenuCategories, updateVendorMenuItem, uploadVendorMenuItemAsset } from '../../services/vendorApi.js';
import VendorMenuManagementPage from './VendorMenuManagementPage.jsx';
import VendorTeamManagementPage from './VendorTeamManagementPage.jsx';
import VendorWorkspaceLayout from './VendorWorkspaceLayout.jsx';
import { VendorDashboardSkeleton, VendorMenuItemsSkeleton, VendorQueueSkeleton, VendorSummarySkeleton } from './VendorLoadingSkeletons.jsx';
import './vendor-operations.css';

const QUEUE_FILTERS = [
  { value: 'active', label: 'Active' }, { value: 'needs_attention', label: 'Needs attention' },
  { value: 'ready_for_collection', label: 'Ready for collection' },
];
const VENDOR_LIST_PAGE_SIZE = 5;
const emptyServerPagination = { page: 1, limit: VENDOR_LIST_PAGE_SIZE, total: 0, totalPages: 0 };
function isUrgent(order, now) {
  if (!order.collection_slot?.starts_at || ['ready_for_collection'].includes(order.status)) return false;
  const minutes = (new Date(order.collection_slot.starts_at).getTime() - now) / 60000;
  return minutes <= 15;
}

export default function VendorOperationsPage() {
  const confirm = useConfirm();
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const token = session?.access_token;
  const showingMenuManagement = searchParams.get('view') === 'menus';
  const showingTeamManagement = searchParams.get('view') === 'team';
  const showingManagerView = showingMenuManagement || showingTeamManagement;
  const activeView = showingMenuManagement ? 'menus' : showingTeamManagement ? 'team' : 'overview';
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState('');
  const [vendorsState, setVendorsState] = useState('loading');
  const [vendorError, setVendorError] = useState('');
  const [orders, setOrders] = useState([]);
  const [queuePagination, setQueuePagination] = useState(emptyServerPagination);
  const [queueCounts, setQueueCounts] = useState({ active: 0, urgent: 0, needs_attention: 0, ready_for_collection: 0 });
  const [nextCollection, setNextCollection] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [menuPagination, setMenuPagination] = useState(emptyServerPagination);
  const [menuCategories, setMenuCategories] = useState([]);
  const [ordersState, setOrdersState] = useState('loading');
  const [menuState, setMenuState] = useState('loading');
  const [ordersError, setOrdersError] = useState('');
  const [menuError, setMenuError] = useState('');
  const [busyOrder, setBusyOrder] = useState('');
  const [busyItem, setBusyItem] = useState('');
  const busyItemRef = useRef('');
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
    try {
      const response = await listVendorQueue(vendorId, { token, page: queuePage, limit: VENDOR_LIST_PAGE_SIZE, filter, signal });
      setOrders(response.orders || []);
      setQueuePagination(response.pagination || emptyServerPagination);
      setQueueCounts(response.counts || { active: 0, urgent: 0, needs_attention: 0, ready_for_collection: 0 });
      setNextCollection(response.next_collection || null);
      if (response.pagination?.page && response.pagination.page !== queuePage) setQueuePage(response.pagination.page);
      setOrdersState('ready'); setOrdersError('');
    }
    catch (error) { if (error.name !== 'AbortError') { setOrdersError(error.message || 'Could not refresh the order queue.'); setOrdersState((current) => current === 'loading' ? 'error' : 'ready'); } }
  }, [token, vendorId, queuePage, filter]);

  const loadMenu = useCallback(async (signal) => {
    if (!vendorId) return;
    try {
      const response = await listVendorOperationsMenu(vendorId, { token, page: menuPage, limit: VENDOR_LIST_PAGE_SIZE, signal });
      setMenuItems(response.items || []); setMenuPagination(response.pagination || emptyServerPagination); setMenuState('ready'); setMenuError('');
      if (response.pagination?.page && response.pagination.page !== menuPage) setMenuPage(response.pagination.page);
    }
    catch (error) { if (error.name !== 'AbortError') { setMenuError(error.message || 'Could not load menu items.'); setMenuState((current) => current === 'loading' ? 'error' : 'ready'); } }
  }, [token, vendorId, menuPage]);

  useEffect(() => {
    if (!vendorId || showingManagerView) return undefined;
    const controller = new AbortController(); setOrdersState('loading'); setMenuState('loading');
    loadOrders(controller.signal); loadMenu(controller.signal);
    const refresh = window.setInterval(() => { if (document.visibilityState === 'visible') loadOrders(); }, 20_000);
    return () => { controller.abort(); window.clearInterval(refresh); };
  }, [vendorId, loadOrders, loadMenu, showingManagerView]);

  const selectedVendor = useMemo(() => vendors.find((vendor) => vendor.id === vendorId), [vendors, vendorId]);
  const visibleOrders = orders;
  const pagedOrders = orders;
  const safeQueuePage = queuePagination.page || queuePage;
  const queueTotalPages = queuePagination.totalPages || 1;
  const pagedMenuItems = menuItems;
  const safeMenuPage = menuPagination.page || menuPage;
  const menuTotalPages = menuPagination.totalPages || 1;
  const urgentCount = queueCounts.urgent;
  const readyCount = queueCounts.ready_for_collection;

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
    if (busyItemRef.current) return false;
    busyItemRef.current = item.id;
    setBusyItem(item.id); setNotice('');
    try {
      await updateVendorAvailability(item.id, { status }, { token });
      setMenuItems((current) => current.map((row) => row.id === item.id ? { ...row, status } : row));
      await loadMenu();
      setNotice(`${item.name} availability updated.`);
      return true;
    }
    catch (error) { setNotice(error.message || 'Could not update menu availability.'); return false; }
    finally { busyItemRef.current = ''; setBusyItem(''); }
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
        const response = await createVendorCatalogItem(vendorId, itemPayload, { token });
        itemId = response?.menuItem?.id;
      }
      saved = true;
      if (imageFile) {
        if (!itemId) throw new Error('The saved item could not be identified for image upload.');
        await uploadVendorMenuItemAsset(itemId, imageFile, { token });
      }
      await loadMenu();
      setEditingItem(null);
      setNotice(editing ? 'Menu item updated.' : 'Menu item added to the catalogue.');
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

  async function openMenuItemEditor(item) {
    setMenuError('');
    try {
      const first = await listVendorMenuCategories(vendorId, { token, page: 1, limit: 50 });
      const categories = first.categories || [];
      for (let page = 2; page <= (first.pagination?.totalPages || 1); page += 1) {
        const response = await listVendorMenuCategories(vendorId, { token, page, limit: 50 });
        categories.push(...(response.categories || []));
      }
      setMenuCategories(categories);
      setEditingItem(item);
    } catch (error) {
      setMenuError(error.message || 'Could not load categories for the menu item form.');
    }
  }

  async function handleArchiveMenuItem(item) {
    if (busyItemRef.current) return;
    busyItemRef.current = item.id;
    setBusyItem(item.id);
    try {
      const approved = await confirm({ title: 'Archive this menu item?', message: `“${item.name}” will no longer appear on customer menus.`, confirmLabel: 'Archive item', tone: 'danger' });
      if (!approved) return;
      setNotice('');
      await archiveVendorMenuItem(item.id, { token });
      await loadMenu();
      setNotice(`${item.name} archived.`);
    }
    catch (error) { setNotice(error.message || 'Could not archive that item.'); }
    finally { busyItemRef.current = ''; setBusyItem(''); }
  }

  if (showingManagerView && selectedVendor?.role !== 'manager' && vendorsState === 'ready') {
    return <Navigate to="/vendor" replace />;
  }

  if (vendorsState === 'loading') {
    return <PageContainer className="vendor-ops-page-container"><div className="vendor-ops-page">
      <VendorDashboardSkeleton />
    </div></PageContainer>;
  }

  const headerActions = vendors.length > 1 && (
    <div className="vendor-ops-header-actions">
      {vendors.length > 1 && <label className="vendor-ops-picker">Vendor<select value={vendorId} onChange={(event) => setVendorId(event.target.value)}>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>}
    </div>
  );

  return <PageContainer className="vendor-ops-page-container"><div className="vendor-ops-page">
    <PageHeader eyebrow="Vendor workspace" title={selectedVendor?.name || 'Vendor operations'} subtitle="A clear view of what needs preparing and what customers can order today." actions={headerActions} />
    {vendorsState === 'error' && <div className="vendor-ops-alert" role="alert">{vendorError}</div>}
    {vendorsState === 'ready' && !vendors.length && <div className="vendor-ops-empty"><IconShoppingBag size={30} /><h3>No vendor access yet</h3><p>Your account is not assigned to a vendor. Ask an administrator to add you to the vendor team.</p></div>}
    {selectedVendor && <VendorWorkspaceLayout
      vendorName={selectedVendor.name}
      role={selectedVendor.role}
      activeView={activeView}
      onNavigate={(view) => setSearchParams(view === 'overview' ? {} : { view })}
    >
      {notice && <p className="vendor-ops-notice" role="status">{notice}</p>}
      {!showingManagerView && ordersState === 'loading' && <VendorSummarySkeleton />}
      {!showingManagerView && ordersState !== 'loading' && <div className="vendor-ops-summary">
        <SummaryCard label="Active orders" value={queueCounts.active} detail="In your live queue" Icon={IconShoppingBag} />
        <SummaryCard label="Needs attention" value={urgentCount} detail="Collection within 15 minutes" Icon={IconAlertTriangle} tone={urgentCount ? 'warning' : ''} />
        <SummaryCard label="Ready to collect" value={readyCount} detail="Waiting for customer pickup" Icon={IconSoup} tone="blue" />
        <SummaryCard label="Next collection" value={nextCollection ? formatTime(nextCollection.starts_at) : '—'} detail={nextCollection?.order_reference || 'No scheduled orders'} Icon={IconClockHour4} />
      </div>}
      {showingMenuManagement
        ? <VendorMenuManagementPage
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
            {ordersState === 'ready' && !visibleOrders.length && <div className="vendor-ops-section-empty">{filter !== 'active' && queueCounts.active ? 'No orders match this filter.' : 'No active orders. New paid orders will appear here.'}</div>}
            {ordersState === 'ready' && pagedOrders.map((order) => <OrderCard key={order.id} order={order} busy={busyOrder === order.id} urgent={isUrgent(order, now)} onStatus={handleOrderStatus} />)}
            <div className="vendor-list-pagination-slot"><Pagination currentPage={safeQueuePage} totalPages={queueTotalPages} totalItems={queuePagination.total} itemsPerPage={VENDOR_LIST_PAGE_SIZE} label="orders" onPageChange={setQueuePage} /></div>
          </div>
        </VendorSection>
        <VendorSection title="Menu items" description="Manage catalogue items and their customer availability" Icon={IconSoup} className="vendor-ops-section--menu" action={selectedVendor.role === 'manager' ? <PrimaryButton onClick={() => openMenuItemEditor({ isNew: true })}>Add item</PrimaryButton> : null}>
          <div className="vendor-menu-list">
            {menuState === 'loading' && <VendorMenuItemsSkeleton />}
            {menuError && menuState !== 'error' && <div className="vendor-ops-inline-error" role="status">Menu refresh failed: {menuError}</div>}
            {menuState === 'error' && <div className="vendor-ops-inline-error" role="alert">{menuError}</div>}
            {menuState === 'ready' && !menuPagination.total && <div className="vendor-ops-section-empty">No menu items have been added yet.</div>}
            {menuState === 'ready' && pagedMenuItems.map((item) => <div className="vendor-menu-item-wrap" key={item.id}><MenuItemCard item={item} busy={busyItem === item.id} onSave={handleAvailability} canManage={selectedVendor.role === 'manager'} onEdit={openMenuItemEditor} onArchive={handleArchiveMenuItem} /></div>)}
            <div className="vendor-list-pagination-slot"><Pagination currentPage={safeMenuPage} totalPages={menuTotalPages} totalItems={menuPagination.total} itemsPerPage={VENDOR_LIST_PAGE_SIZE} label="menu items" onPageChange={setMenuPage} /></div>
        </div>
        </VendorSection>
      </div>
      <p className="vendor-ops-footnote">Availability indicates whether an item can be ordered. Quantity-based stock is not enabled yet.</p>
      {editingItem && <MenuItemModal item={editingItem.isNew ? null : editingItem} categories={menuCategories} submitting={savingEditor} usePrimaryButtons onClose={() => setEditingItem(null)} onSubmit={handleMenuItemSave} />}
      </>}
    </VendorWorkspaceLayout>}
  </div></PageContainer>;
}
