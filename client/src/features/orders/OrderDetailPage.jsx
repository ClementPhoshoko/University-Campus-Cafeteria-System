import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IconChevronLeft, IconMapPin, IconClock, IconCreditCard } from '@tabler/icons-react';
import PageContainer from '../../components/layout/PageContainer.jsx';
import OrderDetailBackground from '../../components/OrderDetailBackground.jsx';
import OrderProgress from '../../components/orders/OrderProgress.jsx';
import OrderItemList from '../../components/orders/OrderItemList.jsx';
import OrderSummary from '../../components/orders/OrderSummary.jsx';
import CollectionCode from '../../components/orders/CollectionCode.jsx';
import OrderActions from '../../components/orders/OrderActions.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { getMyOrder, cancelMyOrder, reorderOrder, rateOrder } from '../../services/employeeApi.js';
import './orders.css';

function formatOrderDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatOrderTime(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const token = session?.access_token;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchOrder = async () => {
    if (!token || !orderId) return;
    try {
      const res = await getMyOrder(orderId, { token });
      setOrder(res?.order || null);
    } catch (err) {
      console.error('Failed to fetch order:', err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchOrder().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orderId, token]);

  const handleCancel = async (id, reason) => {
    if (!token) return;
    await cancelMyOrder(id, { reason }, { token });
    await fetchOrder();
  };

  const handleReorder = async (id) => {
    if (!token) return;
    await reorderOrder(id, { token });
    navigate('/cart');
  };

  const handleRate = async (id) => {
    if (!token) return;
    await rateOrder(id, { ratings: { overall: 5 }, comments: 'Great food!' }, { token });
    await fetchOrder();
  };

  if (loading) {
    return (
      <PageContainer>
        <p style={{ color: 'var(--color-text-secondary)', padding: 'var(--space-8) 0' }}>Loading order details...</p>
      </PageContainer>
    );
  }

  if (!order) {
    return (
      <PageContainer>
        <p style={{ color: 'var(--color-text-secondary)', padding: 'var(--space-8) 0' }}>Order not found.</p>
        <Link to="/orders" className="order-detail__back">Back to orders</Link>
      </PageContainer>
    );
  }

  const vendor = order.vendor;
  const showCode = ['preparing', 'ready_for_collection', 'collected', 'completed'].includes(order.status);

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
              <h1 className="order-detail__title">Order #{order.order_number}</h1>
              <p className="order-detail__subtitle">
                {vendor?.name || 'Vendor'} · {formatOrderDate(order.created_at)} at {formatOrderTime(order.created_at)}
              </p>
            </div>
            <span className="order-detail__total">R {Number(order.total || 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="order-detail__grid">
          <div className="order-detail__main">
            <div className="order-detail__panel">
              <h3 className="order-detail__panel-title">Order Status</h3>
              <OrderProgress order={order} />
            </div>

            <OrderItemList items={order.items || []} />

            <div className="order-detail__panel">
              <h3 className="order-detail__panel-title">Collection Details</h3>
              <div className="order-detail__detail-rows">
                <div className="order-detail__detail-row-grid">
                  <div className="order-detail__detail-row">
                    <IconMapPin size={18} stroke={1.8} />
                    <div className="order-detail__detail-row-content">
                      <span className="order-detail__detail-row-label">Pickup point</span>
                      <span className="order-detail__detail-row-value">{order.collection_point_id ? 'Collection Point' : 'N/A'}</span>
                    </div>
                  </div>
                  <div className="order-detail__detail-row">
                    <IconClock size={18} stroke={1.8} />
                    <div className="order-detail__detail-row-content">
                      <span className="order-detail__detail-row-label">Ready around</span>
                      <span className="order-detail__detail-row-value">{order.ready_at ? formatOrderTime(order.ready_at) : 'Pending'}</span>
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
