import NotificationItem from './NotificationItem.jsx';

export default function NotificationList({ notifications, selectedId, busyIds, onSelect, onAction }) {
  return (
    <ul className="notification-list" aria-label="Notifications">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          selected={notification.id === selectedId}
          busy={busyIds.has(notification.id)}
          onSelect={onSelect}
          onAction={onAction}
        />
      ))}
    </ul>
  );
}
