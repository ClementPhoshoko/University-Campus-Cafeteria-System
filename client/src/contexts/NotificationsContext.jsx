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
import { getNotificationUnreadCount } from '../services/notificationApi.js';
import { attachAbortListener } from '../services/abortSignal.js';

const NotificationsContext = createContext(null);
const LEVELS = ['none', 'info', 'warning', 'alert'];

function normalizeLevel(level, unreadCount) {
  if (!unreadCount) return 'none';
  return LEVELS.includes(level) && level !== 'none' ? level : 'info';
}

function readUnreadCount(payload) {
  const value = Number(payload?.unreadCount);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Global unread summary for the header bell. Reads come only from the API
 * service and only while a session exists; all in-flight work is aborted on
 * sign-out or unmount.
 */
export function NotificationsProvider({ children }) {
  const { session } = useAuth();
  const token = session?.access_token || null;

  const [summary, setSummary] = useState({ unreadCount: 0, level: 'none' });
  const [loading, setLoading] = useState(false);

  const requestIdRef = useRef(0);
  const controllerRef = useRef(null);
  const inFlightRef = useRef(null);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    inFlightRef.current = null;
    setSummary({ unreadCount: 0, level: 'none' });
    setLoading(false);
  }, []);

  const refreshUnreadCount = useCallback(({ signal, force = false } = {}) => {
    if (!token) {
      reset();
      return Promise.resolve(null);
    }
    // Coalesce simultaneous callers; explicit refreshes after a mutation may
    // opt out so the authoritative count is always re-read.
    if (!force && inFlightRef.current) return inFlightRef.current;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const detach = attachAbortListener(signal, () => controller.abort());
    if (signal?.aborted) controller.abort();

    const requestId = ++requestIdRef.current;
    setLoading(true);

    const promise = getNotificationUnreadCount({ token, signal: controller.signal })
      .then((payload) => {
        if (requestId !== requestIdRef.current || controller.signal.aborted) return payload;
        const unreadCount = readUnreadCount(payload);
        setSummary({ unreadCount, level: normalizeLevel(payload?.level, unreadCount) });
        return payload;
      })
      .catch(() => null)
      .finally(() => {
        detach();
        if (controllerRef.current === controller) controllerRef.current = null;
        if (inFlightRef.current === promise) inFlightRef.current = null;
        if (requestId === requestIdRef.current) setLoading(false);
      });

    inFlightRef.current = promise;
    return promise;
  }, [token, reset]);

  useEffect(() => {
    if (!token) {
      reset();
      return undefined;
    }
    const controller = new AbortController();
    refreshUnreadCount({ signal: controller.signal, force: true });
    return () => controller.abort();
  }, [token, refreshUnreadCount, reset]);

  /** Reconcile the bell after a page mutation without faking persistence. */
  const applyLocalChange = useCallback((change) => {
    if (!change) return;
    setSummary((current) => {
      const patch = typeof change === 'function' ? change(current) : change;
      if (!patch || typeof patch !== 'object') return current;

      const candidate = patch.unreadCount !== undefined ? Number(patch.unreadCount) : current.unreadCount;
      const unreadCount = Number.isFinite(candidate) ? Math.max(0, Math.floor(candidate)) : current.unreadCount;
      const level = patch.level !== undefined
        ? patch.level
        : (unreadCount === 0 ? 'none' : (current.level === 'none' ? 'info' : current.level));

      return { unreadCount, level: normalizeLevel(level, unreadCount) };
    });
  }, []);

  const value = useMemo(() => ({
    unreadCount: summary.unreadCount,
    level: summary.level,
    loading,
    refreshUnreadCount,
    applyLocalChange,
  }), [summary, loading, refreshUnreadCount, applyLocalChange]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within NotificationsProvider');
  return context;
}
