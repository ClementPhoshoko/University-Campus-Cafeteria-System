import successAvatar from '../../assets/avatars/Cheerful_Student_with_Green_Checkmark.webp';
import promoAvatar from '../../assets/avatars/Cheerful_Student_Presenting_with_Open_Palm.png';
import errorAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.webp';
import reminderAvatar from '../../assets/avatars/illustration_avoid_queues.webp';
import collectAvatar from '../../assets/avatars/illustration_collect_order.webp';
import connectedAvatar from '../../assets/avatars/connected_avatar.webp';
import NotificationIcon from './NotificationIcon.jsx';

const EVENT_AVATARS = {
  'order.placed': successAvatar,
  'order.payment_confirmed': successAvatar,
  'order.accepted': successAvatar,
  'order.preparing': successAvatar,
  'order.ready_for_collection': collectAvatar,
  'order.collected': successAvatar,
  'corporate.approved': successAvatar,
  'corporate.rejected': errorAvatar,
  'cart.expiring': reminderAvatar,
  'cart.expired': reminderAvatar,
  'vendor.unavailable': reminderAvatar,
  'promotion.new_vendor': promoAvatar,
  'account.password_changed': errorAvatar,
};

function avatarFor(notification) {
  const eventKey = typeof notification?.eventKey === 'string' ? notification.eventKey : '';
  if (EVENT_AVATARS[eventKey]) return EVENT_AVATARS[eventKey];

  const level = notification?.level;
  if (level === 'alert') return errorAvatar;
  if (level === 'warning') return reminderAvatar;
  if (notification?.category === 'promotion') return promoAvatar;
  return connectedAvatar;
}

/**
 * Friendly illustration for each notification, with the existing category icon
 * kept as a small status badge so the established visual language survives.
 */
export default function NotificationAvatar({ notification, size = 36, className = '' }) {
  const src = avatarFor(notification);

  return (
    <span
      className={`notification-avatar${className ? ` ${className}` : ''}`}
      style={{ '--notification-avatar-size': `${size}px` }}
      aria-hidden="true"
    >
      <img className="notification-avatar__image" src={src} alt="" loading="lazy" />
      <span className="notification-avatar__badge">
        <NotificationIcon category={notification?.category} size={11} />
      </span>
    </span>
  );
}
