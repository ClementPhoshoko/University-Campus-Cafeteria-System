import { stripSensitiveText } from './notificationUtils.js';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Renders the server-owned body as friendly prose. Vendor and order reference
 * are emphasised in place; no identifier cards or raw ids are shown.
 */
export default function NotificationMessage({ notification }) {
  const context = notification?.metadata?.context || {};
  const body = stripSensitiveText(notification?.body, context);
  if (!body) return <p className="notification-detail__body">No details were provided.</p>;

  const highlights = [context.vendorName, context.orderReference]
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim());

  if (!highlights.length) return <p className="notification-detail__body">{body}</p>;

  const pattern = new RegExp(`(${highlights.map(escapeRegExp).join('|')})`, 'g');
  const parts = body.split(pattern).filter((part) => part !== '');

  return (
    <p className="notification-detail__body">
      {parts.map((part, index) => (
        highlights.includes(part)
          ? <strong key={`${part}-${index}`}>{part}</strong>
          : <span key={`text-${index}`}>{part}</span>
      ))}
    </p>
  );
}
