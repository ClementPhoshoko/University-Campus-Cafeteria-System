import NotificationItem from './NotificationItem.jsx';

export default function NotificationList({ notifications, selectedId, busyIds, onSelect, onAction }) {
  const bulkBusy = busyIds.has('bulk:read-all') || busyIds.has('bulk:clear-read');

  return (
    <ul className="notification-list" aria-label="Notifications">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          selected={notification.id === selectedId}
          busy={
            bulkBusy
            || busyIds.has(`delete:${notification.id}`)
            || busyIds.has(`read:${notification.id}`)
          }
          onSelect={onSelect}
          onAction={onAction}
        />
      ))}
    </ul>
  );
}
