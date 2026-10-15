import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconHelpCircle, IconClipboardCheck, IconKey } from '@tabler/icons-react';
import PageContainer from '../../components/layout/PageContainer.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import OrdersBackground from '../../components/OrdersBackground.jsx';
import OrderList from '../../components/orders/OrderList.jsx';
import OrderEmptyState from '../../components/orders/OrderEmptyState.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useFetch } from '../../hooks/useFetch.js';
import { getVendor, listMyOrders } from '../../services/employeeApi.js';
import { CACHE_TTL } from '../../services/cache.js';
import './orders.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const PER_PAGE = 5;
const ACTIVE_STATUSES = new Set([
  'payment_pending',
  'submitted',
  'payment_confirmed',
  'received_by_vendor',
  'accepted',
  'preparing',
  'ready_for_collection',
]);
const COMPLETED_STATUSES = new Set(['completed', 'collected']);
const CANCELLED_STATUSES = new Set(['cancelled', 'rejected', 'refunded']);

function matchesFilter(order, filterId) {
  if (filterId === 'active') return ACTIVE_STATUSES.has(order.status);
  if (filterId === 'completed') return COMPLETED_STATUSES.has(order.status);
  if (filterId === 'cancelled') return CANCELLED_STATUSES.has(order.status);
  return true;
}

function OrdersAside() {
  return (
    <aside className="orders-layout__aside">
      <div className="orders-code-reminder">
        <div className="orders-code-reminder__header">
          <IconKey size={18} stroke={1.8} />
          <h3 className="orders-code-reminder__title">Collection Code</h3>
        </div>
        <p className="orders-code-reminder__text">
          Each order has its own 4-character collection code. Find it on the confirmation screen and in order details when the order is ready. Show it at the collection point.
        </p>
      </div>

      <div className="orders-info-card">
        <div className="orders-info-card__header">
          <IconClipboardCheck size={18} stroke={1.8} />
          <h3 className="orders-info-card__title">How collection works</h3>
        </div>
        <ol className="orders-info-card__steps">
          <li>Place your order and choose a collection slot</li>
          <li>Wait for the vendor to prepare your food</li>
          <li>Head to the collection point when ready</li>
          <li>Show your 4-character code to collect</li>
        </ol>
      </div>

      <Link to="/help" className="orders-help-link">
        <IconHelpCircle size={18} stroke={1.8} />
        <span>Need help with an order?</span>
      </Link>
    </aside>
  );
}

