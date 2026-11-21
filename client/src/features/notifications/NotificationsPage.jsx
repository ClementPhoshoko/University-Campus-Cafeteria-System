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
  categoryLabel,
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
  const { unreadCount, applyLocalChange, refreshUnreadCount } = useNotifications();

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [actionError, setActionError] = useState('');
  const pendingRef = useRef(new Set());

  const fetchNotifications = useCallback(({ signal } = {}) => listNotifications({
    page,
    limit: NOTIFICATION_LIMIT,
    filter,
    q: debouncedSearch,
    token,
    signal,
  }), [page, filter, debouncedSearch, token]);

  const cacheKey = `${NOTIFICATION_CACHE_PREFIX}list:${userId}:${filter}:${page}:${debouncedSearch}`;
  const { data, isLoading, isRefreshing, isError, error, refetch, invalidate, mutate } = useFetch(
    fetchNotifications,
    { cacheKey, enabled: Boolean(token), staleTime: 0 },
  );

  // The backend is authoritative for pagination; the local pass keeps search
  // useful even when a deployment ignores `q`.
  const notifications = useMemo(() => {
    const list = Array.isArray(data?.notifications) ? data.notifications : [];
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return list;
    return list.filter((notification) => [notification.title, notification.body, categoryLabel(notification.category), notification.eventKey]
      .some((value) => typeof value === 'string' && value.toLowerCase().includes(term)));
  }, [data, debouncedSearch]);

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

  const setReadState = useCallback(async (notification, read) => {
    if (!token) return;
    const key = `read:${notification.id}`;
    if (!begin(key)) return;
    setActionError('');

    try {
      const response = read
        ? await markNotificationRead(notification.id, { token })
        : await markNotificationUnread(notification.id, { token });
      const updated = { ...notification, ...(response?.notification || {}), isRead: read };
      patchNotification(notification.id, updated);
      setSelected((current) => (current?.id === notification.id ? updated : current));

      const delta = (read ? 0 : 1) - (notification.isRead ? 1 : 0);
      applyLocalChange((current) => ({ unreadCount: current.unreadCount + delta }));
      invalidate();
      refreshUnreadCount({ force: true });
    } catch {
      setActionError('Could not update this notification. Please try again.');
    } finally {
      end(key);
    }
  }, [token, begin, end, patchNotification, applyLocalChange, invalidate, refreshUnreadCount]);

  const selectNotification = useCallback((notification) => {
    setSelected(notification);
    if (!notification.isRead) setReadState(notification, true);
  }, [setReadState]);

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
      invalidate();
      refreshUnreadCount({ force: true });
    } catch {
      setActionError('Could not delete this notification. Please try again.');
    } finally {
      end(key);
    }
  }, [confirm, token, begin, end, removeNotifications, applyLocalChange, invalidate, refreshUnreadCount]);

  const openRelated = useCallback(async (notification) => {
    const path = notification.metadata?.actionPath;
    if (!isInternalActionPath(path)) return;
    if (!notification.isRead) await setReadState(notification, true);
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
      invalidate();
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
      invalidate();
      refreshUnreadCount({ force: true });
    } catch {
      setActionError('Could not complete this action. Please try again.');
    } finally {
      end('bulk');
    }
  }, [confirm, token, begin, end, mutate, data, removeNotifications, applyLocalChange, invalidate, refreshUnreadCount]);

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
          onRetry={() => { invalidate(); refreshUnreadCount({ force: true }); }}
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
