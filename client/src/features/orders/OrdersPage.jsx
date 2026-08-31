import { useEffect, useMemo, useState } from 'react';
import PageContainer from '../../components/layout/PageContainer.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import OrdersBackground from '../../components/OrdersBackground.jsx';
import OrderList from '../../components/orders/OrderList.jsx';
import OrderEmptyState from '../../components/orders/OrderEmptyState.jsx';
import { fetchOrders } from '../../services/orders.js';
import { ORDER_STATUSES } from './orderMockData.js';
import './orders.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const ACTIVE_STATUSES = [
  ORDER_STATUSES.PAYMENT_PENDING,
  ORDER_STATUSES.SUBMITTED,
  ORDER_STATUSES.PAYMENT_CONFIRMED,
  ORDER_STATUSES.RECEIVED_BY_VENDOR,
  ORDER_STATUSES.ACCEPTED,
  ORDER_STATUSES.PREPARING,
  ORDER_STATUSES.READY_FOR_COLLECTION,
];

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    fetchOrders()
      .then((data) => {
        if (!cancelled) {
          setOrders(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filteredOrders = useMemo(() => {
    if (activeFilter === 'all') return orders;
    if (activeFilter === 'active') return orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
    if (activeFilter === 'completed') return orders.filter((o) => o.status === ORDER_STATUSES.COMPLETED || o.status === ORDER_STATUSES.COLLECTED);
    if (activeFilter === 'cancelled') return orders.filter((o) => o.status === ORDER_STATUSES.CANCELLED || o.status === ORDER_STATUSES.REJECTED || o.status === ORDER_STATUSES.REFUNDED);
    return orders;
  }, [orders, activeFilter]);

  return (
    <PageContainer className="orders-page-container">
      <OrdersBackground />
      <div className="orders-page">
        <PageHeader
          title="My Orders"
          subtitle="Track, collect, and review your campus cafeteria orders."
        />

        <div className="orders-filters" role="group" aria-label="Order filters">
          {FILTERS.map((filter) => {
            const count = filter.id === 'all'
              ? orders.length
              : filter.id === 'active'
                ? orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length
                : filter.id === 'completed'
                  ? orders.filter((o) => o.status === ORDER_STATUSES.COMPLETED || o.status === ORDER_STATUSES.COLLECTED).length
                  : orders.filter((o) => o.status === ORDER_STATUSES.CANCELLED || o.status === ORDER_STATUSES.REJECTED || o.status === ORDER_STATUSES.REFUNDED).length;

            return (
              <button
                key={filter.id}
                type="button"
                className={`orders-filter-chip${activeFilter === filter.id ? ' orders-filter-chip--active' : ''}`}
                onClick={() => setActiveFilter(filter.id)}
                aria-pressed={activeFilter === filter.id}
              >
                {filter.label}
                <span className="orders-filter-chip__count">{count}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading orders...</p>
        ) : (
          <>
            {filteredOrders.length > 0 ? (
              <OrderList orders={filteredOrders} />
            ) : (
              <OrderEmptyState />
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
