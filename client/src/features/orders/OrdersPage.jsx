import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconHelpCircle, IconClipboardCheck, IconKey } from '@tabler/icons-react';
import PageContainer from '../../components/layout/PageContainer.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import OrdersBackground from '../../components/OrdersBackground.jsx';
import OrderList from '../../components/orders/OrderList.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { listMyOrders } from '../../services/employeeApi.js';
import './orders.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const PER_PAGE = 5;

export default function OrdersPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [counts, setCounts] = useState({ all: 0, active: 0, completed: 0, cancelled: 0 });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      try {
        const [allRes, activeRes, completedRes, cancelledRes] = await Promise.all([
          listMyOrders({ page: 1, limit: 100, token }),
          listMyOrders({ page: 1, limit: 100, status: 'active', token }),
          listMyOrders({ page: 1, limit: 100, status: 'completed', token }),
          listMyOrders({ page: 1, limit: 100, status: 'cancelled', token }),
        ]);
        if (!cancelled) {
          setOrders(allRes?.orders || []);
          setCounts({
            all: allRes?.pagination?.total || (allRes?.orders || []).length,
            active: activeRes?.pagination?.total || (activeRes?.orders || []).length,
            completed: completedRes?.pagination?.total || (completedRes?.orders || []).length,
            cancelled: cancelledRes?.pagination?.total || (cancelledRes?.orders || []).length,
          });
        }
      } catch (err) {
        console.error('Failed to fetch orders:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [token]);

  const filteredOrders = useMemo(() => {
    return orders;
  }, [orders]);

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
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`orders-filter-chip${activeFilter === filter.id ? ' orders-filter-chip--active' : ''}`}
              onClick={() => handleFilterChange(filter.id)}
              aria-pressed={activeFilter === filter.id}
            >
              {filter.label}
              <span className="orders-filter-chip__count">{counts[filter.id] || 0}</span>
            </button>
          ))}
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
