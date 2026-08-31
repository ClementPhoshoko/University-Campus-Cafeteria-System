import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IconChevronLeft, IconMapPin, IconClock, IconCreditCard } from '@tabler/icons-react';
import PageContainer from '../../components/layout/PageContainer.jsx';
import OrderProgress from './components/OrderProgress.jsx';
import OrderItemList from './components/OrderItemList.jsx';
import OrderSummary from './components/OrderSummary.jsx';
import CollectionCode from './components/CollectionCode.jsx';
import OrderActions from './components/OrderActions.jsx';

import { fetchOrderById, cancelOrder, reorderOrder, rateOrder } from '../../services/orders.js';
import {
  getVendorById,
  getCollectionPointName,
  formatCollectionSlot,
  formatOrderDate,
  formatOrderTime,
  ORDER_STATUSES,
} from './orderMockData.js';
import './orders.css';

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchOrderById(orderId)
      .then((data) => {
        if (!cancelled) {
          setOrder(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [orderId]);

  const handleCancel = async (id, reason) => {
    await cancelOrder(id, reason);
    const updated = await fetchOrderById(id);
    setOrder(updated);
  };

  const handleReorder = async (id) => {
    await reorderOrder(id);
    navigate('/cart');
  };

  const handleRate = async (id) => {
    await rateOrder(id, 5, 'Great food!');
    const updated = await fetchOrderById(id);
    setOrder(updated);
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

  const vendor = getVendorById(order.vendor_id);
  const showCode = [
    ORDER_STATUSES.PREPARING,
    ORDER_STATUSES.READY_FOR_COLLECTION,
    ORDER_STATUSES.COLLECTED,
    ORDER_STATUSES.COMPLETED,
  ].includes(order.status);

  return (
    <PageContainer className="order-detail-container">
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
                {vendor?.name} · {formatOrderDate(order.created_at)} at {formatOrderTime(order.created_at)}
              </p>
            </div>
            <span className="order-detail__total">R {order.total.toFixed(2)}</span>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-secondary)', fontSize: '0.86rem' }}>
                  <IconMapPin size={16} stroke={1.8} />
                  {getCollectionPointName(order)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-secondary)', fontSize: '0.86rem' }}>
                  <IconClock size={16} stroke={1.8} />
                  Ready around {formatCollectionSlot(order)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-secondary)', fontSize: '0.86rem' }}>
                  <IconCreditCard size={16} stroke={1.8} />
                  Paid with {order.payment_method?.replace(/_/g, ' ')}
                </span>
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
