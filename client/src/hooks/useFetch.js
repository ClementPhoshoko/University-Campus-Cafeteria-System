import { useCallback, useEffect, useRef, useState } from 'react';
import { getCache, setCache, invalidateCache, invalidateCachePattern } from '../services/cache.js';

const STALE_MS = 30_000;

export function useFetch(fetchFn, {
  cacheKey,
  enabled = true,
  staleTime = STALE_MS,
  transform,
}) {
  const resolvedCacheKey = cacheKey || null;

  const [data, setData] = useState(() => {
    if (resolvedCacheKey) {
      const cached = getCache(resolvedCacheKey);
      if (cached) return cached.data;
    }
    return null;
  });
  const [state, setState] = useState(data ? 'idle' : 'loading');
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);
  const currentRequestId = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const execute = useCallback(async (overrideSignal) => {
    if (!enabled) return;
    const cached = resolvedCacheKey ? getCache(resolvedCacheKey) : null;

    if (cached && !cached.isStale) {
      if (mountedRef.current) {
        setData(cached.data);
        setState('idle');
        setError(null);
      }
      return cached.data;
    }

    if (abortRef.current) return;

    const requestId = ++currentRequestId.current;
    const controller = new AbortController();
    abortRef.current = controller;

    if (cached && cached.isStale) {
      if (mountedRef.current) {
        setData(cached.data);
        setState('refreshing');
      }
    } else {
      if (mountedRef.current) setState('loading');
    }

    try {
      const signal = overrideSignal || controller.signal;
      const result = await fetchFn({ signal });
      const transformed = transform ? transform(result) : result;

      if (!mountedRef.current || requestId !== currentRequestId.current) return transformed;

      if (resolvedCacheKey) {
        setCache(resolvedCacheKey, transformed, staleTime);
      }

      if (mountedRef.current) {
        setData(transformed);
        setState('idle');
        setError(null);
      }
      return transformed;
    } catch (err) {
      if (controller.signal.aborted || err?.name === 'AbortError') return;

      if (!mountedRef.current || requestId !== currentRequestId.current) return;
      setState('error');
      setError(err);
      return undefined;
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [fetchFn, resolvedCacheKey, enabled, staleTime, transform]);

  useEffect(() => {
    if (!enabled) return;
    execute();
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [execute, enabled]);

  useEffect(() => {
    if (!enabled || !resolvedCacheKey) return undefined;
    const revalidateIfStale = () => {
      if (document.visibilityState !== 'visible') return;
      const cached = getCache(resolvedCacheKey);
      if (!cached || cached.isStale) execute();
    };
    window.addEventListener('focus', revalidateIfStale);
    document.addEventListener('visibilitychange', revalidateIfStale);
    return () => {
      window.removeEventListener('focus', revalidateIfStale);
      document.removeEventListener('visibilitychange', revalidateIfStale);
    };
  }, [enabled, execute, resolvedCacheKey]);

  const invalidate = useCallback(() => {
    if (resolvedCacheKey) {
      invalidateCache(resolvedCacheKey);
    }
    execute();
  }, [resolvedCacheKey, execute]);

  const mutate = useCallback((updater) => {
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (resolvedCacheKey) {
        setCache(resolvedCacheKey, next, staleTime);
      }
      return next;
    });
  }, [resolvedCacheKey, staleTime]);

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
  invalidateCachePattern(pattern || '');
}
