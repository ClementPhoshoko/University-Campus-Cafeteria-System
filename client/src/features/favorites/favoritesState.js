export const VENDOR_FAVORITE = 'vendor';
export const MENU_ITEM_FAVORITE = 'menu-item';

export function favoriteKey(kind, id) {
  return `${kind}:${String(id)}`;
}

export function nextFavoriteSet(current, id, favorited) {
  const next = new Set(current || []);
  const key = String(id);
  if (favorited) next.add(key);
  else next.delete(key);
  return next;
}

export function isFavoriteId(current, id) {
  return Boolean(current && current.has(String(id)));
}

export function nextPendingSet(current, key, pending) {
  const next = new Set(current || []);
  if (pending) next.add(key);
  else next.delete(key);
  return next;
}

export function readFavoriteResult(result) {
  if (typeof result?.favorited !== 'boolean') {
    throw new Error('Favourite update was not confirmed');
  }
  return result.favorited;
}
