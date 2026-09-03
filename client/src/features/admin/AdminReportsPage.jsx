import { useState } from 'react';
import {
  IconReceipt,
  IconBuildingStore,
  IconChartLine,
  IconClock,
  IconBriefcase,
  IconFileAnalytics,
  IconDownload,
  IconCalendar,
  IconPrinter,
  IconMail,
  IconArrowUpRight,
  IconTrendingUp,
  IconLeaf,
  IconAlertTriangle,
  IconChartBar,
} from '@tabler/icons-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
} from 'recharts';
import {
  REPORT_TYPES,
  REPORT_RANGES,
  SALES_REPORT,
  VENDOR_PERFORMANCE_REPORT,
  DEMAND_REPORT,
  PEAK_REPORT,
  CORPORATE_REPORT,
  formatCurrency,
} from './adminMockData.js';

const ICON_MAP = {
  IconReceipt,
  IconBuildingStore,
  IconChartLine,
  IconClock,
  IconBriefcase,
};

function StatTile({ label, value, sub, trend, icon: Icon, tone = 'blue' }) {
  return (
    <div className={`admin-kpi admin-kpi--${tone}`}>
      <span className="admin-kpi__label">
        {Icon && <Icon size={14} stroke={1.8} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />}
        {label}
      </span>
      <span className="admin-kpi__value">{value}</span>
      {sub && <span className="admin-kpi__sub">{sub}</span>}
      {trend && (
        <div className="admin-kpi__foot">
          <IconTrendingUp size={14} stroke={2} />
          <span className="admin-kpi__delta admin-kpi__delta--up">{trend}</span>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ eyebrow, title, sub, actions }) {
  return (
    <header className="admin-card__head admin-card__head--inline">
      <div>
        <span className="admin-card__eyebrow">{eyebrow}</span>
        <h3 className="admin-card__title">{title}</h3>
        {sub && <p className="admin-report-section__sub">{sub}</p>}
      </div>
      {actions && <div className="admin-report-section__actions">{actions}</div>}
    </header>
  );
}

/* ── SALES ── */

function SalesReport() {
  const { summary, revenueTrend, byPaymentMethod, bySite, byCategory } = SALES_REPORT;

  return (
    <div className="admin-report-stack">
      <section className="admin-kpis" aria-label="Sales summary">
        <StatTile label="Revenue" value={formatCurrency(summary.revenue)} trend={summary.revenueDelta} tone="blue" />
        <StatTile label="Orders" value={summary.orders.toLocaleString()} trend={summary.ordersDelta} tone="green" />
        <StatTile label="Avg basket" value={`R ${summary.avgBasket.toFixed(2)}`} trend={summary.basketDelta} tone="blue" />
        <StatTile label="New customers" value={summary.newCustomers} trend={summary.customerDelta} tone="amber" />
      </section>

      <div className="admin-order-grid">
        <div className="admin-order-grid__main">
          <section className="admin-card">
            <SectionHeader
              eyebrow="Performance"
              title="Revenue & orders · last 8 days"
              sub="Daily revenue (R) with order count overlay."
              actions={
                <span className="admin-card__chip">
                  {REPORT_RANGES.find((r) => r.id === '7d').label}
                </span>
              }
            />
            <div className="admin-card__chart">
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={revenueTrend} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="reportRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0A8CFF" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#0A8CFF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(10,140,255,0.08)" vertical={false} />
                  <XAxis dataKey="date" stroke="#98A3AF" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="rev" stroke="#98A3AF" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="ord" orientation="right" stroke="#98A3AF" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.96)',
                      border: '1px solid #E4F2FF',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area yAxisId="rev" type="monotone" dataKey="revenue" stroke="#0A8CFF" strokeWidth={2.5} fill="url(#reportRevenueFill)" name="Revenue (R)" />
                  <Line yAxisId="ord" type="monotone" dataKey="orders" stroke="#22A559" strokeWidth={2} dot={{ r: 3 }} name="Orders" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="admin-card">
            <SectionHeader
              eyebrow="Mix"
              title="Sales by category"
            />
            <ul className="admin-report-list">
              {byCategory.map((cat) => (
                <li key={cat.name} className="admin-report-row">
                  <span className="admin-report-row__label">{cat.name}</span>
                  <div className="admin-report-row__bar">
                    <span
                      className="admin-report-row__bar-fill"
                      style={{ width: `${cat.percent}%` }}
                    />
                  </div>
                  <span className="admin-report-row__value">
                    <strong>{formatCurrency(cat.revenue)}</strong>
                    <small>{cat.orders.toLocaleString()} orders · {cat.percent}%</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="admin-order-grid__side">
          <section className="admin-card">
            <SectionHeader eyebrow="Payments" title="Method breakdown" />
            <div className="admin-card__chart admin-card__chart--pie">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={byPaymentMethod}
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {byPaymentMethod.map((entry) => (
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
              {byPaymentMethod.map((entry) => (
                <li key={entry.name}>
                  <span className="admin-legend__dot" style={{ background: entry.color }} />
                  <span className="admin-legend__label">{entry.name}</span>
                  <span className="admin-legend__value">{entry.percent}%</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="admin-card">
            <SectionHeader eyebrow="Sites" title="Revenue by campus" />
            <ul className="admin-cp-vendor-list">
              {bySite.map((s) => (
                <li key={s.id} className="admin-cp-vendor">
                  <span className="admin-cp-vendor__logo" style={{ background: 'var(--color-action-secondary)' }}>
                    <IconReceipt size={16} stroke={1.8} color="var(--color-action-link)" />
                  </span>
                  <div className="admin-cp-vendor__body">
                    <span className="admin-cp-vendor__name">{s.name}</span>
                    <span className="admin-cp-vendor__cats">{s.orders.toLocaleString()} orders · {s.share}% of total</span>
                  </div>
                  <span className="admin-cp-vendor__meta">
                    <span><strong>{formatCurrency(s.revenue)}</strong></span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── VENDOR PERFORMANCE ── */

function VendorPerformanceReport() {
  const { summary, rankings, topItems, cancellations } = VENDOR_PERFORMANCE_REPORT;

  return (
    <div className="admin-report-stack">
      <section className="admin-kpis" aria-label="Vendor performance summary">
        <StatTile label="Top vendor revenue" value={formatCurrency(summary.topRevenue)} sub="Library Bistro" tone="blue" />
        <StatTile label="Top vendor orders" value={summary.topOrders} sub="Library Bistro" tone="green" />
        <StatTile label="Avg prep time" value={summary.avgPrep} sub="across vendors" tone="amber" />
        <StatTile label="Avg rating" value={summary.avgRating.toFixed(1)} sub="4.5+ across all vendors" tone="blue" />
      </section>

      <div className="admin-order-grid">
        <div className="admin-order-grid__main">
          <section className="admin-card">
            <SectionHeader
              eyebrow="Rankings"
              title="Vendor rankings"
              sub="Sorted by revenue. Click a vendor to drill down."
            />
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Vendor</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>Rating</th>
                  <th>Completion %</th>
                  <th>Avg prep</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((v) => (
                  <tr key={v.name} className="admin-order-row">
                    <td>
                      <span className="admin-report-rank">
                        <span className="admin-report-rank__num">#{v.rank}</span>
                      </span>
                    </td>
                    <td className="admin-vendor-name">{v.name}</td>
                    <td>{v.orders.toLocaleString()}</td>
                    <td><strong>{formatCurrency(v.revenue)}</strong></td>
                    <td>
                      <span className="admin-vendor-rating">★ {v.avgRating.toFixed(1)}</span>
                    </td>
                    <td>
                      <div className="admin-report-row__bar admin-report-row__bar--mini">
                        <span
                          className={`admin-report-row__bar-fill ${v.completionRate >= 95 ? 'admin-report-row__bar-fill--success' : v.completionRate >= 90 ? 'admin-report-row__bar-fill--warning' : 'admin-report-row__bar-fill--error'}`}
                          style={{ width: `${v.completionRate}%` }}
                        />
                      </div>
                      <small>{v.completionRate}%</small>
                    </td>
                    <td>{v.avgPrepMins} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="admin-card">
            <SectionHeader eyebrow="Cancellations" title="Cancellations & refunds by vendor" />
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Cancellations</th>
                  <th>Refunds</th>
                  <th>Revenue lost</th>
                </tr>
              </thead>
              <tbody>
                {cancellations.map((c) => (
                  <tr key={c.vendor} className="admin-order-row">
                    <td className="admin-vendor-name">{c.vendor}</td>
                    <td>{c.cancellations}</td>
                    <td>{c.refunds}</td>
                    <td>
                      <span className="admin-report-row__lost">
                        <IconAlertTriangle size={13} stroke={2} />
                        {formatCurrency(c.revenueLost)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <div className="admin-order-grid__side">
          <section className="admin-card">
            <SectionHeader eyebrow="Top items" title="Best sellers" />
            <ul className="admin-cp-vendor-list">
              {topItems.map((item) => (
                <li key={item.name} className="admin-cp-vendor">
                  <span className="admin-cp-vendor__logo" style={{ background: 'var(--color-action-secondary)' }}>
                    <IconLeaf size={16} stroke={1.8} color="var(--color-action-link)" />
                  </span>
                  <div className="admin-cp-vendor__body">
                    <span className="admin-cp-vendor__name">{item.name}</span>
                    <span className="admin-cp-vendor__cats">{item.vendor} · {item.orders} orders</span>
                  </div>
                  <span className="admin-cp-vendor__meta">
                    <span><strong>{formatCurrency(item.revenue)}</strong></span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="admin-card">
            <SectionHeader eyebrow="Visualisation" title="Vendor revenue" />
            <div className="admin-card__chart">
              <ResponsiveContainer width="100%" height={210}>
                <BarChart
                  data={rankings.map((r) => ({ name: r.name.split(' ')[0], revenue: r.revenue }))}
                  margin={{ top: 8, right: 16, bottom: 0, left: -10 }}
                >
                  <CartesianGrid stroke="rgba(10,140,255,0.08)" vertical={false} />
                  <XAxis dataKey="name" stroke="#98A3AF" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#98A3AF" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.96)',
                      border: '1px solid #E4F2FF',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="revenue" fill="#0A8CFF" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── DEMAND & WASTAGE ── */

function DemandReport() {
  const { plannedVsActual, trend, byMeal } = DEMAND_REPORT;

  return (
    <div className="admin-report-stack">
      <section className="admin-kpis" aria-label="Demand summary">
        <StatTile label="Planned" value={plannedVsActual.planned.toLocaleString()} sub="units this period" tone="blue" />
        <StatTile label="Ordered" value={plannedVsActual.ordered.toLocaleString()} sub={`${Math.round((plannedVsActual.ordered / plannedVsActual.planned) * 100)}% of plan`} tone="green" />
        <StatTile label="Produced" value={plannedVsActual.produced.toLocaleString()} sub="kitchen output" tone="blue" />
        <div className="admin-kpi admin-kpi--amber">
          <span className="admin-kpi__label">
            <IconAlertTriangle size={14} stroke={1.8} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
            Waste rate
          </span>
          <span className="admin-kpi__value">{plannedVsActual.wasteRate.toFixed(1)}%</span>
          <span className="admin-kpi__sub">{plannedVsActual.unsold.toLocaleString()} unsold / {plannedVsActual.wasted.toLocaleString()} wasted</span>
        </div>
      </section>

      <div className="admin-order-grid">
        <div className="admin-order-grid__main">
          <section className="admin-card">
            <SectionHeader eyebrow="Weekly" title="Planned vs ordered vs wasted" />
            <div className="admin-card__chart">
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={trend} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="rgba(10,140,255,0.08)" vertical={false} />
                  <XAxis dataKey="week" stroke="#98A3AF" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#98A3AF" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.96)',
                      border: '1px solid #E4F2FF',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="planned" fill="#E4F2FF" radius={[4, 4, 0, 0]} name="Planned" />
                  <Bar dataKey="ordered" fill="#0A8CFF" radius={[4, 4, 0, 0]} name="Ordered" />
                  <Bar dataKey="produced" fill="#22A559" radius={[4, 4, 0, 0]} name="Produced" />
                  <Line type="monotone" dataKey="wasted" stroke="#D94A4A" strokeWidth={2} name="Wasted" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="admin-card">
            <SectionHeader eyebrow="By meal" title="Demand vs waste by item" />
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Meal</th>
                  <th>Planned</th>
                  <th>Ordered</th>
                  <th>Produced</th>
                  <th>Wasted</th>
                  <th>Waste %</th>
                </tr>
              </thead>
              <tbody>
                {byMeal.map((m) => {
                  const pct = Math.round((m.wasted / m.produced) * 100);
                  return (
                    <tr key={m.meal} className="admin-order-row">
                      <td className="admin-vendor-name">{m.meal}</td>
                      <td>{m.planned.toLocaleString()}</td>
                      <td>{m.ordered.toLocaleString()}</td>
                      <td>{m.produced.toLocaleString()}</td>
                      <td>{m.wasted.toLocaleString()}</td>
                      <td>
                        <span className={`admin-flag admin-flag--${pct < 5 ? 'success' : pct < 10 ? 'warning' : 'error'}`}>
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>

        <div className="admin-order-grid__side">
          <section className="admin-card">
            <SectionHeader eyebrow="Insights" title="Waste reduction tips" />
            <ul className="admin-report-tips">
              <li>
                <span className="admin-report-tips__icon admin-report-tips__icon--success"><IconLeaf size={14} stroke={2} /></span>
                <span><strong>Vegetable Pasta</strong> sold out 2x in the last week — increase planned quantity by ~10%.</span>
              </li>
              <li>
                <span className="admin-report-tips__icon admin-report-tips__icon--warning"><IconAlertTriangle size={14} stroke={2} /></span>
                <span><strong>Berry Scone</strong> over-produced on Mondays. Drop production by 8% on Mondays.</span>
              </li>
              <li>
                <span className="admin-report-tips__icon admin-report-tips__icon--info"><IconChartBar size={14} stroke={2} /></span>
                <span><strong>House Cappuccino</strong> demand peaks 11:00 – 13:00 — stagger prep rounds to reduce waste.</span>
              </li>
              <li>
                <span className="admin-report-tips__icon admin-report-tips__icon--success"><IconLeaf size={14} stroke={2} /></span>
                <span>Save the average <strong>R 9 400 / month</strong> by tuning top 5 menu items to actual demand.</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── PEAK TIMES (HEATMAP) ── */

function PeakReport() {
  const { byHour, byDayOfWeek, heatmap } = PEAK_REPORT;

  const maxHeat = Math.max(...heatmap.map((h) => h.value));
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17'];

  return (
    <div className="admin-report-stack">
      <section className="admin-kpis">
        <StatTile label="Peak hour" value="13:00" sub="386 orders · daily avg" tone="blue" />
        <StatTile label="Peak day" value="Thursday" sub="728 orders · avg" tone="green" />
        <StatTile label="Lunch window" value="12:00 – 14:00" sub="62% of daily orders" tone="amber" />
        <StatTile label="Quiet hours" value="08:00 – 10:00" sub="ideal for promos" tone="blue" />
      </section>

      <div className="admin-order-grid">
        <div className="admin-order-grid__main">
          <section className="admin-card">
            <SectionHeader eyebrow="Demand heatmap" title="Orders by day & hour" />
            <div className="admin-heatmap">
              <div className="admin-heatmap__head">
                <span></span>
                {hours.map((h) => (
                  <span key={h} className="admin-heatmap__hour">{h}:00</span>
                ))}
              </div>
              {days.map((d) => (
                <div key={d} className="admin-heatmap__row">
                  <span className="admin-heatmap__day">{d}</span>
                  {hours.map((h) => {
                    const cell = heatmap.find((x) => x.day === d && x.hour === h);
                    const intensity = cell ? Math.min(cell.value / maxHeat, 1) : 0;
                    return (
                      <div
                        key={`${d}-${h}`}
                        className="admin-heatmap__cell"
                        style={{
                          background: `rgba(10, 140, 255, ${0.06 + intensity * 0.85})`,
                          borderColor: `rgba(10, 140, 255, ${0.1 + intensity * 0.4})`,
                        }}
                        title={`${d} ${h}:00 — ${cell?.value ?? 0} orders`}
                      >
                        <span>{cell?.value ?? '—'}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>

          <section className="admin-card">
            <SectionHeader eyebrow="By day" title="Orders by day of week" />
            <div className="admin-card__chart">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byDayOfWeek} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="rgba(10,140,255,0.08)" vertical={false} />
                  <XAxis dataKey="day" stroke="#98A3AF" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#98A3AF" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.96)',
                      border: '1px solid #E4F2FF',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="orders" fill="#0A8CFF" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <div className="admin-order-grid__side">
          <section className="admin-card">
            <SectionHeader eyebrow="By hour" title="Hourly distribution" />
            <div className="admin-card__chart">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={byHour} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="peakAreaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0A8CFF" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#0A8CFF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(10,140,255,0.08)" vertical={false} />
                  <XAxis dataKey="hour" stroke="#98A3AF" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#98A3AF" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.96)',
                      border: '1px solid #E4F2FF',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="orders" stroke="#0A8CFF" strokeWidth={2.5} fill="url(#peakAreaFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── CORPORATE ── */

function CorporateReport() {
  const { summary, byCostCentre, byVendor, upcoming } = CORPORATE_REPORT;

  return (
    <div className="admin-report-stack">
      <section className="admin-kpis">
        <StatTile label="Orders" value={summary.orders} trend={summary.growth} tone="blue" />
        <StatTile label="Revenue" value={formatCurrency(summary.revenue)} tone="green" />
        <StatTile label="Avg order" value={formatCurrency(summary.avgOrder)} sub="per event" tone="amber" />
        <StatTile label="Active cost centres" value={byCostCentre.length} sub="business units" tone="blue" />
      </section>

      <div className="admin-order-grid">
        <div className="admin-order-grid__main">
          <section className="admin-card">
            <SectionHeader eyebrow="Cost centre" title="Top business units" />
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Department</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {byCostCentre.map((cc) => {
                  const share = Math.round((cc.revenue / summary.revenue) * 100);
                  return (
                    <tr key={cc.code} className="admin-order-row">
                      <td>
                        <span className="admin-user-num">{cc.code}</span>
                      </td>
                      <td className="admin-vendor-name">{cc.name}</td>
                      <td>{cc.orders}</td>
                      <td><strong>{formatCurrency(cc.revenue)}</strong></td>
                      <td>
                        <div className="admin-report-row__bar admin-report-row__bar--mini">
                          <span className="admin-report-row__bar-fill" style={{ width: `${share}%` }} />
                        </div>
                        <small>{share}%</small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="admin-card">
            <SectionHeader eyebrow="Pipeline" title="Upcoming corporate events" />
            <ul className="admin-cp-rows">
              {upcoming.map((e) => (
                <li key={e.id} className="admin-cp-row">
                  <div className="admin-cp-row__icon">
                    <IconBriefcase size={18} stroke={1.8} />
                  </div>
                  <div className="admin-cp-row__body">
                    <div className="admin-cp-row__head">
                      <span className="admin-cp-row__name">{e.event}</span>
                      <span className="admin-tag admin-tag--blue">{e.costCentre}</span>
                    </div>
                    <span className="admin-cp-row__loc">
                      <IconCalendar size={11} stroke={1.8} /> {e.when} · {e.attendees} attendees · {e.vendor}
                    </span>
                  </div>
                  <div className="admin-cp-row__meta">
                    <button type="button" className="admin-link-cta">
                      View <IconArrowUpRight size={13} stroke={2} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="admin-order-grid__side">
          <section className="admin-card">
            <SectionHeader eyebrow="Vendors" title="Revenue by vendor" />
            <ul className="admin-report-list">
              {byVendor.map((v) => (
                <li key={v.vendor} className="admin-report-row">
                  <span className="admin-report-row__label">{v.vendor}</span>
                  <div className="admin-report-row__bar">
                    <span className="admin-report-row__bar-fill" style={{ width: `${(v.revenue / byVendor[0].revenue) * 100}%` }} />
                  </div>
                  <span className="admin-report-row__value">
                    <strong>{formatCurrency(v.revenue)}</strong>
                    <small>{v.orders} orders</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── MAIN ── */

export default function AdminReportsPage() {
  const [tab, setTab] = useState('sales');
  const [range, setRange] = useState('30d');

  const currentReport = REPORT_TYPES.find((r) => r.id === tab);

  const renderReport = () => {
    switch (tab) {
      case 'sales': return <SalesReport />;
      case 'vendors': return <VendorPerformanceReport />;
      case 'demand': return <DemandReport />;
      case 'peak': return <PeakReport />;
      case 'corporate': return <CorporateReport />;
      default: return <SalesReport />;
    }
  };

  return (
    <div className="admin-orders">
      <header className="admin-vendors__header">
        <div>
          <span className="admin-card__eyebrow">Analytics</span>
          <p className="admin-vendors__sub">
            Generate sales, vendor performance, demand & wastage, peak times and corporate catering reports.
          </p>
        </div>
        <div className="admin-vendors__actions">
          <button type="button" className="admin-action">
            <IconMail size={13} stroke={2} />
            Schedule email
          </button>
          <button type="button" className="admin-action">
            <IconPrinter size={13} stroke={2} />
            Print PDF
          </button>
          <button type="button" className="admin-action admin-action--approve">
            <IconDownload size={13} stroke={2} />
            Export
          </button>
        </div>
      </header>

      <div className="admin-vendors__tabs" role="tablist">
        {REPORT_TYPES.map((t) => {
          const Icon = ICON_MAP[t.icon];
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`admin-vendors__tab${tab === t.id ? ' admin-vendors__tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {Icon && <Icon size={16} stroke={1.8} />}
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="admin-reports__controls">
        <div className="admin-reports__filters">
          <div className="admin-reports__filter-label">
            <IconCalendar size={14} stroke={1.8} />
            Range
          </div>
          <div className="admin-vendors__chips" role="group" aria-label="Date range">
            {REPORT_RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`admin-vendors__chip${range === r.id ? ' admin-vendors__chip--active' : ''}`}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-reports__active-name">
          <IconFileAnalytics size={14} stroke={1.8} />
          {currentReport?.label} · {REPORT_RANGES.find((r) => r.id === range).label}
        </div>
      </div>

      {renderReport()}
    </div>
  );
}
