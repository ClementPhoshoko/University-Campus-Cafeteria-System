export const NOTIFICATION_LIMIT = 20;

const LEVELS = ['none', 'info', 'warning', 'alert'];

// Singular values exactly as emitted by the notification backend.
const CATEGORY_LABELS = {
  order: 'Order',
  payment: 'Payment',
  cart: 'Cart',
  vendor: 'Vendor',
  promotion: 'Promotion',
  account: 'Account',
  system: 'System',
};

export function normalizeLevel(level, unreadCount = 0) {
  if (!unreadCount) return 'none';
  return LEVELS.includes(level) && level !== 'none' ? level : 'info';
}

export function categoryLabel(category) {
  if (typeof category !== 'string' || !category) return 'Notification';
  if (CATEGORY_LABELS[category]) return CATEGORY_LABELS[category];
  return category.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function notificationTimestamp(notification) {
  const value = notification?.sentAt || notification?.createdAt;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export function formatRelativeTime(value, now = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

export function formatFullDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function previewText(body, max = 140) {
  const text = typeof body === 'string' ? body.replace(/\s+/g, ' ').trim() : '';
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

/** Remove internal ids from any user-facing string before it is rendered. */
export function stripSensitiveText(value, context = {}) {
  let text = typeof value === 'string' ? value : '';
  for (const key of ['orderId', 'vendorId', 'cartId', 'userId']) {
    const id = context?.[key];
    if (typeof id === 'string' && id) text = text.split(id).join('');
  }
  return text.replace(UUID_PATTERN, '').replace(/\s+/g, ' ').trim();
}

/** Only same-origin path-like destinations may be used as action links. */
export function isInternalActionPath(value) {
  if (typeof value !== 'string') return false;
  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return false;
  return !/[\u0000-\u001F\u007F]/.test(path);
}

function formatMetadataValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

// Backend metadata is { category, level, actionPath, context }. Category and
// level already have dedicated UI, and actionPath drives the action button.
const IGNORED_METADATA_KEYS = new Set(['category', 'level', 'actionPath', 'actionLabel', 'context']);
const SENSITIVE_METADATA_KEYS = new Set([
  'orderId', 'vendorId', 'cartId', 'userId', 'collectionCode', 'accessToken',
]);

function pushMetadataEntries(source, entries, prefix = '') {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return;
  Object.entries(source).forEach(([key, value]) => {
    if (IGNORED_METADATA_KEYS.has(key) || SENSITIVE_METADATA_KEYS.has(key)) return;
    if (/(Id|Hash|Code|Token)$/.test(key)) return;
    const formatted = formatMetadataValue(value);
    if (!formatted) return;
    const label = key
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    entries.push({ key: `${prefix}${key}`, label, value: formatted });
  });
}

export function metadataEntries(notification) {
  const raw = notification?.metadata;
  const entries = [];

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    pushMetadataEntries(raw, entries);
    pushMetadataEntries(raw.context, entries, 'context:');
  }

  return entries;
}
