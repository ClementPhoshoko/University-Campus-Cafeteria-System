import crypto from 'node:crypto';

export const VENDOR_ORDER_TRANSITIONS = {
  payment_confirmed: ['received_by_vendor'],
  received_by_vendor: ['accepted', 'rejected'],
  accepted: ['preparing', 'rejected'],
  preparing: ['ready_for_collection'],
  ready_for_collection: ['collected'],
};

export const VENDOR_ORDER_STATUSES = [
  ...new Set(Object.values(VENDOR_ORDER_TRANSITIONS).flat()),
];

export function isValidVendorOrderTransition(currentStatus, nextStatus) {
  return VENDOR_ORDER_TRANSITIONS[currentStatus]?.includes(nextStatus) || false;
}

export function validateRejectionReason(value) {
  if (typeof value !== 'string') return { error: 'A reason is required when rejecting an order' };
  const reason = value.trim();
  if (!reason) return { error: 'A reason is required when rejecting an order' };
  if (reason.length > 500) return { error: 'The rejection reason must be 500 characters or fewer' };
  return { value: reason };
}

export function isValidCollectionCode(value) {
  return typeof value === 'string' && /^[A-Z0-9]{4}$/.test(value.trim().toUpperCase());
}

export function collectionCodeMatches(value, expectedHash) {
  if (!isValidCollectionCode(value)) return false;
  const normalized = value.trim().toUpperCase();
  const submitted = crypto.createHash('sha256').update(normalized).digest();
  let expected;
  try {
    expected = Buffer.from(expectedHash || '', 'hex');
  } catch {
    return false;
  }
  return expected.length === submitted.length && crypto.timingSafeEqual(expected, submitted);
}
