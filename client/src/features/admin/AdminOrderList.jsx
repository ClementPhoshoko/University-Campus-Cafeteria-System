import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  IconSearch,
  IconReceipt,
  IconAlertTriangle,
  IconBuildingStore,
  IconClock,
  IconUser,
  IconChevronRight,
  IconChevronDown,
  IconDownload,
  IconClipboardCheck,
  IconShoppingCart,
  IconTool,
  IconAlertCircle,
} from '@tabler/icons-react';
import Pagination from '../../components/ui/Pagination.jsx';
import { adminRequest } from '../../services/adminApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useRoles } from '../../hooks/useRoles.js';
import { formatCurrency } from './adminMockData.js';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.png';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  ORDER_STATUS_FILTERS,
  ORDER_STATUS_FILTER_MATCH,
} from './adminMockData.js';

const ITEMS_PER_PAGE = 10;

const VENDOR_FILTERS = [
  { id: 'all', label: 'All vendors' },
  { id: 'library-bistro', label: 'Library Bistro' },
  { id: 'main-campus-cafe', label: 'Main Campus Cafe' },
  { id: 'dining-hall-central', label: 'Dining Hall' },
  { id: 'grill-house-court', label: 'Grill House' },
  { id: 'res-court-kitchen', label: 'Res Court Kitchen' },
  { id: 'science-snack-bar', label: 'Science Snack Bar' },
];

function StatusPill({ status }) {
  const label = ORDER_STATUS_LABELS[status] || status;
  const tone = ORDER_STATUS_TONES[status] || 'info';
  return <span className={`admin-status admin-status--${tone}`}>{label}</span>;
}

function FlagPill({ flag }) {
  const labels = {
    urgent: { label: 'Urgent', tone: 'warning' },
    corporate: { label: 'Corporate', tone: 'info' },
    refund: { label: 'Refund', tone: 'success' },
    uncollected: { label: 'Uncollected', tone: 'error' },
    cancelled: { label: 'Cancelled', tone: 'error' },
    rejected: { label: 'Rejected', tone: 'error' },
  };
  const cfg = labels[flag] || { label: flag, tone: 'info' };
  return <span className={`admin-flag admin-flag--${cfg.tone}`}>{cfg.label}</span>;
}

const STATUS_TO_REDUNDANT_FLAGS = {
  refund_pending: ['refund'],
  collection_not_completed: ['uncollected'],
  cancelled: ['cancelled'],
  rejected: ['rejected'],
};

function OrderRow({ order }) {
  const customer = order.user_full_name;
  const redundantFlags = STATUS_TO_REDUNDANT_FLAGS[order.status] || [];
  const visibleFlags = (order.flags || []).filter((f) => !redundantFlags.includes(f));
  return (
    <tr className="admin-order-row">
      <td>
        <Link to={`/admin/orders/${order.id}`} className="admin-order-id">
          #{order.id}
        </Link>
      </td>
      <td>
        <div className="admin-order-customer">
          <span className="admin-order-customer-name">{customer}</span>
          <span className="admin-order-customer-meta">
            <IconUser size={11} stroke={1.8} />
            {order.employee_number}
          </span>
        </div>
      </td>
      <td>
        <span className="admin-order-vendor">
          <IconBuildingStore size={13} stroke={1.8} />
          {order.vendor_name}
        </span>
      </td>
      <td>
        <div className="admin-order-time">
          <span>{order.item_count} items · {formatCurrency(order.total)}</span>
          <span className="admin-order-time-meta">
            <IconClock size={11} stroke={1.8} />
            {order.collection_point_name}
          </span>
        </div>
      </td>
      <td>
        <StatusPill status={order.status} />
        {visibleFlags.length > 0 && (
          <div className="admin-order-flags">
            {visibleFlags.map((flag) => (
              <FlagPill key={flag} flag={flag} />
            ))}
          </div>
        )}
      </td>
      <td className="admin-order-cta">
        <Link to={`/admin/orders/${order.id}`} className="admin-link-cta">
          View <IconChevronRight size={13} stroke={2} />
        </Link>
      </td>
    </tr>
  );
}

function StatBlock({ label, value, sub, icon: Icon }) {
  return (
    <div className="admin-orders__kpi">
      <div className="admin-orders__kpi-icon">
        <Icon size={24} stroke={1.6} />
      </div>
      <div className="admin-orders__kpi-body">
        <span className="admin-orders__kpi-label">{label}</span>
        <span className="admin-orders__kpi-value">{value}</span>
        {sub && <span className="admin-orders__kpi-sub">{sub}</span>}
      </div>
    </div>
  );
}

function useStatusFilters(orders) {
  const STATUS_FILTERS = ['all', 'preparing', 'ready_for_collection', 'completed', 'cancelled', 'refund_pending', 'payment_pending', 'rejected', 'collection_not_completed'];
  const counts = { all: orders.length };
  STATUS_FILTERS.forEach((f) => {
    if (f !== 'all') counts[f] = orders.filter((o) => o.status === f).length;
  });
  return counts;
}

