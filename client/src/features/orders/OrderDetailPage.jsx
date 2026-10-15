import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IconChevronLeft, IconMapPin, IconClock, IconCreditCard } from '@tabler/icons-react';
import PageContainer from '../../components/layout/PageContainer.jsx';
import OrderDetailBackground from '../../components/OrderDetailBackground.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import OrderProgress from '../../components/orders/OrderProgress.jsx';
import OrderItemList from '../../components/orders/OrderItemList.jsx';
import OrderSummary from '../../components/orders/OrderSummary.jsx';
import CollectionCode from '../../components/orders/CollectionCode.jsx';
import OrderActions from '../../components/orders/OrderActions.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useFetch } from '../../hooks/useFetch.js';
import { CACHE_TTL, invalidateCache } from '../../services/cache.js';
import { getMyOrder, cancelMyOrder, reorderOrder, rateOrder } from '../../services/employeeApi.js';
import './orders.css';

const REFRESHABLE_ORDER_STATUSES = new Set([
  'payment_pending',
  'submitted',
  'payment_confirmed',
  'received_by_vendor',
  'accepted',
  'preparing',
]);

function formatOrderDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatOrderTime(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function OrderDetailSkeleton() {
  return (
    <div className="order-detail-skeleton" role="status" aria-label="Loading order details" aria-busy="true">
      <Skeleton className="order-detail-skeleton__back" />
      <div className="order-detail-skeleton__heading">
        <div className="order-detail-skeleton__heading-copy">
          <Skeleton className="order-detail-skeleton__title" />
          <Skeleton className="order-detail-skeleton__subtitle" />
        </div>
        <Skeleton className="order-detail-skeleton__total" />
      </div>
      <div className="order-detail__grid">
        <div className="order-detail__main">
          <div className="order-detail__panel order-detail-skeleton__panel">
            <Skeleton className="order-detail-skeleton__panel-title" />
            <Skeleton className="order-detail-skeleton__progress" />
          </div>
          <div className="order-detail__panel order-detail-skeleton__panel">
            <Skeleton className="order-detail-skeleton__panel-title" />
            {[1, 2, 3].map((row) => <Skeleton key={row} className="order-detail-skeleton__item" />)}
          </div>
          <div className="order-detail__panel order-detail-skeleton__panel">
            <Skeleton className="order-detail-skeleton__panel-title" />
            <Skeleton className="order-detail-skeleton__details" />
          </div>
        </div>
        <aside className="order-detail__sidebar">
          <div className="order-detail__panel order-detail-skeleton__panel"><Skeleton className="order-detail-skeleton__summary" /></div>
          <div className="order-detail__panel order-detail-skeleton__panel"><Skeleton className="order-detail-skeleton__summary" /></div>
        </aside>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const token = session?.access_token;
  const userId = session?.user?.id;
  const hasSession = Boolean(token && userId);
  const [actionError, setActionError] = useState('');
  const previousStatus = useRef(null);
  const loadOrder = useCallback(({ signal }) => getMyOrder(orderId, { token, signal }), [orderId, token]);
  const transformOrder = useCallback((response) => ({
    ownerId: userId,
    orderId,
    order: response?.order || null,
  }), [orderId, userId]);
  const orderFeed = useFetch(loadOrder, {
    cacheKey: hasSession && orderId ? `employee:order:${userId}:${orderId}` : null,
    enabled: hasSession && Boolean(orderId),
    staleTime: CACHE_TTL.orders,
    transform: transformOrder,
  });
  const orderResponse = orderFeed.data?.ownerId === userId && orderFeed.data?.orderId === orderId
    ? orderFeed.data
    : null;
  const order = orderResponse?.order || null;
  const isInitialLoading = hasSession && Boolean(orderId) && !orderResponse
    && ['idle', 'loading', 'refreshing'].includes(orderFeed.state);
  const refreshOrder = useCallback(() => orderFeed.invalidate(), [orderFeed.invalidate]);

  useEffect(() => {
    if (!order?.status) return;
    if (previousStatus.current && previousStatus.current !== order.status && userId) {
      invalidateCache(`employee:orders:v2:${userId}`);
    }
    previousStatus.current = order.status;
  }, [order?.status, userId]);

  useEffect(() => {
    if (!REFRESHABLE_ORDER_STATUSES.has(order?.status)) return undefined;
    const interval = window.setInterval(refreshOrder, 15_000);
    const refreshOnFocus = () => refreshOrder();
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [refreshOrder, order?.status]);

  const handleCancel = async (id, reason) => {
    if (!token) return;
    setActionError('');
    try {
      await cancelMyOrder(id, { reason }, { token });
      invalidateCache(`employee:orders:v2:${userId}`);
      await refreshOrder();
    } catch (error) {
      setActionError(error.message || 'Could not cancel this order. Please try again.');
    }
  };

  const handleReorder = async (id) => {
    if (!token) return;
    setActionError('');
    try {
      await reorderOrder(id, { token });
      navigate('/cart');
    } catch (error) {
      setActionError(error.message || 'Could not reorder these items. Please try again.');
    }
  };

  const handleRate = async (id) => {
    if (!token) return;
    setActionError('');
    try {
      await rateOrder(id, { ratings: { overall: 5 }, comments: 'Great food!' }, { token });
      await refreshOrder();
    } catch (error) {
      setActionError(error.message || 'Could not submit your rating. Please try again.');
    }
  };

  if (!hasSession) {
    return (
      <PageContainer className="orders-page-container">
        <OrderDetailBackground />
        <div className="order-detail">
          <div className="orders-load-error" role="alert">
            <h2 className="orders-load-error__title">Sign in to view this order</h2>
            <p className="orders-load-error__text">Your session could not be verified. Please sign in again.</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (isInitialLoading) {
    return (
      <PageContainer className="order-detail-container">
        <OrderDetailBackground />
        <div className="order-detail"><OrderDetailSkeleton /></div>
      </PageContainer>
    );
  }

  if (!orderResponse || !order) {
    const isNotFound = orderFeed.error?.status === 404;
    return (
      <PageContainer className="orders-page-container">
        <OrderDetailBackground />
        <div className="order-detail">
          <Link to="/orders" className="order-detail__back"><IconChevronLeft size={16} stroke={2} /> Back to orders</Link>
          <div className="orders-load-error" role="alert">
            <h2 className="orders-load-error__title">{isNotFound ? 'Order not found' : 'Could not load this order'}</h2>
            <p className="orders-load-error__text">
              {isNotFound ? 'This order may have been removed or is not available to your account.' : orderFeed.error?.message || 'Please check your connection and try again.'}
            </p>
            {!isNotFound && <button type="button" className="orders-retry" onClick={refreshOrder}>Try again</button>}
            <Link to="/orders" className="orders-retry-link">Back to my orders</Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  const vendor = order.vendor;
  const showCode = ['ready_for_collection', 'collected', 'completed'].includes(order.status);

  return (
    <PageContainer className="order-detail-container">
      <OrderDetailBackground />
      <div className="order-detail">
        <div className="order-detail__header">
          <Link to="/orders" className="order-detail__back">
            <IconChevronLeft size={16} stroke={2} />
            Back to orders
          </Link>
          <div className="order-detail__heading">
            <div>
              <h1 className="order-detail__title">Order {order.order_reference || 'Reference unavailable'}</h1>
              <p className="order-detail__subtitle">
                {vendor?.name || 'Vendor'} · {formatOrderDate(order.created_at)} at {formatOrderTime(order.created_at)}
              </p>
            </div>
            <span className="order-detail__total">R {Number(order.total || 0).toFixed(2)}</span>
          </div>
        </div>

        {orderFeed.isError && (
          <p className="orders-refresh-error" role="status">
            This order could not be refreshed. Showing the last available details.
            <button type="button" className="orders-retry orders-retry--inline" onClick={refreshOrder}>Try again</button>
          </p>
        )}
        {actionError && <p className="orders-action-error" role="alert">{actionError}</p>}

        <div className="order-detail__grid">
          <div className="order-detail__main">
            <div className="order-detail__panel">
              <h3 className="order-detail__panel-title">Order Status</h3>
              <OrderProgress order={order} />
            </div>

            <OrderItemList items={order.items || []} />

            {order.notes && (
              <div className="order-detail__panel">
                <h3 className="order-detail__panel-title">Order Notes</h3>
                <p className="order-detail__notes">{order.notes}</p>
              </div>
            )}

            <div className="order-detail__panel">
              <h3 className="order-detail__panel-title">Collection Details</h3>
              <div className="order-detail__detail-rows">
                <div className="order-detail__detail-row-grid">
                  <div className="order-detail__detail-row">
                    <IconMapPin size={18} stroke={1.8} />
                    <div className="order-detail__detail-row-content">
                      <span className="order-detail__detail-row-label">Pickup point</span>
                      <span className="order-detail__detail-row-value">{order.collectionPoint?.name || 'Not assigned'}</span>
                    </div>
                  </div>
                  <div className="order-detail__detail-row">
                    <IconClock size={18} stroke={1.8} />
                    <div className="order-detail__detail-row-content">
                      <span className="order-detail__detail-row-label">Collection time</span>
                      <span className="order-detail__detail-row-value">
                        {order.collectionSlot
                          ? `${new Date(order.collectionSlot.starts_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}, ${formatOrderTime(order.collectionSlot.starts_at)}–${formatOrderTime(order.collectionSlot.ends_at)}`
                          : 'Pending'}
                      </span>
                    </div>
                  </div>
                  <div className="order-detail__detail-row">
                    <IconCreditCard size={18} stroke={1.8} />
                    <div className="order-detail__detail-row-content">
                      <span className="order-detail__detail-row-label">Payment</span>
                      <span className="order-detail__detail-row-value">{order.payment_method?.replace(/_/g, ' ') || 'Pending'}</span>
                    </div>
                  </div>
                </div>
                {order.collectionPoint?.instructions && (
                  <p className="order-detail__collection-instructions">{order.collectionPoint.instructions}</p>
                )}
              </div>
            </div>
          </div>

          <div className="order-detail__sidebar">
            {showCode && <CollectionCode order={order} />}
            <OrderSummary order={order} />
            <OrderActions
              order={order}
              onCancel={handleCancel}
              onReorder={handleReorder}
              onRate={handleRate}
            />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
