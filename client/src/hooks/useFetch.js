import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Simple in-memory cache shared across all useFetch instances.
 * Key: cacheKey string, Value: { data, timestamp }
 */
const cache = new Map();
const inflight = new Map();

const STALE_MS = 30_000;

export function useFetch(fetchFn, {
  cacheKey,
  enabled = true,
  staleTime = STALE_MS,
  transform,
}) {
  const [data, setData] = useState(() => {
    if (cacheKey && cache.has(cacheKey)) {
      return cache.get(cacheKey).data;
    }
    return null;
  });
  const [state, setState] = useState(data ? 'idle' : 'loading');
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const execute = useCallback(async (overrideSignal) => {
    if (!enabled) return;

    const controller = new AbortController();
    abortRef.current = controller;

    const cached = cacheKey ? cache.get(cacheKey) : null;
    const isStale = !cached || (Date.now() - cached.timestamp > staleTime);

    if (cached && !isStale) {
      setData(cached.data);
      setState('idle');
      setError(null);
      return cached.data;
    }

    if (cached && isStale) {
      setData(cached.data);
      setState('refreshing');
    } else {
      setState('loading');
    }

    try {
      const result = await fetchFn({ signal: controller.signal });
      const transformed = transform ? transform(result) : result;

      if (!mountedRef.current) return transformed;

      if (cacheKey) {
        cache.set(cacheKey, { data: transformed, timestamp: Date.now() });
      }

      setData(transformed);
      setState('idle');
      setError(null);
      return transformed;
    } catch (err) {
      if (err?.name === 'AbortError') return data;

      if (!mountedRef.current) return;
      setState('error');
      setError(err);
      return undefined;
    } finally {
      abortRef.current = null;
    }
  }, [fetchFn, cacheKey, enabled, staleTime, transform]);

  useEffect(() => {
    if (!enabled) return;
    execute();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [execute, enabled]);

  const invalidate = useCallback(() => {
    if (cacheKey) cache.delete(cacheKey);
    execute();
  }, [cacheKey, execute]);

  const mutate = useCallback((updater) => {
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (cacheKey) {
        cache.set(cacheKey, { data: next, timestamp: Date.now() });
      }
      return next;
    });
  }, [cacheKey]);

  return {
    data,
    state,
    isLoading: state === 'loading',
    isRefreshing: state === 'refreshing',
    isIdle: state === 'idle',
    isError: state === 'error',
    error,
    refetch: execute,
    invalidate,
    mutate,
  };
}

export function clearCache(pattern) {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
}