export default function AdminOrderList() {
  const { user, initialized } = useAuth();
  const { roles, loading: rolesLoading } = useRoles();
  const [token, setToken] = useState('');

  useEffect(() => {
    if (initialized && user?.session?.access_token) {
      setToken(user.session.access_token);
    }
  }, [initialized, user]);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchOrders = async () => {
      setLoading(true);
      try {
        const params = {
          search: query || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        };

        const apiPath = '/admin/vendors/approvals';

        const response = await adminRequest(apiPath, {
          token,
          query: params,
        });
        setOrders(response.data || []);
      } catch (err) {
        console.error('Failed to fetch orders:', err);
      } finally {
        setLoading(false);
        if (!cancelled) {
          setPage(1);
        }
      }
    };

    if (initialized && token) {
      fetchOrders();
    }
  }, [initialized, token, query, statusFilter, roles]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (vendorDropdownOpen && !e.target.closest('.admin-orders__vendor-select-wrapper')) {
        setVendorDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [vendorDropdownOpen]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  // Derive vendor list from orders for the filter dropdown
  const uniqueVendors = useMemo(() => {
    const seen = new Set();
    return [
      ...orders
        .filter((o) => o.vendor_name)
        .map((o) => ({ id: o.vendor_name.replace(/\s+/g, '-').toLowerCase(), label: o.vendor_name })),
      ...VENDOR_FILTERS,
    ].filter((v) => !seen.has(v.id) && seen.add(v.id));
  }, [orders]);

  const statusCounts = useStatusFilters(orders);
  const totalPages = Math.ceil(orders.length / ITEMS_PER_PAGE);
  const paginatedOrders = orders.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const todayCount = orders.filter((o) => o.created_at?.startsWith('2026-09-01')).length;
  const preparingCount = orders.filter((o) => o.status === 'preparing').length;
  const readyCount = orders.filter((o) => o.status === 'ready_for_collection').length;
  const issueCount = orders.filter((o) =>
    ['payment_pending', 'refund_pending', 'cancelled', 'rejected', 'collection_not_completed'].includes(o.status)
  ).length;

  const selectedVendor = uniqueVendors.find((v) => v.id === vendorFilter);

  return (
    <div className="admin-orders">
      <header className="admin-vendors__header">
        <div>
          <span className="admin-card__eyebrow">Order oversight</span>
          <p className="admin-vendors__sub">
            Search, filter and intervene across all customer orders. Late, refunded and rejected orders are flagged for action.
          </p>
        </div>
        <button type="button" className="admin-action--ghost">
          <IconDownload size={13} stroke={2} />
          Export CSV
        </button>
      </header>

      <section className="admin-orders__kpis" aria-label="Order metrics">
        <StatBlock label="Orders today" value={todayCount} sub="across all vendors" icon={IconShoppingCart} />
        <StatBlock label="Preparing" value={preparingCount} sub="kitchen in progress" icon={IconTool} />
        <StatBlock label="Ready for collection" value={readyCount} sub="awaiting customer" icon={IconClipboardCheck} />
        <StatBlock label="Needs attention" value={issueCount} sub="urgent / refunds / failed" icon={IconAlertCircle} />
      </section>

      <div className="admin-orders__filters">
        <div className="admin-vendors__search admin-orders__search">
          <IconSearch size={16} stroke={1.8} />
          <input
            type="search"
            placeholder="Search by order number, customer name or vendor..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search orders"
          />
        </div>

        <div className="admin-vendors__chips" role="group" aria-label="Status filter">
          {Object.keys(statusCounts).map((filter) => (
            <button
              key={filter}
              type="button"
              className={`admin-vendors__chip${statusFilter === filter ? ' admin-vendors__chip--active' : ''}`}
              onClick={() => setStatusFilter(filter)}
            >
              {filter}
              <span className="admin-vendors__chip-count">{statusCounts[filter]}</span>
            </button>
          ))}
        </div>

        <div className="admin-orders__vendor-select-wrapper">
          <button
            type="button"
            className="admin-orders__vendor-select"
            onClick={() => setVendorDropdownOpen(!vendorDropdownOpen)}
            aria-label="Filter by vendor"
          >
            {selectedVendor?.label || 'All vendors'}
            <IconChevronDown size={14} stroke={2} />
          </button>
          {vendorDropdownOpen && (
            <div className="admin-orders__vendor-select-dropdown">
              {uniqueVendors.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`admin-orders__vendor-select-option${vendorFilter === v.id ? ' admin-orders__vendor-select-option--active' : ''}`}
                  onClick={() => {
                    setVendorFilter(v.id);
                    setVendorDropdownOpen(false);
                  }}
                >
                  {v.label}
                  <span className="admin-orders__vendor-select-count">{statusCounts[v.id] || 0}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {paginatedOrders.length > 0 ? (
        <>
          <div className="admin-card admin-card--full">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Vendor</th>
                  <th>Items & time</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((order) => (
                  <OrderRow key={order.id} order={order} />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={orders.length}
            itemsPerPage={ITEMS_PER_PAGE}
            label="orders"
            onPageChange={setPage}
          />
        </>
      ) : (
        <div className="admin-empty">
          <img src={emptyStateAvatar} alt="" className="admin-empty__avatar" />
          <h3>No orders match those filters</h3>
          <p>Try clearing the search or choosing a different status / vendor.</p>
          <button
            type="button"
            className="admin-action--ghost"
            onClick={() => { setQuery(''); setStatusFilter('all'); setVendorFilter('all'); }}
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}