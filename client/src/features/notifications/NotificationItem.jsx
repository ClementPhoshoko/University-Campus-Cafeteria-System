import {
  IconArrowUpRight,
  IconCheck,
  IconCircleOff,
  IconTrash,
} from '@tabler/icons-react';
import NotificationActionsMenu from './NotificationActionsMenu.jsx';
import NotificationIcon from './NotificationIcon.jsx';
import {
  categoryLabel,
  formatRelativeTime,
  isInternalActionPath,
  notificationTimestamp,
  previewText,
  stripSensitiveText,
} from './notificationUtils.js';

export default function NotificationItem({ notification, selected, busy, onSelect, onAction }) {
  const unread = !notification.isRead;
  const relative = formatRelativeTime(notificationTimestamp(notification));
  const canOpen = isInternalActionPath(notification.metadata?.actionPath);

  const items = [
    unread
      ? { key: 'read', label: 'Mark as read', icon: IconCheck, onClick: () => onAction('read', notification) }
      : { key: 'unread', label: 'Mark as unread', icon: IconCircleOff, onClick: () => onAction('unread', notification) },
    ...(canOpen
      ? [{ key: 'open', label: 'Open related content', icon: IconArrowUpRight, onClick: () => onAction('open', notification) }]
      : []),
    { key: 'delete', label: 'Delete', icon: IconTrash, tone: 'danger', onClick: () => onAction('delete', notification) },
  ].map((item) => ({ ...item, disabled: busy }));

  return (
    <li className={`notification-item${selected ? ' is-selected' : ''}${unread ? ' is-unread' : ''}`}>
      <button
        type="button"
        className="notification-item__main"
        onClick={() => onSelect(notification)}
        aria-current={selected ? 'true' : undefined}
        aria-label={`${notification.title || 'Notification'}, ${relative}${unread ? ', unread' : ''}`}
      >
        <NotificationIcon category={notification.category} size={20} />
        <span className="notification-item__content">
          <span className="notification-item__title">{notification.title || 'Notification'}</span>
          <span className="notification-item__preview">
            {previewText(stripSensitiveText(notification.body, notification.metadata?.context))}
          </span>
          <span className="notification-item__meta">
            <span className="notification-item__category">{categoryLabel(notification.category)}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={notification.sentAt || notification.createdAt || undefined}>{relative}</time>
          </span>
        </span>
        <span className="notification-item__unread-dot" aria-hidden="true" />
      </button>

      <NotificationActionsMenu
        className="notification-item__menu"
        label={`Actions for ${notification.title || 'notification'}`}
        items={items}
      />
    </li>
  );
}
