import { navigationItems } from './navigationItems.jsx';
import NavigationItem from './NavigationItem.jsx';
import { useRoles } from '../../hooks/useRoles.js';

/** Horizontal navigation rendered inside the application header on ≥768px. */
export default function DesktopNav() {
  const { hasAnyRole } = useRoles();

  const visible = navigationItems.filter(
    (item) => !item.roles || item.roles.some((r) => hasAnyRole(r)),
  );

  return (
    <nav className="desktop-nav" aria-label="Primary">
      {visible.map((item) => (
        <NavigationItem key={item.key} item={item} variant="desktop" />
      ))}
    </nav>
  );
}
