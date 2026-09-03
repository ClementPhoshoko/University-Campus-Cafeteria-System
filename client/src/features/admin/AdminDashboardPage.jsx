import { useState, useEffect, useRef } from 'react';
import {
  IconTrendingUp,
  IconTrendingDown,
  IconAlertTriangle,
  IconCircleCheck,
  IconArrowRight,
  IconBuildingStore,
  IconCalendar,
  IconChevronDown,
  IconChartBar,
  IconCoin,
} from '@tabler/icons-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { Link } from 'react-router-dom';
import {
  KPIS,
  ORDER_VOLUME_TREND,
  ORDER_STATUS_BREAKDOWN,
  VENDOR_PERFORMANCE,
  RECENT_ACTIVITY,
  FAILED_PAYMENTS,
  PENDING_VENDOR_APPROVALS,
  TOP_CAFETERIAS,
  formatCurrency,
} from './adminMockData.js';

const KPI_ICONS = {
  orders: IconChartBar,
  revenue: IconCoin,
  vendors: IconBuildingStore,
  failed: IconAlertTriangle,
};

const TONE_TONE = {
  up: { icon: IconTrendingUp, className: 'admin-kpi__delta admin-kpi__delta--up' },
  down: { icon: IconTrendingDown, className: 'admin-kpi__delta admin-kpi__delta--down' },
};

function KpiItem({ kpi, showDivider }) {
  const trend = TONE_TONE[kpi.trend];
  const TrendIcon = trend?.icon;
  const KpiIcon = KPI_ICONS[kpi.id];
  return (
    <div className="admin-kpi">
      <div className="admin-kpi__icon-wrap">
        {KpiIcon && <KpiIcon size={24} stroke={1.8} />}
      </div>
      <div className="admin-kpi__body">
        <span className="admin-kpi__label">{kpi.label}</span>
        <span className="admin-kpi__value">{kpi.value}</span>
        <div className="admin-kpi__foot">
          {TrendIcon && <TrendIcon size={12} stroke={2} />}
          <span className={trend?.className}>{kpi.delta}</span>
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ item, isNew }) {
  return (
    <li className={`admin-activity admin-activity--${item.tone}${isNew ? ' admin-activity--new' : ''}`}>
      <span className="admin-activity__dot" aria-hidden="true" />
      <div className="admin-activity__body">
        <span className="admin-activity__line">
          <strong>{item.actor}</strong> {item.action} <em>{item.target}</em>
        </span>
        <span className="admin-activity__time">{item.time}</span>
      </div>
    </li>
  );
}

function ActivitySkeleton() {
  return (
    <li className="admin-activity admin-activity--skeleton">
      <span className="admin-activity__dot" />
      <div className="admin-activity__body">
        <span className="admin-activity__line">
          <span className="skeleton skeleton--text" style={{ width: '60%' }} />
        </span>
        <span className="admin-activity__time">
          <span className="skeleton skeleton--text" style={{ width: '40px' }} />
        </span>
      </div>
    </li>
  );
}

function VendorRow({ vendor }) {
  return (
    <tr className="admin-vendor-row">
      <td>
        <span className="admin-vendor-name">{vendor.name}</span>
      </td>
      <td>
        <span className={`admin-status admin-status--${vendor.status}`}>{vendor.status}</span>
      </td>
      <td>{vendor.orders_today}</td>
      <td>
        <span className="admin-vendor-rating">★ {vendor.average_rating}</span>
      </td>
      <td className="admin-vendor-cta">
        <Link to={`/admin/vendors`} className="admin-link-cta">
          View <IconArrowRight size={13} stroke={2} />
        </Link>
      </td>
    </tr>
  );
}

function PendingApprovalItem({ item }) {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  };

  return (
    <li className="admin-pending-item">
      <span className="admin-pending-icon">
        <IconBuildingStore size={16} stroke={1.8} />
      </span>
      <div className="admin-pending-info">
        <span className="admin-pending-name">{item.name}</span>
        <span className="admin-pending-meta">
          <span>{item.vendor_location_name}</span>
          <span>·</span>
          <span>{item.categories?.[0]}</span>
        </span>
      </div>
      <span className="admin-pending-time">{formatDate(item.created_at)}</span>
      <div className="admin-pending-actions">
        <button type="button" className="admin-action admin-action--approve">Approve</button>
        <button type="button" className="admin-action admin-action--reject">Reject</button>
      </div>
    </li>
  );
}

