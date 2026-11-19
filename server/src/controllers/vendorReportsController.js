import { supabaseAdmin } from '../config/supabase.js';
import { writeAudit } from '../utils/audit.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { respond } from '../utils/http.js';
import { buildPagination, parsePagination } from '../utils/pagination.js';
import { isUuid } from '../validators/vendorValidators.js';
import { formatVendorLocationLabel } from './vendorInventoryController.js';

const db = () => supabaseAdmin;

// Bounded aggregation keeps a single report request predictable. The API
// reports `truncated` when a vendor exceeds this many orders in a range.
export const MAX_REPORT_ORDERS = 5000;
export const MAX_EXPORT_ORDERS = 5000;
const CHUNK_SIZE = 200;
const DEFAULT_TIMEZONE = 'Africa/Johannesburg';

export const REPORT_RANGES = {
  '7d': { label: 'Last 7 days', days: 7 },
  '30d': { label: 'Last 30 days', days: 30 },
  '90d': { label: 'Last 90 days', days: 90 },
  ytd: { label: 'Year to date' },
  custom: { label: 'Custom range' },
};

const REPORT_ORDER_SELECT = 'id, order_reference, status, payment_status, order_type, total, currency, created_at, vendor_location_id';
const PAGE_ORDER_SELECT = `${REPORT_ORDER_SELECT}, collected_at, collection_points(name), profiles!orders_user_id_fkey(full_name), collection_slots(starts_at)`;

export function handleReportError(res, error) {
  if (error instanceof ApiError) return sendError(res, error.status, error.code, error.message);
  const message = String(error?.message || '');
  const reportErrors = {
    VENDOR_MANAGER_REQUIRED: [403, 'VENDOR_MANAGER_REQUIRED', 'Only a vendor manager can view or export reports.'],
    VENDOR_LOCATION_NOT_FOUND: [404, 'VENDOR_LOCATION_NOT_FOUND', 'This active vendor location was not found.'],
    INVALID_REPORT_RANGE: [400, 'INVALID_REPORT_RANGE', 'Choose a valid report range. Custom ranges cannot exceed 366 days.'],
  };
  for (const [code, [status, errorCode, text]] of Object.entries(reportErrors)) {
    if (message.includes(code)) return sendError(res, status, errorCode, text);
  }
  if (error?.code) {
    const mapped = mapDbError(error);
    if (mapped) return sendError(res, mapped.status, mapped.code, mapped.message);
  }
  return sendInternalError(res, error);
}

async function requireManager(userId, vendorId) {
  const { data, error } = await db().from('vendor_users')
    .select('role').eq('vendor_id', vendorId).eq('user_id', userId).eq('is_active', true).maybeSingle();
  if (error) throw error;
  if (data?.role !== 'manager') {
    throw new ApiError(403, 'VENDOR_MANAGER_REQUIRED', 'Only a vendor manager can view or export reports.');
  }
}

