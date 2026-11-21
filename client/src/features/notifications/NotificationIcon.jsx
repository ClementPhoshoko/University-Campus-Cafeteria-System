import {
  IconBell,
  IconBuildingStore,
  IconCreditCard,
  IconShieldCheck,
  IconShoppingBag,
  IconShoppingCart,
  IconSpeakerphone,
} from '@tabler/icons-react';

/** Exact singular categories emitted by the notification backend. */
export const CATEGORY_ICONS = {
  order: IconShoppingBag,
  payment: IconCreditCard,
  cart: IconShoppingCart,
  vendor: IconBuildingStore,
  promotion: IconSpeakerphone,
  account: IconShieldCheck,
  system: IconBell,
};

export default function NotificationIcon({ category, size = 20, className = '' }) {
  const Icon = CATEGORY_ICONS[category] || IconBell;
  const variant = Object.hasOwn(CATEGORY_ICONS, category) ? category : 'system';

  return (
    <span className={`notification-icon notification-icon--${variant}${className ? ` ${className}` : ''}`} aria-hidden="true">
      <Icon size={size} stroke={1.8} />
    </span>
  );
}