export default function OrdersPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const userId = session?.user?.id;
  const hasSession = Boolean(token && userId);
  const [activeFilter, setActiveFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const attemptedImageRefreshes = useRef(new Set());

  const fetchOrders = useCallback(({ signal }) => (
    listMyOrders({ page: 1, limit: 100, token, signal })
  ), [token]);
  const transformOrders = useCallback((response) => ({ ...response, ownerId: userId }), [userId]);
  const {
    data: cachedResponse,
    state: fetchState,
    isError,
    invalidate,
    mutate,
  } = useFetch(fetchOrders, {
    cacheKey: userId ? `employee:orders:v2:${userId}` : null,
    enabled: hasSession,
    staleTime: CACHE_TTL.orders,
    transform: transformOrders,
  });
  const ordersResponse = cachedResponse?.ownerId === userId ? cachedResponse : null;
  const orders = Array.isArray(ordersResponse?.orders) ? ordersResponse.orders : [];
  const isInitialLoading = hasSession && !ordersResponse && (fetchState === 'loading' || fetchState === 'idle');

  const refreshVendorImage = async (vendorId, failedImage) => {
    const refreshKey = `${vendorId}`;
    if (!vendorId || attemptedImageRefreshes.current.has(refreshKey)) return;
    attemptedImageRefreshes.current.add(refreshKey);

    try {
      const response = await getVendor(vendorId, { token, cache: 'no-cache', refreshImages: true });
      const image = response?.vendor?.logo_url;
      if (!image || image === failedImage) return;
      mutate((current) => current && ({
        ...current,
        orders: current.orders.map((order) => (
          order.vendor_id === vendorId ? { ...order, vendorLogo: image } : order
        )),
      }));
    } catch (error) {
      console.error(`Unable to refresh vendor image for ${vendorId}:`, error);
    }
  };

  const filteredOrders = useMemo(() => {
    if (activeFilter === 'all') return orders;
    return orders.filter((order) => matchesFilter(order, activeFilter));
  }, [orders, activeFilter]);

  const counts = useMemo(() => ({
    all: orders.length,
    active: orders.filter((order) => matchesFilter(order, 'active')).length,
    completed: orders.filter((order) => matchesFilter(order, 'completed')).length,
    cancelled: orders.filter((order) => matchesFilter(order, 'cancelled')).length,
  }), [orders]);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return filteredOrders.slice(start, start + PER_PAGE);
  }, [filteredOrders, page]);

  const handleFilterChange = (filterId) => {
    setActiveFilter(filterId);
    setCurrentPage(1);
  };

  return (
    <PageContainer className="orders-page-container">
      <OrdersBackground />
      <div className="orders-page">
        <PageHeader
          title="My Orders"
          subtitle="Track, collect, and review your campus cafeteria orders."
        />

        {isInitialLoading ? (
          <div className="orders-filters orders-filters--skeleton" aria-hidden="true">
            {FILTERS.map((filter) => <Skeleton key={filter.id} className="orders-filter-skeleton" />)}
          </div>
        ) : (
          <div className="orders-filters" role="group" aria-label="Order filters">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`orders-filter-chip${activeFilter === filter.id ? ' orders-filter-chip--active' : ''}`}
                onClick={() => handleFilterChange(filter.id)}
                aria-pressed={activeFilter === filter.id}
              >
                {filter.label}
                <span className="orders-filter-chip__count">{counts[filter.id]}</span>
              </button>
            ))}
          </div>
        )}

        <div className="orders-layout">
          <div className="orders-layout__main">
            {isInitialLoading ? (
              <div className="orders-list" aria-label="Loading orders">
                {Array.from({ length: 3 }, (_, index) => (
                  <div className="order-list__row" key={index} aria-hidden="true">
                    <Skeleton className="order-list__number-skeleton" />
                    <div className="order-card order-card--skeleton">
                      <Skeleton className="order-skeleton__image" />
                      <div className="order-skeleton__body">
                        <Skeleton className="skeleton--text" style={{ width: '42%', height: 16 }} />
                        <Skeleton className="skeleton--text" style={{ width: '66%', height: 12 }} />
                        <Skeleton className="skeleton--text" style={{ width: '78%', height: 12 }} />
                      </div>
                      <div className="order-skeleton__end">
                        <Skeleton className="skeleton--text" style={{ width: 72, height: 16 }} />
                        <Skeleton className="skeleton--text" style={{ width: 90, height: 24 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : !hasSession || (isError && !ordersResponse) ? (
              <div className="orders-load-error" role="alert">
                <h2 className="orders-load-error__title">
                  {!hasSession ? 'Your session could not be verified' : 'Could not load your orders'}
                </h2>
                <p className="orders-load-error__text">
                  {!hasSession
                    ? 'Please sign in again to view your orders.'
                    : 'Please check your connection and try again.'}
                </p>
                {hasSession && (
                  <button type="button" className="orders-retry" onClick={invalidate}>
                    Try again
                  </button>
                )}
              </div>
            ) : (
              <>
                {isError && (
                  <p className="orders-refresh-error" role="status">
                    Orders could not be refreshed. Showing the last available results.
                  </p>
                )}
                {filteredOrders.length > 0 ? (
                  <>
                    <OrderList orders={paginatedOrders} onImageError={refreshVendorImage} />
                    <Pagination
                      currentPage={page}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </>
                ) : orders.length === 0 ? (
                  <OrderEmptyState />
                ) : (
                  <OrderEmptyState
                    title={`No ${activeFilter} orders`}
                    text="Try a different filter to see your orders."
                    showBrowseButton={false}
                  />
                )}
              </>
            )}
          </div>
          <OrdersAside />
        </div>
      </div>
    </PageContainer>
  );
}
