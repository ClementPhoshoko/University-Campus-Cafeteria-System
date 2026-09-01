import {
  IconTrendingUp,
  IconTrendingDown,
  IconAlertTriangle,
  IconCircleCheck,
  IconArrowRight,
  IconBuildingStore,
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

const TONE_TONE = {
  up: { icon: IconTrendingUp, className: 'admin-kpi__delta admin-kpi__delta--up' },
  down: { icon: IconTrendingDown, className: 'admin-kpi__delta admin-kpi__delta--down' },
};

function KpiCard({ kpi }) {
  const trend = TONE_TONE[kpi.trend];
  const TrendIcon = trend?.icon;
  return (
    <div className={`admin-kpi admin-kpi--${kpi.tone}`}>
      <span className="admin-kpi__label">{kpi.label}</span>
      <span className="admin-kpi__value">{kpi.value}</span>
      <div className="admin-kpi__foot">
        {TrendIcon && <TrendIcon size={14} stroke={2} />}
        <span className={trend?.className}>{kpi.delta}</span>
      </div>
    </div>
  );
}

function ActivityItem({ item }) {
  return (
    <li className={`admin-activity admin-activity--${item.tone}`}>
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
  return (
    <li className="admin-pending-item">
      <span className="admin-pending-icon">
        <IconBuildingStore size={16} stroke={1.8} />
      </span>
      <div className="admin-pending-info">
        <span className="admin-pending-name">{item.name}</span>
        <span className="admin-pending-meta">{item.campus} · {item.category}</span>
      </div>
      <span className="admin-pending-time">{item.submittedAt}</span>
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
      <div className="admin-failed-icon">
        <IconAlertTriangle size={16} stroke={1.8} />
      </div>
      <div className="admin-failed-info">
        <span className="admin-failed-head">
          {payment.order} · <strong>{payment.amount}</strong>
        </span>
        <span className="admin-failed-meta">{payment.vendor} · {payment.reason}</span>
      </div>
      <button type="button" className="admin-action admin-action--ghost">Resolve</button>
    </li>
  );
}

export default function AdminDashboardPage() {
  return (
    <div className="admin-dashboard">
      {/* KPI grid */}
      <section className="admin-kpis" aria-label="Key metrics">
        {KPIS.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </section>

      {/* Charts row */}
      <section className="admin-charts">
        <div className="admin-card admin-card--wide">
          <header className="admin-card__head">
            <div>
              <span className="admin-card__eyebrow">Weekly trend</span>
              <h2 className="admin-card__title">Order volume & revenue</h2>
            </div>
            <span className="admin-card__chip">Last 7 days</span>
          </header>
          <div className="admin-card__chart">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={ORDER_VOLUME_TREND} margin={{ top: 10, right: 16, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="adminOrdersFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0A8CFF" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0A8CFF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22A559" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#22A559" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(10,140,255,0.08)" vertical={false} />
                <XAxis dataKey="day" stroke="#98A3AF" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#98A3AF" fontSize={11} tickLine={false} axisLine={false} width={36} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255,255,255,0.96)',
                    border: '1px solid #E4F2FF',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="orders" stroke="#0A8CFF" strokeWidth={2.5} fill="url(#adminOrdersFill)" name="Orders" />
                <Area type="monotone" dataKey="revenue" stroke="#22A559" strokeWidth={2} fill="url(#adminRevenueFill)" name="Revenue (R)" />
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
          <div className="admin-card__chart admin-card__chart--pie">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={ORDER_STATUS_BREAKDOWN}
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {ORDER_STATUS_BREAKDOWN.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255,255,255,0.96)',
                    border: '1px solid #E4F2FF',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="admin-legend">
            {ORDER_STATUS_BREAKDOWN.map((entry) => (
              <li key={entry.name}>
                <span className="admin-legend__dot" style={{ background: entry.color }} />
                <span className="admin-legend__label">{entry.name}</span>
                <span className="admin-legend__value">{entry.value}</span>
              </li>
            ))}
          </ul>
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
            <Link to="/admin/vendors" className="admin-card__link">
              View all <IconArrowRight size={13} stroke={2} />
            </Link>
          </header>
          <div className="admin-card__chart">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={VENDOR_PERFORMANCE} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="rgba(10,140,255,0.08)" vertical={false} />
                <XAxis dataKey="name" stroke="#98A3AF" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#98A3AF" fontSize={11} tickLine={false} axisLine={false} width={36} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255,255,255,0.96)',
                    border: '1px solid #E4F2FF',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="orders" fill="#0A8CFF" radius={[6, 6, 0, 0]} />
                <Bar dataKey="revenue" fill="#22A559" radius={[6, 6, 0, 0]} />
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
          <ul className="admin-activity-list">
            {RECENT_ACTIVITY.map((item) => (
              <ActivityItem key={item.id} item={item} />
            ))}
          </ul>
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
              {TOP_CAFETERIAS.map((vendor) => (
                <VendorRow key={vendor.id} vendor={vendor} />
              ))}
            </tbody>
          </table>
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
          <ul className="admin-failed-list">
            {FAILED_PAYMENTS.map((payment) => (
              <FailedPaymentRow key={payment.id} payment={payment} />
            ))}
          </ul>
        </div>
      </section>

      {/* Pending approvals */}
      <section className="admin-grid">
        <div className="admin-card admin-card--full">
          <header className="admin-card__head">
            <div>
              <span className="admin-card__eyebrow">Onboarding</span>
              <h2 className="admin-card__title">Pending vendor approvals</h2>
            </div>
            <Link to="/admin/vendors?tab=approvals" className="admin-card__link">
              Manage <IconArrowRight size={13} stroke={2} />
            </Link>
          </header>
          <ul className="admin-pending-list">
            {PENDING_VENDOR_APPROVALS.map((item) => (
              <PendingApprovalItem key={item.id} item={item} />
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
