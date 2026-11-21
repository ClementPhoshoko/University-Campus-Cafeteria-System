import {
  IconChecks,
  IconEraser,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react';
import Pagination from '../../components/ui/Pagination.jsx';
import NotificationActionsMenu from './NotificationActionsMenu.jsx';
import NotificationEmptyState from './NotificationEmptyState.jsx';
import NotificationFilters from './NotificationFilters.jsx';
import NotificationList from './NotificationList.jsx';
import NotificationSkeleton from './NotificationSkeleton.jsx';
import { NOTIFICATION_LIMIT } from './notificationUtils.js';

export default function NotificationInbox({
  notifications,
  pagination,
  filter,
  onFilterChange,
  search,
  onSearchChange,
  unreadCount,
  selectedId,
  busyIds,
  busy = false,
  onSelect,
  onAction,
  onPageChange,
  onBulkAction,
  loading,
  refreshing,
  error,
  onRetry,
  emptyState,
}) {
  const bulkItems = [
    { key: 'read-all', label: 'Mark all as read', icon: IconChecks, onClick: () => onBulkAction('read-all') },
    { key: 'clear-read', label: 'Clear read notifications', icon: IconEraser, tone: 'danger', onClick: () => onBulkAction('clear-read') },
    { key: 'refresh', label: 'Refresh', icon: IconRefresh, onClick: () => onBulkAction('refresh') },
  ].map((item) => ({ ...item, disabled: busy && item.key !== 'refresh' }));

  return (
    <section className="notification-inbox glass" aria-label="Notification inbox">
      <header className="notification-inbox__header">
        <div className="notification-inbox__heading">
          <h3>Inbox</h3>
          {unreadCount > 0 && (
            <span className="notification-inbox__badge" aria-label={`${unreadCount} unread`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <NotificationActionsMenu
          className="notification-inbox__menu"
          label="Bulk notification actions"
          items={bulkItems}
        />
      </header>

      <div className="notification-inbox__tools">
        <div className="notification-inbox__search">
          <IconSearch size={17} stroke={1.8} aria-hidden="true" />
          <label className="notification-sr-only" htmlFor="notification-search">Search notifications</label>
          <input
            id="notification-search"
            type="search"
            value={search}
            placeholder="Search notifications"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <NotificationFilters value={filter} onChange={onFilterChange} unreadCount={unreadCount} />
        {search.trim() && (
          <p className="notification-inbox__search-hint">Search filters the loaded page.</p>
        )}
      </div>

      <div className="notification-inbox__list" aria-busy={loading || refreshing}>
        {loading && <NotificationSkeleton />}

        {!loading && error && (
          <div className="notification-inbox__error" role="alert">
            <p>We could not load your notifications. Please try again.</p>
            <button type="button" className="notification-inbox__retry" onClick={onRetry}>Retry</button>
          </div>
        )}

        {!loading && !error && notifications.length === 0 && (
          <NotificationEmptyState title={emptyState.title} description={emptyState.description} />
        )}

        {!loading && !error && notifications.length > 0 && (
          <NotificationList
            notifications={notifications}
            selectedId={selectedId}
            busyIds={busyIds}
            onSelect={onSelect}
            onAction={onAction}
          />
        )}
      </div>

      {!loading && !error && notifications.length > 0 && (
        <footer className="notification-inbox__footer">
          {refreshing && <span className="notification-inbox__refreshing">Updating…</span>}
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={NOTIFICATION_LIMIT}
            label="notifications"
            onPageChange={onPageChange}
          />
        </footer>
      )}
    </section>
  );
}
