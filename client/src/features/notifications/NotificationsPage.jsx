import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../../components/layout/PageContainer.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import { useConfirm } from '../../components/confirmation/ConfirmProvider.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useNotifications } from '../../contexts/NotificationsContext.jsx';
import {
  clearReadNotifications,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  NOTIFICATION_CACHE_PREFIX,
} from '../../services/notificationApi.js';
import NotificationDetail from './NotificationDetail.jsx';
import NotificationInbox from './NotificationInbox.jsx';
import {
  applyNotificationEvents,
  isInternalActionPath,
  NOTIFICATION_LIMIT,
} from './notificationUtils.js';
import './notifications.css';

export default function NotificationsPage() {
  const { session } = useAuth();
  const token = session?.access_token || null;
  const userId = session?.user?.id || 'anonymous';
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { unreadCount, notificationEvent, applyLocalChange, refreshUnreadCount } = useNotifications();

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [actionError, setActionError] = useState('');
  const pendingRef = useRef(new Set());
  const handledEventSequenceRef = useRef(notificationEvent?.sequence || 0);
  // Realtime echoes of our own read mutations are redundant: the optimistic
  // patch already applied the authoritative response.
  const recentMutationsRef = useRef(new Map());

  const fetchNotifications = useCallback(({ signal } = {}) => listNotifications({
    page,
    limit: NOTIFICATION_LIMIT,
    filter,
    q: debouncedSearch,
    token,
    signal,
  }), [page, filter, debouncedSearch, token]);

  const cacheKey = `${NOTIFICATION_CACHE_PREFIX}list:${userId}:${filter}:${page}:${debouncedSearch}`;
  const { data, isLoading, isRefreshing, isError, error, refetch, mutate } = useFetch(
    fetchNotifications,
    { cacheKey, enabled: Boolean(token), staleTime: 0 },
  );

  // The backend owns filtering and pagination, including the debounced search.
  const notifications = Array.isArray(data?.notifications) ? data.notifications : [];

  const pagination = data?.pagination || {
    page: 1,
    limit: NOTIFICATION_LIMIT,
    total: notifications.length,
    totalPages: 1,
  };

  useEffect(() => {
    if (!selected) return;
    const fresh = notifications.find((notification) => notification.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [notifications, selected]);

  useEffect(() => {
    if (!token) {
      setSelected(null);
      setFilter('all');
      setSearch('');
      setPage(1);
    }
  }, [token]);

  useEffect(() => {
    const totalPages = Number(pagination.totalPages);
    if (Number.isFinite(totalPages) && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [page, pagination.totalPages]);

  // Live row changes patch the loaded page in place. There is no list request
  // here; only a lost realtime socket triggers a full resync.
  useEffect(() => {
    if (!notificationEvent || notificationEvent.sequence === handledEventSequenceRef.current) return;
    handledEventSequenceRef.current = notificationEvent.sequence;

    const events = Array.isArray(notificationEvent.events) ? notificationEvent.events : [];
    if (events.some((event) => event?.type === 'resync')) {
      refetch();
      refreshUnreadCount({ force: true });
      return;
    }

    const now = Date.now();
    const liveEvents = events.filter((event) => {
      if (event?.type !== 'update' || !event.id) return Boolean(event);
      const mutatedAt = recentMutationsRef.current.get(event.id);
      if (mutatedAt && now - mutatedAt < 2500) {
        recentMutationsRef.current.delete(event.id);
        return false;
      }
      return true;
    });
    if (!liveEvents.length) return;

    mutate((current) => applyNotificationEvents(current, liveEvents, {
      filter,
      search: debouncedSearch,
    }));

    const deletedIds = new Set(liveEvents.filter((event) => event?.type === 'delete').map((event) => event.id));
    if (selected?.id && deletedIds.has(selected.id)) setSelected(null);
  }, [
    notificationEvent,
    filter,
    debouncedSearch,
    selected?.id,
    mutate,
    refetch,
    refreshUnreadCount,
  ]);

  const emptyState = useMemo(() => {
    if (search.trim()) {
      return {
        title: 'No matching notifications',
        description: 'Try a different search term or clear the filters.',
      };
    }
    if (filter === 'unread') {
      return {
        title: 'No unread notifications',
        description: 'You are all caught up. New updates will appear here.',
      };
    }
    if (filter === 'read') {
      return {
        title: 'No read notifications',
        description: 'Notifications you have read will appear here.',
      };
    }
    return {
      title: 'No notifications yet',
      description: 'Updates about your orders, vendors and account will appear here.',
    };
  }, [search, filter]);

  const begin = useCallback((key) => {
    if (pendingRef.current.has(key)) return false;
    pendingRef.current.add(key);
    setBusyIds(new Set(pendingRef.current));
    return true;
  }, []);

  const end = useCallback((key) => {
    pendingRef.current.delete(key);
    setBusyIds(new Set(pendingRef.current));
  }, []);

  const patchNotification = useCallback((id, patch) => {
    mutate((current) => current ? {
      ...current,
      notifications: (Array.isArray(current.notifications) ? current.notifications : [])
        .map((notification) => (notification.id === id ? { ...notification, ...patch } : notification)),
    } : current);
  }, [mutate]);

  const removeNotifications = useCallback((ids) => {
    const idSet = new Set(ids);
    mutate((current) => {
      if (!current) return current;
      const list = Array.isArray(current.notifications) ? current.notifications : [];
      const kept = list.filter((notification) => !idSet.has(notification.id));
      const removed = list.length - kept.length;
      const total = Math.max(0, (Number(current.pagination?.total) || list.length) - removed);
      return {
        ...current,
        notifications: kept,
        pagination: {
          ...current.pagination,
          total,
          totalPages: Math.max(1, Math.ceil(total / NOTIFICATION_LIMIT)),
        },
      };
    });
  }, [mutate]);

  const buildReadView = useCallback((notification, read) => {
    const now = new Date().toISOString();
    return {
      ...notification,
      isRead: read,
      status: read ? 'read' : 'sent',
      readAt: read ? notification.readAt || now : null,
    };
  }, []);

  const setReadState = useCallback(async (notification, read, options = {}) => {
    if (!token) return;
    const key = `read:${notification.id}`;
    if (!begin(key)) return;
    setActionError('');

    // Paint the read state and the bell before any network work. The API call
    // only confirms persistence; no list refetch is involved.
    const optimistic = buildReadView(notification, read);
    const delta = (read ? 0 : 1) - (notification.isRead ? 1 : 0);
    patchNotification(notification.id, optimistic);
    if (!options.selectionAlreadySet) {
      setSelected((current) => (current?.id === notification.id ? optimistic : current));
    }
    if (delta) applyLocalChange((current) => ({ unreadCount: current.unreadCount + delta }));
    recentMutationsRef.current.set(notification.id, Date.now());

    try {
      const response = read
        ? await markNotificationRead(notification.id, { token })
        : await markNotificationUnread(notification.id, { token });
      const updated = { ...optimistic, ...(response?.notification || {}) };
      patchNotification(notification.id, updated);
      if (!options.selectionAlreadySet) {
        setSelected((current) => (current?.id === notification.id ? updated : current));
      }
      // Reconcile only the small count endpoint, never the whole inbox.
      refreshUnreadCount();
    } catch {
      patchNotification(notification.id, notification);
      setSelected((current) => (current?.id === notification.id ? notification : current));
      if (delta) applyLocalChange((current) => ({ unreadCount: current.unreadCount - delta }));
      recentMutationsRef.current.delete(notification.id);
      setActionError('Could not update this notification. Please try again.');
    } finally {
      end(key);
    }
  }, [
    token,
    begin,
    end,
    buildReadView,
    patchNotification,
    applyLocalChange,
    refreshUnreadCount,
  ]);

  const selectNotification = useCallback((notification) => {
    // The selected detail gets the same read view in the same render pass as
    // the list patch, so clicking feels immediate rather than waiting on API.
    setSelected(notification.isRead ? notification : buildReadView(notification, true));
    if (!notification.isRead) setReadState(notification, true, { selectionAlreadySet: true });
  }, [buildReadView, setReadState]);

  const deleteOne = useCallback(async (notification) => {
    const confirmed = await confirm({
      title: 'Delete notification?',
      message: 'This notification will be removed from your inbox.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;

    const key = `delete:${notification.id}`;
    if (!begin(key)) return;
    setActionError('');

    try {
      await deleteNotification(notification.id, { token });
      removeNotifications([notification.id]);
      setSelected((current) => (current?.id === notification.id ? null : current));
      if (!notification.isRead) {
        applyLocalChange((current) => ({ unreadCount: current.unreadCount - 1 }));
      }
      recentMutationsRef.current.set(notification.id, Date.now());
      refreshUnreadCount();
    } catch {
      setActionError('Could not delete this notification. Please try again.');
    } finally {
      end(key);
    }
  }, [confirm, token, begin, end, removeNotifications, applyLocalChange, refreshUnreadCount]);

  const openRelated = useCallback((notification) => {
    const path = notification.metadata?.actionPath;
    if (!isInternalActionPath(path)) return;
    if (!notification.isRead) {
      // Fire-and-forget: the read state is patched locally before the route
      // transition and must never delay navigation.
      setReadState(notification, true);
    }
    navigate(path);
  }, [navigate, setReadState]);

  const handleAction = useCallback((action, notification) => {
    if (action === 'read') setReadState(notification, true);
    else if (action === 'unread') setReadState(notification, false);
    else if (action === 'delete') deleteOne(notification);
    else if (action === 'open') openRelated(notification);
  }, [setReadState, deleteOne, openRelated]);

  const handleBulkAction = useCallback(async (action) => {
    if (action === 'refresh') {
      refetch();
      refreshUnreadCount({ force: true });
      return;
    }

    if (action === 'clear-read') {
      const confirmed = await confirm({
        title: 'Clear read notifications?',
        message: 'All notifications you have already read will be removed from your inbox.',
        confirmLabel: 'Clear read',
        tone: 'danger',
      });
      if (!confirmed) return;
    }

    if (!begin('bulk')) return;
    setActionError('');

    try {
      if (action === 'read-all') {
        await markAllNotificationsRead({ token });
        const now = new Date().toISOString();
        mutate((current) => current ? {
          ...current,
          notifications: (Array.isArray(current.notifications) ? current.notifications : [])
            .map((notification) => ({ ...notification, isRead: true, readAt: notification.readAt || now })),
        } : current);
        setSelected((current) => (current ? { ...current, isRead: true, readAt: current.readAt || now } : current));
        applyLocalChange({ unreadCount: 0, level: 'none' });
      } else if (action === 'clear-read') {
        await clearReadNotifications({ token });
        removeNotifications((Array.isArray(data?.notifications) ? data.notifications : [])
          .filter((notification) => notification.isRead)
          .map((notification) => notification.id));
        setSelected((current) => (current?.isRead ? null : current));
      }
      refreshUnreadCount();
    } catch {
      setActionError('Could not complete this action. Please try again.');
    } finally {
      end('bulk');
    }
  }, [confirm, token, begin, end, mutate, data, removeNotifications, applyLocalChange, refreshUnreadCount]);

  return (
    <PageContainer className="notifications-page">
      <PageHeader
        title="Notifications"
        subtitle="Stay updated on your orders, vendors and platform activity."
      />

      {actionError && <p className="notifications-page__error" role="alert">{actionError}</p>}

      <div className={`notifications-workspace${selected ? ' notifications-workspace--detail-open' : ''}`}>
        <NotificationInbox
          notifications={notifications}
          pagination={pagination}
          filter={filter}
          onFilterChange={(next) => { setFilter(next); setPage(1); }}
          search={search}
          onSearchChange={(value) => { setSearch(value); setPage(1); }}
          unreadCount={unreadCount}
          selectedId={selected?.id}
          busyIds={busyIds}
          busy={busyIds.has('bulk')}
          onSelect={selectNotification}
          onAction={handleAction}
          onPageChange={setPage}
          onBulkAction={handleBulkAction}
          loading={isLoading}
          refreshing={isRefreshing}
          error={error}
          onRetry={() => { refetch(); refreshUnreadCount({ force: true }); }}
          emptyState={emptyState}
        />
        <NotificationDetail
          notification={selected}
          busy={busyIds.size > 0}
          onBack={() => setSelected(null)}
          onAction={handleAction}
        />
      </div>
    </PageContainer>
  );
}
