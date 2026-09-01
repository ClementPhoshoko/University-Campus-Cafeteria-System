import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  IconChartBar,
  IconBuildingStore,
  IconMapPin,
  IconUsers,
  IconReceipt,
  IconFileAnalytics,
  IconAlertTriangle,
  IconSpeakerphone,
  IconShieldCheck,
  IconSettings,
  IconLogout,
  IconUserCircle,
} from '@tabler/icons-react';
import PageContainer from '../../components/layout/PageContainer.jsx';
import AdminBackground from '../../components/AdminBackground.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { ADMIN_NAV_ITEMS } from './adminMockData.js';
import './admin.css';

const ICON_MAP = {
  IconChartBar,
  IconBuildingStore,
  IconMapPin,
  IconUsers,
  IconReceipt,
  IconFileAnalytics,
  IconAlertTriangle,
  IconSpeakerphone,
  IconShieldCheck,
  IconSettings,
};

function NavItem({ item }) {
  const Icon = ICON_MAP[item.icon];
  return (
    <NavLink
      to={item.to}
      end={item.to === '/admin'}
      className={({ isActive }) =>
        `admin-sidebar__link${isActive ? ' admin-sidebar__link--active' : ''}`
      }
    >
      {Icon && <Icon size={18} stroke={1.8} />}
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function AdminLayout() {
  const { profile, user, signOut } = useAuth();
  const location = useLocation();
  const currentItem = ADMIN_NAV_ITEMS.find((item) =>
    item.to === '/admin'
      ? location.pathname === '/admin'
      : location.pathname.startsWith(item.to)
  );

  const displayName = profile?.full_name || profile?.email || user?.email || 'Admin';
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="admin-shell">
      <AdminBackground />

      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <span className="admin-sidebar__logo">MM</span>
          <div className="admin-sidebar__brand-text">
            <span className="admin-sidebar__brand-title">Merchant Munchies</span>
            <span className="admin-sidebar__brand-sub">Admin Console</span>
          </div>
        </div>

        <nav className="admin-sidebar__nav" aria-label="Admin navigation">
          <span className="admin-sidebar__heading">Management</span>
          {ADMIN_NAV_ITEMS.slice(0, 4).map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
          <span className="admin-sidebar__heading">Operations</span>
          {ADMIN_NAV_ITEMS.slice(4, 8).map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
          <span className="admin-sidebar__heading">System</span>
          {ADMIN_NAV_ITEMS.slice(8).map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </nav>

        <div className="admin-sidebar__user">
          <div className="admin-sidebar__avatar" aria-hidden="true">
            <IconUserCircle size={18} stroke={1.8} />
            <span className="admin-sidebar__avatar-text">{initials}</span>
          </div>
          <div className="admin-sidebar__user-info">
            <span className="admin-sidebar__user-name">{displayName}</span>
            <span className="admin-sidebar__user-role">Company Admin</span>
          </div>
          <button
            type="button"
            className="admin-sidebar__logout"
            onClick={signOut}
            aria-label="Sign out"
          >
            <IconLogout size={16} stroke={1.8} />
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar__title-wrap">
            <span className="admin-topbar__eyebrow">Admin Console</span>
            <h1 className="admin-topbar__title">{currentItem?.label || 'Dashboard'}</h1>
          </div>
          <div className="admin-topbar__meta">
            <span className="admin-topbar__chip">Merchant Place · Pilot</span>
            <span className="admin-topbar__chip admin-topbar__chip--success">System Healthy</span>
          </div>
        </header>

        <PageContainer className="admin-page-container" noPad>
          <Outlet />
        </PageContainer>
      </main>
    </div>
  );
}
