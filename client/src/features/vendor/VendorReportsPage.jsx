import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconArrowLeft,
  IconBuildingStore,
  IconChartBar,
  IconClock,
  IconDownload,
  IconInfoCircle,
  IconReceipt,
  IconRefresh,
} from '@tabler/icons-react';
import Pagination from '../../components/ui/Pagination.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import CustomDropdown from '../../components/ui/CustomDropdown.jsx';
import { exportVendorReportCsv, getVendorReport } from '../../services/vendorApi.js';
import { buildStatusSegments, formatStatusPercentage } from './vendorReportsDonut.js';
import './vendor-reports.css';

const PAGE_SIZE = 5;
const REPORT_PAGE_SIZE = 8;
const RANGE_OPTIONS = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'ytd', label: 'Year to date' },
  { id: 'custom', label: 'Custom' },
];
const EMPTY_PAGINATION = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 };
const EMPTY_REPORT = {
  range: null,
  summary: {
    revenue: 0, grossRevenue: 0, refunded: 0, orders: 0, avgOrder: 0,
    completed: 0, cancelled: 0, rejected: 0, fulfilmentRate: 0,
    statusChanges: 0, avgPrepMinutes: null,
  },
  revenueTrend: [], statusBreakdown: [], topItems: [], peakHours: [], locations: [],
};

const currency = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
const number = new Intl.NumberFormat('en-ZA');

function money(value) {
  return currency.format(Number(value || 0));
}

function formatDay(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en-ZA', {
      timeZone: 'UTC', day: '2-digit', month: 'short',
    }).format(new Date(`${value}T00:00:00.000Z`));
  } catch {
    return value;
  }
}

function formatDateTime(value, timeZone) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en-ZA', {
      timeZone: timeZone || 'Africa/Johannesburg',
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString('en-ZA');
  }
}

function statusTone(status) {
  if (['completed', 'collected', 'delivered', 'succeeded'].includes(status)) return 'success';
  if (['cancelled', 'rejected', 'failed', 'refunded'].includes(status)) return 'error';
  if (['preparing', 'ready_for_collection', 'delivery_in_progress'].includes(status)) return 'info';
  return 'warning';
}

