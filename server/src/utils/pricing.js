export function resolveUnitPrice(priceSnapshot, currentBasePrice) {
  const snapshot = priceSnapshot === null || priceSnapshot === undefined || priceSnapshot === ''
    ? NaN
    : Number(priceSnapshot);
  if (Number.isFinite(snapshot) && snapshot >= 0) return snapshot;

  const currentPrice = currentBasePrice === null || currentBasePrice === undefined || currentBasePrice === ''
    ? NaN
    : Number(currentBasePrice);
  if (Number.isFinite(currentPrice) && currentPrice >= 0) return currentPrice;

  throw new Error('Cart item has no valid unit price snapshot or current menu price');
}
