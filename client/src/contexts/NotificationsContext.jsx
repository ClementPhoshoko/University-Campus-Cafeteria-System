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
import { supabase } from '../services/supabase.js';
import { notificationFromRow } from '../features/notifications/notificationUtils.js';

const NotificationsContext = createContext(null);
const LEVELS = ['none', 'info', 'warning', 'alert'];
const REALTIME_DEBOUNCE_MS = 180;
const FALLBACK_POLL_MS = 45_000;

function normalizeLevel(level, unreadCount) {
  if (!unreadCount) return 'none';
  return LEVELS.includes(level) && level !== 'none' ? level : 'info';
}

function readUnreadCount(payload) {
  const value = Number(payload?.unreadCount);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Convert a Supabase postgres_changes payload into the smallest event the inbox
 * needs. Email delivery rows are excluded because they are audit records, not
 * inbox messages.
 */
function normalizeNotificationEvent(payload) {
  const eventType = payload?.eventType || payload?.event_type;
  const raw = eventType === 'DELETE' ? payload?.old : payload?.new;
  if (!raw?.id || (raw.channel && raw.channel !== 'in_app')) return null;

  if (eventType === 'DELETE') return { type: 'delete', id: raw.id };
  const notification = notificationFromRow(raw);
  if (!notification) return null;
  return {
    type: eventType === 'INSERT' ? 'insert' : 'update',
    id: notification.id,
    notification,
  };
}

/**
 * Global unread summary and live inbox events for the header bell and the
 * notification page. Counts come from the API service, row changes come from
 * Supabase Realtime, and all in-flight work is aborted on sign-out or unmount.
 */
export function NotificationsProvider({ children }) {
  const { session } = useAuth();
  const token = session?.access_token || null;
  const userId = session?.user?.id || null;

  const [summary, setSummary] = useState({ unreadCount: 0, level: 'none' });
  const [loading, setLoading] = useState(false);
  const [notificationEvent, setNotificationEvent] = useState(null);

  const requestIdRef = useRef(0);
  const controllerRef = useRef(null);
  const inFlightRef = useRef(null);
  const eventQueueRef = useRef([]);
  const eventSequenceRef = useRef(0);
  const eventDebounceRef = useRef(null);
  const realtimeConnectedRef = useRef(false);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    inFlightRef.current = null;
    window.clearTimeout(eventDebounceRef.current);
    eventDebounceRef.current = null;
    eventQueueRef.current = [];
    realtimeConnectedRef.current = false;
    setSummary({ unreadCount: 0, level: 'none' });
    setLoading(false);
    setNotificationEvent(null);
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

  // Realtime row changes patch the loaded page directly; only the small count
  // endpoint is called. This avoids reloading the whole inbox on every read.
  const publishEvents = useCallback((events) => {
    const valid = events.filter(Boolean);
    if (!valid.length) return;
    eventQueueRef.current.push(...valid);
    window.clearTimeout(eventDebounceRef.current);
    eventDebounceRef.current = window.setTimeout(() => {
      const batch = eventQueueRef.current.splice(0);
      eventSequenceRef.current += 1;
      setNotificationEvent({ sequence: eventSequenceRef.current, events: batch });
    }, REALTIME_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (!token || !userId || typeof supabase?.channel !== 'function') return undefined;

    if (typeof supabase.realtime?.setAuth === 'function') supabase.realtime.setAuth(token);

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const event = normalizeNotificationEvent(payload);
        if (!event) return;
        publishEvents([event]);
        refreshUnreadCount({ force: true });
      })
      .subscribe((status) => {
        realtimeConnectedRef.current = status === 'SUBSCRIBED';
      });

    return () => {
      window.clearTimeout(eventDebounceRef.current);
      eventDebounceRef.current = null;
      eventQueueRef.current = [];
      realtimeConnectedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [token, userId, publishEvents, refreshUnreadCount]);

  // Polling is only a safety net. While the socket is connected it refreshes
  // the bell count; when disconnected it also asks the page to resync.
  const fallbackSync = useCallback(() => {
    if (!token || document.visibilityState !== 'visible') return;
    refreshUnreadCount({ force: true });
    if (!realtimeConnectedRef.current) publishEvents([{ type: 'resync' }]);
  }, [token, publishEvents, refreshUnreadCount]);

  useEffect(() => {
    if (!token) return undefined;
    const id = window.setInterval(fallbackSync, FALLBACK_POLL_MS);
    document.addEventListener('visibilitychange', fallbackSync);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', fallbackSync);
    };
  }, [token, fallbackSync]);

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
    notificationEvent,
    refreshUnreadCount,
    applyLocalChange,
  }), [summary, loading, notificationEvent, refreshUnreadCount, applyLocalChange]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within NotificationsProvider');
  return context;
}
