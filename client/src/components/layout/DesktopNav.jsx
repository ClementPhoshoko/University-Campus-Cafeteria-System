import { navigationItems } from './navigationItems.jsx';
import NavigationItem from './NavigationItem.jsx';

/** Horizontal navigation rendered inside the application header on ≥768px. */
export default function DesktopNav() {
  return (
    <nav className="desktop-nav" aria-label="Primary">
      {navigationItems.map((item) => (
        <NavigationItem key={item.key} item={item} variant="desktop" />
      ))}
    </nav>
  );
}
