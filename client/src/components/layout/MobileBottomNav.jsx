import { navigationItems } from './navigationItems.jsx';
import NavigationItem from './NavigationItem.jsx';

const CORE_KEYS = ['home', 'cafeterias', 'orders', 'profile'];

/** Fixed bottom navigation for <768px viewports. Hidden on desktop via CSS. */
export default function MobileBottomNav() {
  const core = navigationItems.filter((item) => CORE_KEYS.includes(item.key));

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {core.map((item) => (
        <NavigationItem key={item.key} item={item} variant="mobile" />
      ))}
    </nav>
  );
}
