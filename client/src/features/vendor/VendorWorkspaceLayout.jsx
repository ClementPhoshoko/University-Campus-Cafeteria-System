import { IconBox, IconBuilding, IconBuildingStore, IconCalendarTime, IconChartBar, IconList, IconShoppingBag, IconUsers } from '@tabler/icons-react';
import './vendor-workspace.css';

const OVERVIEW_ITEM = { view: 'overview', label: 'Overview', Icon: IconShoppingBag };
const MANAGER_ITEMS = [
  { view: 'menus', label: 'Menu & categories', Icon: IconList },
  { view: 'stock', label: 'Location stock', Icon: IconBox },
  { view: 'slots', label: 'Collection slots', Icon: IconCalendarTime },
  { view: 'catering', label: 'Catering', Icon: IconBuilding },
  { view: 'reports', label: 'Reports', Icon: IconChartBar },
  { view: 'team', label: 'Team access', Icon: IconUsers },
];

export default function VendorWorkspaceLayout({
  vendorName,
  role,
  activeView = 'overview',
  onNavigate,
  children,
}) {
  const items = role === 'manager' ? [OVERVIEW_ITEM, ...MANAGER_ITEMS] : [OVERVIEW_ITEM];

  return <div className="vendor-workspace">
    <aside className="vendor-workspace__sidebar">
      <div className="vendor-workspace__brand">
        <span className="vendor-workspace__brand-icon"><IconBuildingStore size={19} /></span>
        <div>
          <span>Vendor workspace</span>
          <strong>{vendorName || 'Your vendor'}</strong>
        </div>
      </div>
      <nav className="vendor-workspace__nav" aria-label="Vendor workspace navigation">
        {items.map(({ view, label, Icon }) => (
          <button
            key={view}
            type="button"
            className={`vendor-workspace__link${activeView === view ? ' is-active' : ''}`}
            aria-current={activeView === view ? 'page' : undefined}
            onClick={() => onNavigate(view)}
          >
            <Icon size={18} stroke={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <span className="vendor-workspace__role">{role === 'manager' ? 'Manager' : 'Staff'}</span>
    </aside>
    <main className="vendor-workspace__content">{children}</main>
  </div>;
}