function FailedPaymentRow({ payment }) {
  return (
    <li className="admin-failed-item">
      <div className="admin-failed-info">
        <span className="admin-failed-head">
          {payment.order} · <strong><span>{payment.amount}</span></strong>
        </span>
        <span className="admin-failed-meta">{payment.vendor} · {payment.reason}</span>
      </div>
      <button type="button" className="admin-action admin-action--ghost">Resolve</button>
    </li>
  );
}

const PERIOD_OPTIONS = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState('24h');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(null);
  const [activityCount, setActivityCount] = useState(4);
  const [activityLoading, setActivityLoading] = useState(false);
  const [cafeteriaCount, setCafeteriaCount] = useState(4);
  const [cafeteriaLoading, setCafeteriaLoading] = useState(false);
  const [failedCount, setFailedCount] = useState(4);
  const [failedLoading, setFailedLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(4);
  const [pendingLoading, setPendingLoading] = useState(false);
  const listBottomRef = useRef(null);
  const cafeteriaBottomRef = useRef(null);
  const failedBottomRef = useRef(null);
  const pendingBottomRef = useRef(null);

  const selectedLabel = PERIOD_OPTIONS.find(o => o.value === period)?.label || 'Last 24 hours';

  const totalOrders = ORDER_STATUS_BREAKDOWN.reduce((sum, e) => sum + e.value, 0);
  const hoveredRadius = 78;
  const normalRadius = 72;

  const handleLoadMoreActivity = () => {
    if (activityCount >= RECENT_ACTIVITY.length) return;
    setActivityLoading(true);
    setTimeout(() => {
      setActivityCount(prev => Math.min(prev + 4, RECENT_ACTIVITY.length));
      setActivityLoading(false);
      listBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 600);
  };

  const handleLoadMoreCafeteria = () => {
    if (cafeteriaCount >= TOP_CAFETERIAS.length) return;
    setCafeteriaLoading(true);
    setTimeout(() => {
      setCafeteriaCount(prev => Math.min(prev + 4, TOP_CAFETERIAS.length));
      setCafeteriaLoading(false);
      cafeteriaBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 600);
  };

  const handleLoadMoreFailed = () => {
    if (failedCount >= FAILED_PAYMENTS.length) return;
    setFailedLoading(true);
    setTimeout(() => {
      setFailedCount(prev => Math.min(prev + 4, FAILED_PAYMENTS.length));
      setFailedLoading(false);
      failedBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 600);
  };

  const handleLoadMorePending = () => {
    if (pendingCount >= PENDING_VENDOR_APPROVALS.length) return;
    setPendingLoading(true);
    setTimeout(() => {
      setPendingCount(prev => Math.min(prev + 4, PENDING_VENDOR_APPROVALS.length));
      setPendingLoading(false);
      pendingBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 600);
  };

  return (
    <div className="admin-dashboard">
      {/* KPI strip */}
      <div className="admin-kpis__controls">
        <span className="admin-kpis__title">OVERVIEW</span>
        <div className="admin-kpis__dropdown">
          <button
            type="button"
            className="admin-kpis__period"
            onClick={() => setIsOpen(!isOpen)}
          >
            <IconCalendar size={13} stroke={1.8} />
            {selectedLabel}
            <IconChevronDown size={12} stroke={2} />
          </button>
          {isOpen && (
            <div className="admin-kpis__dropdown-menu">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`admin-kpis__dropdown-item${period === option.value ? ' admin-kpis__dropdown-item--active' : ''}`}
                  onClick={() => {
                    setPeriod(option.value);
                    setIsOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="admin-kpis">
        <div className="admin-kpis__row">
          {KPIS.map((kpi, idx) => (
            <KpiItem key={kpi.id} kpi={kpi} showDivider={idx < KPIS.length - 1} />
          ))}
        </div>
      </div>

      {/* Charts row */}
      <section className="admin-charts">
        <div className="admin-card admin-card--wide">
          <header className="admin-card__head">
            <div>
              <span className="admin-card__eyebrow">Weekly trend</span>
              <h2 className="admin-card__title">Order volume & revenue</h2>
            </div>
            <span className="admin-card__chip">{selectedLabel}</span>
          </header>
          <div className="admin-chart-legend">
            <span className="admin-chart-legend__item">
              <span className="admin-chart-legend__dot" style={{ background: 'var(--color-action-primary)' }} />
              Orders
            </span>
            <span className="admin-chart-legend__item">
              <span className="admin-chart-legend__dot" style={{ background: 'var(--success-500)' }} />
              Revenue
            </span>
          </div>
          <div className="admin-card__chart">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={ORDER_VOLUME_TREND} margin={{ top: 10, right: 16, bottom: 0, left: 24 }}>
                <defs>
                  <linearGradient id="adminOrdersFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-action-primary)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-action-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--success-500)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--success-500)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border-subtle)" vertical={false} strokeDasharray="4 4" />
                <XAxis dataKey="day" stroke="var(--color-text-tertiary)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-text-tertiary)" fontSize={11} tickLine={false} axisLine={false} width={48} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-surface-raised)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12,
                    boxShadow: 'var(--elevation-md)',
                  }}
                  labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="orders" stroke="var(--color-action-primary)" strokeWidth={2.5} fill="url(#adminOrdersFill)" name="Orders" />
                <Area type="monotone" dataKey="revenue" stroke="var(--success-500)" strokeWidth={2} fill="url(#adminRevenueFill)" name="Revenue (R)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="admin-card">
          <header className="admin-card__head">
            <div>
              <span className="admin-card__eyebrow">Today</span>
              <h2 className="admin-card__title">Order status mix</h2>
            </div>
          </header>
          <div className="admin-card__pie-wrap">
            <div className="admin-card__chart admin-card__chart--pie">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={ORDER_STATUS_BREAKDOWN}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={activeIndex !== null ? hoveredRadius : normalRadius}
                    dataKey="value"
                    strokeWidth={0}
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    isAnimationActive={true}
                    animationDuration={200}
                    animationEasing="ease-out"
                  >
                    {ORDER_STATUS_BREAKDOWN.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={entry.color}
                        opacity={activeIndex === null || activeIndex === index ? 1 : 0.5}
                        style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="admin-card__pie-center">
                <span className="admin-card__pie-total">{totalOrders}</span>
                <span className="admin-card__pie-label">orders</span>
              </div>
            </div>
            <ul className="admin-legend">
              {ORDER_STATUS_BREAKDOWN.map((entry, index) => (
                <li
                  key={entry.name}
                  className={activeIndex === index ? 'admin-legend--active' : ''}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  <span className="admin-legend__dot" style={{ background: entry.color }} />
                  <span className="admin-legend__label">{entry.name}</span>
                  <span className="admin-legend__value">{entry.value}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="admin-card__pie-note">
            Order completion rate · Updated live
          </p>
        </div>
      </section>

      {/* Vendor performance + activity */}
      <section className="admin-grid">
        <div className="admin-card admin-card--wide">
          <header className="admin-card__head">
            <div>
              <span className="admin-card__eyebrow">Top performers</span>
              <h2 className="admin-card__title">Vendor performance</h2>
            </div>
            <div className="admin-card__head-actions">
              <span className="admin-card__chip">All time</span>
              <Link to="/admin/vendors" className="admin-card__link">
                View all <IconArrowRight size={13} stroke={2} />
              </Link>
            </div>
          </header>
          <div className="admin-chart-legend">
            <span className="admin-chart-legend__item">
              <span className="admin-chart-legend__dot" style={{ background: 'var(--color-action-primary)' }} />
              Total orders
            </span>
            <span className="admin-chart-legend__item">
              <span className="admin-chart-legend__dot" style={{ background: 'var(--success-500)' }} />
              Revenue (R)
            </span>
          </div>
          <div className="admin-card__chart">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart
                data={VENDOR_PERFORMANCE}
                layout="vertical"
                margin={{ top: 0, right: 60, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="vendorOrdersGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--color-action-primary)" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="var(--color-action-primary)" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="vendorRevenueGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--success-500)" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="var(--success-500)" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border-subtle)" horizontal={false} vertical={true} strokeDasharray="3 3" />
                <XAxis type="number" stroke="var(--color-text-tertiary)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="var(--color-text-tertiary)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-surface-raised)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12,
                    boxShadow: 'var(--elevation-md)',
                  }}
                  labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
                  cursor={{ fill: 'var(--color-bg-secondary)', radius: 4 }}
                />
                <Bar dataKey="orders" fill="url(#vendorOrdersGrad)" radius={[0, 4, 4, 0]} barSize={12} />
                <Bar dataKey="revenue" fill="url(#vendorRevenueGrad)" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="admin-card">
          <header className="admin-card__head">
            <div>
              <span className="admin-card__eyebrow">Live feed</span>
              <h2 className="admin-card__title">Recent activity</h2>
            </div>
            <span className="admin-card__chip admin-card__chip--success">
              <IconCircleCheck size={13} stroke={2} /> Operational
            </span>
          </header>
          <div className="admin-activity-wrap">
            <div className="admin-activity-scroll">
              <ul className="admin-activity-list">
                {RECENT_ACTIVITY.slice(0, activityCount).map((item, idx) => (
                  <ActivityItem key={item.id} item={item} isNew={idx >= activityCount - 4 && activityCount < RECENT_ACTIVITY.length} />
                ))}
              </ul>
              {activityLoading && (
                <div className="admin-activity-loading">
                  <ActivitySkeleton />
                  <ActivitySkeleton />
                </div>
              )}
              <div ref={listBottomRef} />
            </div>
            {activityCount < RECENT_ACTIVITY.length && !activityLoading && (
              <button
                type="button"
                className="admin-activity-load-more"
                onClick={handleLoadMoreActivity}
              >
                Load more
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Tables + failed payments */}
      <section className="admin-grid">
        <div className="admin-card admin-card--wide">
          <header className="admin-card__head">
            <div>
              <span className="admin-card__eyebrow">Cafeteria directory</span>
              <h2 className="admin-card__title">Active cafeterias</h2>
            </div>
            <span className="admin-card__chip">Updated 2 min ago</span>
          </header>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Orders Today</th>
                  <th>Rating</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {TOP_CAFETERIAS.slice(0, cafeteriaCount).map((vendor) => (
                  <VendorRow key={vendor.id} vendor={vendor} />
                ))}
              </tbody>
            </table>
            {cafeteriaLoading && (
              <div className="admin-activity-loading">
                <div className="skeleton skeleton--text" style={{ width: '100%', height: '20px' }} />
                <div className="skeleton skeleton--text" style={{ width: '100%', height: '20px' }} />
              </div>
            )}
            <div ref={cafeteriaBottomRef} />
            {cafeteriaCount < TOP_CAFETERIAS.length && !cafeteriaLoading && (
              <button
                type="button"
                className="admin-activity-load-more"
                onClick={handleLoadMoreCafeteria}
              >
                Load more
              </button>
            )}
          </div>
        </div>

        <div className="admin-card">
          <header className="admin-card__head">
            <div>
              <span className="admin-card__eyebrow">Needs attention</span>
              <h2 className="admin-card__title">Failed payments</h2>
            </div>
            <span className="admin-card__chip admin-card__chip--warning">
              <IconAlertTriangle size={13} stroke={2} /> {FAILED_PAYMENTS.length}
            </span>
          </header>
          <div className="admin-activity-wrap">
            <div className="admin-activity-scroll">
              <ul className="admin-failed-list">
                {FAILED_PAYMENTS.slice(0, failedCount).map((payment) => (
                  <FailedPaymentRow key={payment.id} payment={payment} />
                ))}
              </ul>
              {failedLoading && (
                <div className="admin-activity-loading">
                  <div className="skeleton skeleton--text" style={{ width: '100%', height: '40px' }} />
                  <div className="skeleton skeleton--text" style={{ width: '100%', height: '40px' }} />
                </div>
              )}
              <div ref={failedBottomRef} />
            </div>
            {failedCount < FAILED_PAYMENTS.length && !failedLoading && (
              <button
                type="button"
                className="admin-activity-load-more"
                onClick={handleLoadMoreFailed}
              >
                Load more
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
