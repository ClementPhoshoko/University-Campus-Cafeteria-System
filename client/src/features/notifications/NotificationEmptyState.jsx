import { IconInbox } from '@tabler/icons-react';

export default function NotificationEmptyState({
  icon: Icon = IconInbox,
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div className={`notification-empty${className ? ` ${className}` : ''}`}>
      <span className="notification-empty__icon" aria-hidden="true">
        <Icon size={30} stroke={1.5} />
      </span>
      <h4 className="notification-empty__title">{title}</h4>
      <p className="notification-empty__description">{description}</p>
      {action}
    </div>
  );
}
