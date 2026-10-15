export function isMockPaymentEnabled() {
  return process.env.PAYMENT_MODE === 'mock' && process.env.NODE_ENV !== 'production';
}
