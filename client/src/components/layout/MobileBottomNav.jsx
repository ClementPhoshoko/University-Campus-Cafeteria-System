import { navigationItems } from './navigationItems.jsx';
import NavigationItem from './NavigationItem.jsx';
import { useRoles } from '../../hooks/useRoles.js';

const CORE_KEYS = ['home', 'cafeterias', 'orders', 'vendor', 'profile'];

/** Fixed bottom navigation for <768px viewports. Hidden on desktop via CSS. */
export default function MobileBottomNav() {
  const { hasAnyRole } = useRoles();
  const core = navigationItems.filter((item) => CORE_KEYS.includes(item.key)
    && (!item.roles || item.roles.some((role) => hasAnyRole(role))));

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {core.map((item) => (
        <NavigationItem key={item.key} item={item} variant="mobile" />
      ))}
    </nav>
  );
}
