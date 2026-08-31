import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconHelpCircle, IconClipboardCheck, IconKey } from '@tabler/icons-react';
import PageContainer from '../../components/layout/PageContainer.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import OrdersBackground from '../../components/OrdersBackground.jsx';
import OrderList from '../../components/orders/OrderList.jsx';
import Pagination from '../../components/orders/Pagination.jsx';
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

const PER_PAGE = 5;

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

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

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PER_PAGE));

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return filteredOrders.slice(start, start + PER_PAGE);
  }, [filteredOrders, currentPage]);

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
                onClick={() => handleFilterChange(filter.id)}
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
          <div className="orders-layout">
            <div className="orders-layout__main">
              {filteredOrders.length > 0 ? (
                <>
                  <OrderList orders={paginatedOrders} />
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </>
              ) : (
                <div className="orders-empty">
                  <div className="orders-empty__content">
                    <h2 className="orders-empty__title">No orders yet</h2>
                    <p className="orders-empty__text">Start your first order from one of our campus cafeterias.</p>
                    <button type="button" className="orders-empty__btn" onClick={() => window.location.href = '/cafeterias'}>
                      Browse Cafeterias
                    </button>
                  </div>
                </div>
              )}
            </div>

            <aside className="orders-layout__aside">
              <div className="orders-code-reminder">
                <div className="orders-code-reminder__header">
                  <IconKey size={18} stroke={1.8} />
                  <h3 className="orders-code-reminder__title">Collection Code</h3>
                </div>
                <p className="orders-code-reminder__text">
                  When your order is ready, you'll receive a 4-digit code. Show it at the collection point to pick up your food.
                </p>
                <div className="orders-code-reminder__example">
                  <span className="orders-code-reminder__code">8X2P</span>
                  <span className="orders-code-reminder__label">Example code</span>
                </div>
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
                  <li>Show your 4-digit code to collect</li>
                </ol>
              </div>

              <Link to="/help" className="orders-help-link">
                <IconHelpCircle size={18} stroke={1.8} />
                <span>Need help with an order?</span>
              </Link>
            </aside>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
