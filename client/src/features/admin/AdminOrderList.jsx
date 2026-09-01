import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconSearch,
  IconReceipt,
  IconAlertTriangle,
  IconBuildingStore,
  IconClock,
  IconUser,
  IconChevronRight,
  IconDownload,
} from '@tabler/icons-react';
import {
  ADMIN_ORDERS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  ORDER_STATUS_FILTERS,
  ORDER_STATUS_FILTER_MATCH,
  formatCurrency,
} from './adminMockData.js';

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

function OrderRow({ order }) {
  const customer = order.customerName;
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
            {order.customerNumber}
          </span>
        </div>
      </td>
      <td>
        <span className="admin-order-vendor">
          <IconBuildingStore size={13} stroke={1.8} />
          {order.vendorName}
        </span>
      </td>
      <td>
        <div className="admin-order-time">
          <span>{order.items} items · {formatCurrency(order.total)}</span>
          <span className="admin-order-time-meta">
            <IconClock size={11} stroke={1.8} />
            {order.collectionSlot}
          </span>
        </div>
      </td>
      <td>
        <StatusPill status={order.status} />
        {order.flags?.length > 0 && (
          <div className="admin-order-flags">
            {order.flags.map((flag) => (
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

function StatBlock({ label, value, sub, tone }) {
  return (
    <div className={`admin-kpi admin-kpi--${tone || 'blue'}`}>
      <span className="admin-kpi__label">{label}</span>
      <span className="admin-kpi__value">{value}</span>
      {sub && <span className="admin-kpi__sub">{sub}</span>}
    </div>
  );
}

export default function AdminOrderList() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');

  const filtered = useMemo(() => {
    return ADMIN_ORDERS.filter((order) => {
      const matchesQuery = !query
        || `${order.id} ${order.customerName} ${order.customerNumber} ${order.vendorName}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = ORDER_STATUS_FILTER_MATCH[statusFilter](order);
      const matchesVendor = vendorFilter === 'all' || order.vendorId === vendorFilter;
      return matchesQuery && matchesStatus && matchesVendor;
    });
  }, [query, statusFilter, vendorFilter]);

  const todayCount = ADMIN_ORDERS.filter((o) => o.placedAt.startsWith('2026-09-01')).length;
  const preparingCount = ADMIN_ORDERS.filter((o) => o.status === 'preparing').length;
  const readyCount = ADMIN_ORDERS.filter((o) => o.status === 'ready_for_collection').length;
  const issueCount = ADMIN_ORDERS.filter((o) =>
    ['payment_pending', 'refund_pending', 'cancelled', 'rejected', 'collection_not_completed'].includes(o.status)
  ).length;

  return (
    <div className="admin-orders">
      <header className="admin-vendors__header">
        <div>
          <span className="admin-card__eyebrow">Order oversight</span>
          <h2 className="admin-vendors__title">All orders</h2>
          <p className="admin-vendors__sub">
            Search, filter and intervene across all customer orders. Late, refunded and rejected orders are flagged for action.
          </p>
        </div>
        <button type="button" className="admin-action">
          <IconDownload size={13} stroke={2} />
          Export CSV
        </button>
      </header>

      <section className="admin-kpis" aria-label="Order metrics">
        <StatBlock label="Orders today" value={todayCount} sub="across all vendors" tone="blue" />
        <StatBlock label="Preparing" value={preparingCount} sub="kitchen in progress" tone="blue" />
        <StatBlock label="Ready for collection" value={readyCount} sub="awaiting customer" tone="green" />
        <StatBlock label="Needs attention" value={issueCount} sub="urgent / refunds / failed" tone="amber" />
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
          {ORDER_STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`admin-vendors__chip${statusFilter === filter.id ? ' admin-vendors__chip--active' : ''}`}
              onClick={() => setStatusFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <select
          className="admin-orders__vendor-select"
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          aria-label="Vendor filter"
        >
          {VENDOR_FILTERS.map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
      </div>

      {filtered.length > 0 ? (
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
              {filtered.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-empty">
          <IconReceipt size={32} stroke={1.4} />
          <h3>No orders match those filters</h3>
          <p>Try clearing the search or choosing a different status / vendor.</p>
          <button
            type="button"
            className="admin-action"
            onClick={() => { setQuery(''); setStatusFilter('all'); setVendorFilter('all'); }}
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
