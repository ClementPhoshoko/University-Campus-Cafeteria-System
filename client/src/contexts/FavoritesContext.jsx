import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '../hooks/useAuth.js';
import {
  getFavoriteState,
  toggleFavoriteMenuItem,
  toggleFavoriteVendor,
} from '../services/employeeApi.js';
import {
  favoriteKey,
  isFavoriteId,
  MENU_ITEM_FAVORITE,
  nextFavoriteSet,
  nextPendingSet,
  readFavoriteResult,
  VENDOR_FAVORITE,
} from '../features/favorites/favoritesState.js';

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const { session } = useAuth();
  const token = session?.access_token || null;

  const [vendorIds, setVendorIds] = useState(() => new Set());
  const [menuItemIds, setMenuItemIds] = useState(() => new Set());
  const [pending, setPending] = useState(() => new Set());
  const [status, setStatus] = useState(token ? 'loading' : 'idle');
  const [error, setError] = useState(null);

  const vendorIdsRef = useRef(vendorIds);
  const menuItemIdsRef = useRef(menuItemIds);
  const pendingRef = useRef(pending);
  const requestRef = useRef(0);

  const commitVendorIds = useCallback((value) => {
    setVendorIds((previous) => {
      const next = typeof value === 'function' ? value(previous) : value;
      vendorIdsRef.current = next;
      return next;
    });
  }, []);

  const commitMenuItemIds = useCallback((value) => {
    setMenuItemIds((previous) => {
      const next = typeof value === 'function' ? value(previous) : value;
      menuItemIdsRef.current = next;
      return next;
    });
  }, []);

  const commitPending = useCallback((value) => {
    setPending((previous) => {
      const next = typeof value === 'function' ? value(previous) : value;
      pendingRef.current = next;
      return next;
    });
  }, []);

  const beginPending = useCallback((key) => {
    if (pendingRef.current.has(key)) return false;
    commitPending((previous) => nextPendingSet(previous, key, true));
    return true;
  }, [commitPending]);

  const endPending = useCallback((key) => {
    commitPending((previous) => nextPendingSet(previous, key, false));
  }, [commitPending]);

  const load = useCallback(async ({ signal } = {}) => {
    if (!token) {
      requestRef.current += 1;
      commitVendorIds(new Set());
      commitMenuItemIds(new Set());
      setStatus('idle');
      setError(null);
      return null;
    }

    const requestId = ++requestRef.current;
    setStatus('loading');
    setError(null);

    try {
      const payload = await getFavoriteState({ token, signal });
      if (requestId !== requestRef.current) return payload;

      commitVendorIds(new Set(payload?.vendorIds || []));
      commitMenuItemIds(new Set(payload?.menuItemIds || []));
      setStatus('ready');
      return payload;
    } catch (err) {
      if (signal?.aborted || err?.name === 'AbortError' || requestId !== requestRef.current) return null;

      commitVendorIds(new Set());
      commitMenuItemIds(new Set());
      setStatus('error');
      setError(err);
      return null;
    }
  }, [token, commitVendorIds, commitMenuItemIds]);

  useEffect(() => {
    const controller = new AbortController();
    if (!token) {
      requestRef.current += 1;
      commitVendorIds(new Set());
      commitMenuItemIds(new Set());
      setStatus('idle');
      setError(null);
      return undefined;
    }

    load({ signal: controller.signal });
    return () => controller.abort();
  }, [token, load, commitVendorIds, commitMenuItemIds]);

  const toggleVendor = useCallback(async (vendorId) => {
    if (!token || !vendorId) return null;
    const key = favoriteKey(VENDOR_FAVORITE, vendorId);
    if (!beginPending(key)) return null;

    const previous = isFavoriteId(vendorIdsRef.current, vendorId);
    commitVendorIds((current) => nextFavoriteSet(current, vendorId, !previous));

    try {
      const result = await toggleFavoriteVendor(vendorId, { token });
      const favorited = readFavoriteResult(result);
      commitVendorIds((current) => nextFavoriteSet(current, vendorId, favorited));
      setStatus('ready');
      return result;
    } catch (err) {
      commitVendorIds((current) => nextFavoriteSet(current, vendorId, previous));
      setError(err);
      throw err;
    } finally {
      endPending(key);
    }
  }, [token, beginPending, endPending, commitVendorIds]);

  const toggleMenuItem = useCallback(async (menuItemId) => {
    if (!token || !menuItemId) return null;
    const key = favoriteKey(MENU_ITEM_FAVORITE, menuItemId);
    if (!beginPending(key)) return null;

    const previous = isFavoriteId(menuItemIdsRef.current, menuItemId);
    commitMenuItemIds((current) => nextFavoriteSet(current, menuItemId, !previous));

    try {
      const result = await toggleFavoriteMenuItem(menuItemId, { token });
      const favorited = readFavoriteResult(result);
      commitMenuItemIds((current) => nextFavoriteSet(current, menuItemId, favorited));
      setStatus('ready');
      return result;
    } catch (err) {
      commitMenuItemIds((current) => nextFavoriteSet(current, menuItemId, previous));
      setError(err);
      throw err;
    } finally {
      endPending(key);
    }
  }, [token, beginPending, endPending, commitMenuItemIds]);

  const value = useMemo(() => ({
    authenticated: Boolean(token),
    status,
    error,
    refresh: load,
    isFavoriteVendor: (id) => isFavoriteId(vendorIds, id),
    isFavoriteMenuItem: (id) => isFavoriteId(menuItemIds, id),
    isPendingVendor: (id) => pending.has(favoriteKey(VENDOR_FAVORITE, id)),
    isPendingMenuItem: (id) => pending.has(favoriteKey(MENU_ITEM_FAVORITE, id)),
    toggleVendor,
    toggleMenuItem,
  }), [token, status, error, load, vendorIds, menuItemIds, pending, toggleVendor, toggleMenuItem]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites must be used within FavoritesProvider');
  return context;
}
