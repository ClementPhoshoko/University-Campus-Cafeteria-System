export const LOW_STOCK_THRESHOLD = 3;

function toOrderableQuantity(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function availabilityResult({ label, tone, badge, blocked, tracked, orderableQuantity, maxQuantity }) {
  return { label, tone, badge, blocked, tracked, orderableQuantity, maxQuantity };
}

export function getAvailability({ status, inventory } = {}) {
  const tracked = inventory?.tracking_enabled === true;
  const orderableQuantity = toOrderableQuantity(inventory?.orderable_quantity);
  const maxQuantity = tracked ? Math.max(1, Math.min(10, orderableQuantity)) : 10;

  if (status === 'sold_out') {
    return availabilityResult({
      label: 'Sold out',
      tone: 'error',
      badge: true,
      blocked: true,
      tracked,
      orderableQuantity,
      maxQuantity: 1,
    });
  }

  if (status === 'unavailable') {
    return availabilityResult({
      label: 'Unavailable',
      tone: 'muted',
      badge: true,
      blocked: true,
      tracked,
      orderableQuantity,
      maxQuantity: 1,
    });
  }

  if (tracked && orderableQuantity <= 0) {
    return availabilityResult({
      label: 'Out of stock here',
      tone: 'error',
      badge: true,
      blocked: true,
      tracked,
      orderableQuantity,
      maxQuantity: 1,
    });
  }

  if (tracked && orderableQuantity <= LOW_STOCK_THRESHOLD) {
    return availabilityResult({
      label: `Only ${orderableQuantity} left`,
      tone: 'warning',
      badge: true,
      blocked: false,
      tracked,
      orderableQuantity,
      maxQuantity,
    });
  }

  if (status === 'limited') {
    return availabilityResult({
      label: 'Limited',
      tone: 'warning',
      badge: true,
      blocked: false,
      tracked,
      orderableQuantity,
      maxQuantity,
    });
  }

  return availabilityResult({
    label: '',
    tone: 'default',
    badge: false,
    blocked: false,
    tracked,
    orderableQuantity,
    maxQuantity,
  });
}

export function availabilityMessage(inventory, locationLabel = 'location') {
  if (inventory?.tracking_enabled !== true) return '';
  const orderableQuantity = toOrderableQuantity(inventory?.orderable_quantity);
  return orderableQuantity > 0
    ? `${orderableQuantity} available at this ${locationLabel}`
    : `Currently out of stock at this ${locationLabel}`;
}
