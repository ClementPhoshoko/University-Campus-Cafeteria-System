import {
  IconArrowLeft,
  IconArrowUpRight,
  IconBell,
  IconCheck,
  IconCircleOff,
  IconTrash,
} from '@tabler/icons-react';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import NotificationActionsMenu from './NotificationActionsMenu.jsx';
import NotificationEmptyState from './NotificationEmptyState.jsx';
import NotificationIcon from './NotificationIcon.jsx';
import NotificationMessage from './NotificationMessage.jsx';
import {
  categoryLabel,
  formatFullDateTime,
  isInternalActionPath,
  notificationTimestamp,
} from './notificationUtils.js';

export default function NotificationDetail({ notification, busy, onBack, onAction }) {
  if (!notification) {
    return (
      <section className="notification-detail glass notification-detail--empty" aria-label="Notification detail">
        <NotificationEmptyState
          className="notification-detail__empty"
          icon={IconBell}
          title="Select a notification"
          description="Choose a notification from your inbox to view its details."
        />
      </section>
    );
  }

  const unread = !notification.isRead;
  const canOpen = isInternalActionPath(notification.metadata?.actionPath);
  const timestamp = notificationTimestamp(notification);
  const actionLabel = 'Open related content';

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
    <section className="notification-detail glass" aria-label="Notification detail">
      <header className="notification-detail__topbar">
        <button type="button" className="notification-detail__back" onClick={onBack} aria-label="Back to inbox">
          <IconArrowLeft size={18} stroke={1.8} />
          <span>Inbox</span>
        </button>
        <NotificationActionsMenu label="Notification actions" items={items} />
      </header>

      <div className="notification-detail__content">
        <div className="notification-detail__heading">
          <NotificationIcon category={notification.category} size={22} className="notification-icon--large" />
          <div>
            <h3 className="notification-detail__title">{notification.title || 'Notification'}</h3>
            <p className="notification-detail__category">{categoryLabel(notification.category)}</p>
          </div>
        </div>

        <div className="notification-detail__meta">
          <span>{formatFullDateTime(timestamp)}</span>
          <span className="notification-detail__meta-divider" aria-hidden="true">·</span>
          <span className={`notification-detail__status${unread ? ' is-unread' : ''}`}>
            {unread ? 'Unread' : 'Read'}
          </span>
        </div>

        <NotificationMessage notification={notification} />

        {canOpen && (
          <div className="notification-detail__actions">
            <PrimaryButton icon={IconArrowUpRight} onClick={() => onAction('open', notification)} disabled={busy}>
              {actionLabel}
            </PrimaryButton>
          </div>
        )}
      </div>
    </section>
  );
}