function formatStatus(status) {
  return String(status || '').replaceAll('_', ' ');
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export default function VendorReportsPage({ vendorId, vendorName, token, onBack }) {
  const selectedLocationRef = useRef('');
  const [range, setRange] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [exporting, setExporting] = useState(false);
  const [hoveredStatus, setHoveredStatus] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const reportParams = useCallback(() => ({
    token,
    range,
    from: range === 'custom' ? customFrom : undefined,
    to: range === 'custom' ? customTo : undefined,
    vendorLocationId: selectedLocationRef.current || undefined,
  }), [token, range, customFrom, customTo]);

  const loadReport = useCallback(async (signal) => {
    if (!vendorId) return;
    setState('loading');
    setError('');
    try {
      const response = await getVendorReport(vendorId, {
        ...reportParams(),
        signal,
        page,
        limit: PAGE_SIZE,
      });
      if (signal?.aborted) return;
      setData(response);
      selectedLocationRef.current = response.selectedLocationId || '';
      setSelectedLocationId(selectedLocationRef.current);
      setLocations(response.locations || []);
      setState('ready');
    } catch (loadError) {
      if (loadError.name !== 'AbortError' && !signal?.aborted) {
        setError(loadError.message || 'Could not load the report.');
        setState('error');
      }
    }
  }, [vendorId, reportParams, page]);

  useEffect(() => {
    const controller = new AbortController();
    loadReport(controller.signal);
    return () => controller.abort();
  }, [loadReport, reloadKey]);

  function changeRange(nextRange) {
    if (nextRange === range) return;
    if (nextRange === 'custom' && !customFrom) setCustomFrom(todayInput());
    if (nextRange === 'custom' && !customTo) setCustomTo(todayInput());
    setRange(nextRange);
    setPage(1);
    setNotice('');
  }

  function selectLocation(locationId) {
    if (!locationId || locationId === selectedLocationRef.current) return;
    selectedLocationRef.current = locationId;
    setSelectedLocationId(locationId);
    setPage(1);
    setNotice('');
    setReloadKey((current) => current + 1);
  }

  async function downloadCsv() {
    if (exporting || !data) return;
    setExporting(true);
    setNotice('');
    try {
      const csv = await exportVendorReportCsv(vendorId, reportParams());
      if (typeof csv !== 'string' || !csv.trim()) throw new Error('The export returned no data.');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vendor-report-${range}-${todayInput()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice(`Exported ${number.format(data.report?.summary?.orders || 0)} orders. The export is recorded in the audit log.`);
    } catch (exportError) {
      setError(exportError.message || 'Could not export the report.');
    } finally {
      setExporting(false);
    }
  }

  const report = data?.report || EMPTY_REPORT;
  const summary = report.summary || EMPTY_REPORT.summary;
  const timezone = report.range?.timezone || 'Africa/Johannesburg';
  const maxRevenue = Math.max(1, ...report.revenueTrend.map((row) => row.revenue));
  const maxItems = Math.max(1, ...report.topItems.map((row) => row.revenue));
  const maxHours = Math.max(1, ...report.peakHours.map((row) => row.orders));
  const statusDonut = buildStatusSegments(report.statusBreakdown);
  const hoveredSegment = statusDonut.segments.find((segment) => segment.status === hoveredStatus) || null;
  const locationOptions = locations.map((location) => ({ id: location.id, name: location.label, available: true }));
  const selectedOption = locationOptions.find((option) => option.id === selectedLocationId) || null;

  return <div className="vendor-reports-page">
    <header className="vendor-reports-page__heading">
      <div>
        <p>Manager workspace</p>
        <h2>Reports</h2>
        <span>Live performance for {vendorName || 'your vendor'}, built from real orders and settlement data.</span>
      </div>
      <div className="vendor-reports-page__header-actions">
        <PrimaryButton size="sm" icon={IconRefresh} disabled={state === 'loading'} onClick={() => setReloadKey((current) => current + 1)}>Refresh</PrimaryButton>
        <PrimaryButton size="sm" icon={IconDownload} disabled={exporting || !data} onClick={downloadCsv}>{exporting ? 'Exporting…' : 'Export CSV'}</PrimaryButton>
        <PrimaryButton size="sm" icon={IconArrowLeft} onClick={onBack}>Back to dashboard</PrimaryButton>
      </div>
    </header>

    {notice && <p className="vendor-reports-page__notice" role="status">{notice}</p>}
    {error && <p className="vendor-reports-page__error" role="alert">{error}</p>}
    {data?.limits?.truncated && (
      <p className="vendor-reports-page__warning" role="status">
        This vendor exceeded the {number.format(data.limits.aggregateOrders)}-order aggregation limit for the range. Narrow the dates or a location for a complete report.
      </p>
    )}

    <section className="vendor-reports-page__card" aria-labelledby="vendor-reports-filters-title">
      <header className="vendor-reports-page__card-heading">
        <span className="vendor-reports-page__card-icon"><IconChartBar size={19} /></span>
        <div>
          <h3 id="vendor-reports-filters-title">Report period</h3>
          <p>Date boundaries are UTC; timestamps are shown in {timezone}.</p>
        </div>
      </header>
      <div className="vendor-reports-page__filters">
        <div className="vendor-reports-page__ranges" role="group" aria-label="Report range">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`vendor-reports-page__range${range === option.id ? ' is-active' : ''}`}
              aria-pressed={range === option.id}
              onClick={() => changeRange(option.id)}
            >{option.label}</button>
          ))}
        </div>
        {range === 'custom' && <div className="vendor-reports-page__dates">
          <label>From
            <input className="admin-input" type="date" value={customFrom} max={customTo || todayInput()} onChange={(event) => setCustomFrom(event.target.value)} />
          </label>
          <label>To
            <input className="admin-input" type="date" value={customTo} min={customFrom || undefined} max={todayInput()} onChange={(event) => setCustomTo(event.target.value)} />
          </label>
        </div>}
        <div className="vendor-reports-page__location">
          <span className="vendor-reports-page__label">Collection location</span>
          <CustomDropdown
            label=""
            ariaLabel="Report collection location"
            placeholder="All vendor locations"
            options={locationOptions}
            value={selectedOption}
            onChange={(option) => selectLocation(option.id)}
            disabled={state === 'loading' || !locationOptions.length}
            showAvailabilityStatus={false}
          />
        </div>
      </div>
    </section>

    {state === 'loading' && !data ? (
      <div className="vendor-reports-page__skeleton" role="status" aria-busy="true">
        <Skeleton /><Skeleton /><Skeleton /><Skeleton />
      </div>
    ) : state === 'error' && !data ? (
      <p className="vendor-reports-page__empty" role="alert">
        {error} <button type="button" onClick={() => setReloadKey((current) => current + 1)}>Retry</button>
      </p>
    ) : <>
      <div className="vendor-reports-page__kpis">
        <article><span><IconReceipt size={15} /> Revenue</span><strong>{money(summary.revenue)}</strong><small>net of refunds</small></article>
        <article><span><IconChartBar size={15} /> Orders</span><strong>{number.format(summary.orders)}</strong><small>{summary.completed} completed</small></article>
        <article><span><IconBuildingStore size={15} /> Average order</span><strong>{money(summary.avgOrder)}</strong><small>gross basket</small></article>
        <article><span><IconClock size={15} /> Fulfilment</span><strong>{summary.fulfilmentRate}%</strong><small>{summary.avgPrepMinutes == null ? 'No prep timings' : `${summary.avgPrepMinutes} min avg prep`}</small></article>
      </div>

      <div className="vendor-reports-page__grid">
        <section className="vendor-reports-page__card" aria-labelledby="vendor-reports-trend-title">
          <header className="vendor-reports-page__card-heading">
            <div>
              <h3 id="vendor-reports-trend-title">Revenue trend</h3>
              <p>Daily net revenue and order count for the selected period.</p>
            </div>
          </header>
          {!report.revenueTrend.length ? <p className="vendor-reports-page__empty">No activity in this period.</p> : (
            <div className="vendor-reports-page__bars">
              {report.revenueTrend.map((row) => (
                <div className="vendor-reports-page__bar-row" key={row.date}>
                  <span className="vendor-reports-page__bar-label">{formatDay(row.date)}</span>
                  <span className="vendor-reports-page__bar-track">
                    <span style={{ width: `${Math.max(2, (row.revenue / maxRevenue) * 100)}%` }} />
                  </span>
                  <strong>{money(row.revenue)}</strong>
                  <small>{row.orders} orders</small>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="vendor-reports-page__card vendor-reports-page__card--status" aria-labelledby="vendor-reports-status-title">
          <header className="vendor-reports-page__card-heading">
            <div>
              <h3 id="vendor-reports-status-title">Order status</h3>
              <p>Current lifecycle state of every order in the period.</p>
            </div>
          </header>
          {!statusDonut.segments.length ? <p className="vendor-reports-page__empty">No orders to summarise.</p> : (
            <div className="vendor-reports-page__donut-layout">
              <div className="vendor-reports-page__donut-wrap">
                <svg
                  className="vendor-reports-page__donut"
                  viewBox="0 0 120 120"
                  role="img"
                  aria-label={`Order status distribution for ${number.format(statusDonut.total)} orders`}
                >
                  {statusDonut.segments.map((segment) => (
                    <circle
                      key={segment.status}
                      className={`vendor-reports-page__donut-segment is-${statusTone(segment.status)}${hoveredStatus === segment.status ? ' is-hovered' : ''}`}
                      cx="60"
                      cy="60"
                      r="46"
                      fill="none"
                      strokeWidth="16"
                      strokeDasharray={segment.strokeDasharray}
                      strokeDashoffset={segment.strokeDashoffset}
                      transform="rotate(-90 60 60)"
                      tabIndex={0}
                      aria-label={`${formatStatus(segment.status)}: ${number.format(segment.count)} orders, ${formatStatusPercentage(segment.percentage)}`}
                      onMouseEnter={() => setHoveredStatus(segment.status)}
                      onMouseLeave={() => setHoveredStatus('')}
                      onFocus={() => setHoveredStatus(segment.status)}
                      onBlur={() => setHoveredStatus('')}
                    >
                      <title>{`${formatStatus(segment.status)}: ${number.format(segment.count)} orders (${formatStatusPercentage(segment.percentage)})`}</title>
                    </circle>
                  ))}
                </svg>
                <div className="vendor-reports-page__donut-center" aria-hidden="true">
                  <strong>{number.format(statusDonut.total)}</strong>
                  <span>orders</span>
                </div>
                {hoveredSegment && (
                  <div className="vendor-reports-page__donut-tooltip" role="tooltip">
                    <span>{formatStatus(hoveredSegment.status)}</span>
                    <strong>{number.format(hoveredSegment.count)} orders</strong>
                  </div>
                )}
              </div>

              <div className="vendor-reports-page__status-legend" aria-label="Order status legend">
                {statusDonut.segments.map((segment) => (
                  <div
                    className={`vendor-reports-page__legend-row${hoveredStatus === segment.status ? ' is-hovered' : ''}`}
                    key={segment.status}
                    onMouseEnter={() => setHoveredStatus(segment.status)}
                    onMouseLeave={() => setHoveredStatus('')}
                  >
                    <span className={`vendor-reports-page__legend-dot is-${statusTone(segment.status)}`} aria-hidden="true" />
                    <span className="vendor-reports-page__legend-name">{formatStatus(segment.status)}</span>
                    <strong>{number.format(segment.count)}</strong>
                    <small>{formatStatusPercentage(segment.percentage)}</small>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="vendor-reports-page__card" aria-labelledby="vendor-reports-items-title">
          <header className="vendor-reports-page__card-heading">
            <div>
              <h3 id="vendor-reports-items-title">Top items</h3>
              <p>Highest revenue lines from retained order snapshots.</p>
            </div>
          </header>
          {!report.topItems.length ? <p className="vendor-reports-page__empty">No item lines in this period.</p> : (
            <div className="vendor-reports-page__bars">
              {report.topItems.map((item) => (
                <div className="vendor-reports-page__bar-row" key={item.menuItemId || item.name}>
                  <span className="vendor-reports-page__bar-label">{item.name}</span>
                  <span className="vendor-reports-page__bar-track">
                    <span style={{ width: `${Math.max(2, (item.revenue / maxItems) * 100)}%` }} />
                  </span>
                  <strong>{money(item.revenue)}</strong>
                  <small>{item.quantity} sold</small>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="vendor-reports-page__card" aria-labelledby="vendor-reports-hours-title">
          <header className="vendor-reports-page__card-heading">
            <div>
              <h3 id="vendor-reports-hours-title">Busiest hours</h3>
              <p>Order creation by hour in {timezone}.</p>
            </div>
          </header>
          {!report.peakHours.length ? <p className="vendor-reports-page__empty">No hours to summarise.</p> : (
            <div className="vendor-reports-page__bars">
              {report.peakHours.slice(0, REPORT_PAGE_SIZE).map((row) => (
                <div className="vendor-reports-page__bar-row" key={row.hour}>
                  <span className="vendor-reports-page__bar-label">{row.hour}:00</span>
                  <span className="vendor-reports-page__bar-track">
                    <span style={{ width: `${Math.max(2, (row.orders / maxHours) * 100)}%` }} />
                  </span>
                  <strong>{number.format(row.orders)}</strong>
                  <small>orders</small>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="vendor-reports-page__card" aria-labelledby="vendor-reports-orders-title">
        <header className="vendor-reports-page__card-heading vendor-reports-page__card-heading--split">
          <div>
            <h3 id="vendor-reports-orders-title">Recent orders</h3>
            <p>One server-paginated page; the full list is never assembled in the browser.</p>
          </div>
        </header>
        {!data?.orders?.length ? <p className="vendor-reports-page__empty">No orders in the selected period.</p> : <>
          <div className="vendor-reports-page__table" role="table" aria-label="Recent vendor orders">
            <div className="vendor-reports-page__table-head" role="row">
              <span role="columnheader">Order</span>
              <span role="columnheader">Customer</span>
              <span role="columnheader">Placed</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Total</span>
            </div>
            {data.orders.map((order) => (
              <div className="vendor-reports-page__table-row" key={order.id} role="row">
                <span role="cell"><strong>{order.orderReference}</strong><small title={order.locationLabel}>{order.locationLabel}</small></span>
                <span role="cell">{order.customer}</span>
                <span role="cell">{formatDateTime(order.createdAt, timezone)}</span>
                <span role="cell">
                  <span className={`vendor-reports-page__badge is-${statusTone(order.status)}`} title={formatStatus(order.status)}>{formatStatus(order.status)}</span>
                </span>
                <span role="cell"><strong>{money(order.total)}</strong><small>{order.currency}</small></span>
              </div>
            ))}
          </div>
          <div className="vendor-reports-page__pagination">
            <Pagination
              currentPage={data.pagination?.page || 1}
              totalPages={data.pagination?.totalPages || 1}
              totalItems={data.pagination?.total || 0}
              itemsPerPage={data.pagination?.limit || PAGE_SIZE}
              label="orders"
              onPageChange={setPage}
            />
          </div>
        </>}
      </section>
    </>}

    <p className="vendor-reports-page__footnote">
      <IconInfoCircle size={15} /> Figures come from orders, item snapshots, status history, and settled refunds. No admin mock data is used. Export is manager-only and recorded in the audit log.
    </p>
  </div>;
}