function relatedName(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parseBoundary(value, { end = false } = {}) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const input = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const date = new Date(`${input}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return null;
    if (end) date.setUTCDate(date.getUTCDate() + 1);
    return date;
  }
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Resolves inclusive-start/exclusive-end UTC boundaries. Trend buckets use the
 * same UTC days; only displayed timestamps use the location timezone.
 */
export function resolveReportRange(query = {}, now = new Date()) {
  const key = String(query.range || '30d');
  const config = REPORT_RANGES[key];
  if (!config) throw new ApiError(400, 'INVALID_REPORT_RANGE', 'Unknown report range.');

  const endOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  let to;
  let from;
  if (key === 'custom') {
    to = parseBoundary(query.to, { end: true });
    from = parseBoundary(query.from);
    if (!from || !to || to.getTime() <= from.getTime()) {
      throw new ApiError(400, 'INVALID_REPORT_RANGE', 'Enter a valid custom start and end date.');
    }
  } else if (key === 'ytd') {
    to = new Date(endOfToday);
    from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  } else {
    to = new Date(endOfToday);
    from = new Date(endOfToday - config.days * 24 * 60 * 60 * 1000);
  }
  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new ApiError(400, 'INVALID_REPORT_RANGE', 'A report range cannot exceed 366 days.');
  }

  return {
    key,
    label: config.label,
    from: from.toISOString(),
    to: to.toISOString(),
    timezone: DEFAULT_TIMEZONE,
  };
}

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function utcDay(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function localHour(value, timezone) {
  try {
    return new Intl.DateTimeFormat('en-ZA', {
      timeZone: timezone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value));
  } catch {
    return new Date(value).toISOString().slice(11, 13);
  }
}

function addDay(day, days) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function enumerateDays(from, to) {
  const days = [];
  const first = utcDay(from);
  const last = utcDay(to);
  for (let day = first; day < last && days.length < 400; day = addDay(day, 1)) days.push(day);
  return days;
}

/** Pure aggregation so report math can be tested without a database. */
export function shapeVendorReport({ orders = [], items = [], history = [], refunds = [], locations = [], range }) {
  const timezone = range?.timezone || DEFAULT_TIMEZONE;
  const activeOrders = orders.filter((order) => !['cancelled', 'rejected'].includes(order.status));
  const refundsByOrder = new Map();
  for (const refund of refunds) {
    if (refund.status !== 'succeeded') continue;
    refundsByOrder.set(refund.order_id, (refundsByOrder.get(refund.order_id) || 0) + Number(refund.amount || 0));
  }

  const preparingAt = new Map();
  const prepMinutes = [];
  for (const entry of history) {
    const changedAt = new Date(entry.changed_at).getTime();
    if (entry.new_status === 'preparing' && Number.isFinite(changedAt)) {
      preparingAt.set(entry.order_id, changedAt);
    }
    if (entry.new_status === 'ready_for_collection' && Number.isFinite(changedAt)) {
      const started = preparingAt.get(entry.order_id);
      if (started != null && changedAt >= started) prepMinutes.push((changedAt - started) / 60000);
    }
  }

  const activeIds = new Set(activeOrders.map((order) => order.id));
  const grossRevenue = money(activeOrders.reduce((sum, order) => sum + Number(order.total || 0), 0));
  const refunded = money([...refundsByOrder.values()].reduce((sum, value) => sum + value, 0));
  const completed = orders.filter((order) => ['collected', 'completed', 'delivered'].includes(order.status)).length;
  const cancelled = orders.filter((order) => order.status === 'cancelled').length;
  const rejected = orders.filter((order) => order.status === 'rejected').length;

  const trendMap = new Map();
  const statusMap = new Map();
  const hourMap = new Map();
  const locationMap = new Map();
  for (const order of orders) {
    const day = utcDay(order.created_at);
    const recognized = activeIds.has(order.id)
      ? Math.max(0, Number(order.total || 0) - (refundsByOrder.get(order.id) || 0))
      : 0;
    const bucket = trendMap.get(day) || { date: day, revenue: 0, orders: 0 };
    bucket.orders += 1;
    bucket.revenue += recognized;
    trendMap.set(day, bucket);

    statusMap.set(order.status, (statusMap.get(order.status) || 0) + 1);
    const hour = localHour(order.created_at, timezone);
    hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    const location = locationMap.get(order.vendor_location_id) || {
      id: order.vendor_location_id,
      label: formatVendorLocationLabel(locations.find((row) => row.id === order.vendor_location_id)),
      orders: 0,
      revenue: 0,
    };
    location.orders += 1;
    location.revenue += recognized;
    locationMap.set(order.vendor_location_id, location);
  }

  const days = enumerateDays(range?.from, range?.to);
  const revenueTrend = (days.length ? days : [...trendMap.keys()].sort()).map((day) => {
    const bucket = trendMap.get(day) || { date: day, revenue: 0, orders: 0 };
    return { date: day, revenue: money(bucket.revenue), orders: bucket.orders };
  });

  const itemMap = new Map();
  for (const item of items) {
    const key = item.menu_item_id || `snapshot:${item.item_name_snapshot}`;
    const row = itemMap.get(key) || {
      menuItemId: item.menu_item_id || null,
      name: item.item_name_snapshot || 'Menu item',
      quantity: 0,
      revenue: 0,
    };
    row.quantity += Number(item.quantity || 0);
    row.revenue += Number(item.line_total || 0);
    itemMap.set(key, row);
  }

  return {
    range: range || null,
    summary: {
      revenue: money(grossRevenue - refunded),
      grossRevenue,
      refunded,
      orders: orders.length,
      avgOrder: orders.length ? money(grossRevenue / orders.length) : 0,
      completed,
      cancelled,
      rejected,
      fulfilmentRate: orders.length ? Math.round((completed / orders.length) * 1000) / 10 : 0,
      statusChanges: history.length,
      avgPrepMinutes: prepMinutes.length
        ? Math.round((prepMinutes.reduce((sum, value) => sum + value, 0) / prepMinutes.length) * 10) / 10
        : null,
    },
    revenueTrend,
    statusBreakdown: [...statusMap.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    topItems: [...itemMap.values()]
      .map((item) => ({ ...item, revenue: money(item.revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8),
    peakHours: [...hourMap.entries()]
      .map(([hour, count]) => ({ hour, orders: count }))
      .sort((a, b) => Number(a.hour) - Number(b.hour)),
    locations: [...locationMap.values()]
      .map((location) => ({ ...location, revenue: money(location.revenue) }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}

export function shapeVendorReportOrders(rows = [], locations = []) {
  return rows.map((order) => ({
    id: order.id,
    orderReference: order.order_reference,
    status: order.status,
    paymentStatus: order.payment_status,
    orderType: order.order_type,
    total: money(order.total),
    currency: order.currency || 'ZAR',
    createdAt: order.created_at,
    collectedAt: order.collected_at || null,
    collectionTime: relatedName(order.collection_slots)?.starts_at || null,
    collectionPoint: relatedName(order.collection_points)?.name || null,
    customer: relatedName(order.profiles)?.full_name || 'Employee',
    locationLabel: formatVendorLocationLabel(locations.find((row) => row.id === order.vendor_location_id)),
  }));
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Export rows are built on the server and streamed as UTF-8 CSV. */
export function buildReportCsv(orders = [], locations = []) {
  const header = ['Order reference', 'Created at (UTC)', 'Status', 'Payment status', 'Type', 'Location', 'Total', 'Currency'];
  const lines = orders.map((order) => [
    order.order_reference,
    order.created_at,
    order.status,
    order.payment_status,
    order.order_type,
    formatVendorLocationLabel(locations.find((row) => row.id === order.vendor_location_id)),
    money(order.total),
    order.currency || 'ZAR',
  ].map(csvCell).join(','));
  return `\uFEFF${[header.join(','), ...lines].join('\r\n')}\r\n`;
}

async function selectInChunks(table, select, column, ids) {
  const rows = [];
  for (let index = 0; index < ids.length; index += CHUNK_SIZE) {
    const { data, error } = await db().from(table).select(select).in(column, ids.slice(index, index + CHUNK_SIZE));
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

async function loadReportContext(vendorId, locationId) {
  const { data, error } = await db().from('vendor_locations')
    .select('id, site_id, sites(name, timezone), buildings(name), collection_points(name)')
    .eq('vendor_id', vendorId).eq('is_active', true).order('id');
  if (error) throw error;
  const locations = data || [];
  const selected = locationId ? locations.find((location) => location.id === locationId) : null;
  if (locationId && !selected) throw new ApiError(404, 'VENDOR_LOCATION_NOT_FOUND', 'This active vendor location was not found.');
  return { locations, selected };
}

async function loadOrders(vendorId, locationId, range, { page, limit, from, to }) {
  const applyFilters = (query) => {
    let filtered = query.eq('vendor_id', vendorId).gte('created_at', range.from).lt('created_at', range.to);
    if (locationId) filtered = filtered.eq('vendor_location_id', locationId);
    return filtered;
  };

  const [aggregateResult, pageResult] = await Promise.all([
    applyFilters(db().from('orders').select(REPORT_ORDER_SELECT))
      .order('created_at', { ascending: false }).limit(MAX_REPORT_ORDERS + 1),
    applyFilters(db().from('orders').select(PAGE_ORDER_SELECT, { count: 'exact' }))
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to),
  ]);
  if (aggregateResult.error) throw aggregateResult.error;
  if (pageResult.error) throw pageResult.error;

  const allRows = aggregateResult.data || [];
  return {
    allOrders: allRows.slice(0, MAX_REPORT_ORDERS),
    truncated: allRows.length > MAX_REPORT_ORDERS,
    pageRows: pageResult.data || [],
    total: Number(pageResult.count ?? 0),
    pagination: buildPagination(pageResult.count ?? 0, page, limit),
  };
}

export async function getMyVendorReport(req, res) {
  try {
    const vendorId = String(req.query.vendor_id || '');
    const locationId = String(req.query.vendor_location_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id is required');
    if (locationId && !isUuid(locationId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid vendor location id');
    await requireManager(req.user.id, vendorId);

    const { locations, selected } = await loadReportContext(vendorId, locationId);
    const timezone = relatedName(selected?.sites)?.timezone
      || relatedName(locations[0]?.sites)?.timezone
      || DEFAULT_TIMEZONE;
    const range = { ...resolveReportRange(req.query, new Date()), timezone };
    const { pageNum, limitNum, from, to } = parsePagination(req.query, { maxLimit: 50, defaultLimit: 5 });
    const loaded = await loadOrders(vendorId, locationId, range, { page: pageNum, limit: limitNum, from, to });
    const orderIds = loaded.allOrders.map((order) => order.id);

    const [items, history, refunds] = await Promise.all([
      selectInChunks('order_items', 'order_id, menu_item_id, item_name_snapshot, quantity, line_total', 'order_id', orderIds),
      selectInChunks('order_status_history', 'order_id, previous_status, new_status, changed_at', 'order_id', orderIds),
      orderIds.length
        ? selectInChunks('refunds', 'order_id, amount, status', 'order_id', orderIds)
        : [],
    ]);

    return respond(req, res, {
      success: true,
      report: shapeVendorReport({
        orders: loaded.allOrders,
        items,
        history,
        refunds,
        locations,
        range,
      }),
      locations: locations.map((location) => ({ id: location.id, label: formatVendorLocationLabel(location) })),
      selectedLocationId: selected?.id || '',
      orders: shapeVendorReportOrders(loaded.pageRows, locations),
      pagination: loaded.pagination,
      limits: { aggregateOrders: loaded.allOrders.length, truncated: loaded.truncated },
    }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleReportError(res, error); }
}

export async function exportMyVendorReport(req, res) {
  try {
    const vendorId = String(req.query.vendor_id || '');
    const locationId = String(req.query.vendor_location_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id is required');
    if (locationId && !isUuid(locationId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid vendor location id');
    await requireManager(req.user.id, vendorId);

    const { locations, selected } = await loadReportContext(vendorId, locationId);
    const range = resolveReportRange(req.query, new Date());
    const { allOrders, truncated } = await loadOrders(vendorId, locationId, range, {
      page: 1, limit: 1, from: 0, to: 0,
    });
    const orders = allOrders.slice(0, MAX_EXPORT_ORDERS);
    const csv = buildReportCsv(orders, locations);

    await writeAudit(req, {
      action: 'EXPORT',
      tableName: 'public.orders',
      recordKey: vendorId,
      reason: `Vendor report export (${range.key}, ${orders.length} orders)`,
      category: 'data',
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="vendor-report-${range.key}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Report-Truncated', truncated || allOrders.length > MAX_EXPORT_ORDERS ? 'true' : 'false');
    return res.status(200).send(csv);
  } catch (error) { return handleReportError(res, error); }
}
