import { navigationItems } from './navigationItems.jsx';
import NavigationItem from './NavigationItem.jsx';

/** Fixed bottom navigation for <768px viewports. Hidden on desktop via CSS. */
export default function MobileBottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {navigationItems.map((item) => (
        <NavigationItem key={item.key} item={item} variant="mobile" />
      ))}
    </nav>
  );
}
