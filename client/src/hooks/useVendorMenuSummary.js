import { useCallback, useEffect, useState } from 'react';

import { getVendorMenuSummary } from '../services/vendorApi.js';

const EMPTY_COUNTS = { active_categories: 0, active_menu_items: 0 };

export function useVendorMenuSummary(vendorId, { token } = {}) {
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [loading, setLoading] = useState(Boolean(vendorId && token));
  const [error, setError] = useState('');

  const refresh = useCallback(async (signal) => {
    if (!vendorId || !token) {
      setCounts(EMPTY_COUNTS);
      setLoading(false);
      return EMPTY_COUNTS;
    }

    setLoading(true);
    setError('');

    try {
      const response = await getVendorMenuSummary(vendorId, { token, signal });
      if (signal?.aborted) return EMPTY_COUNTS;
      const nextCounts = response?.counts || EMPTY_COUNTS;
      setCounts(nextCounts);
      return nextCounts;
    } catch (err) {
      if (signal?.aborted || err.name === 'AbortError') return EMPTY_COUNTS;
      setError(err.message || 'Could not load menu summary.');
      return EMPTY_COUNTS;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [token, vendorId]);

  useEffect(() => {
    if (!vendorId || !token) {
      setCounts(EMPTY_COUNTS);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh, token, vendorId]);

  return { counts, loading, error, refresh };
}