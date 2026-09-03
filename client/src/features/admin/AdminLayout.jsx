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
} from '@tabler/icons-react';
import PageContainer from '../../components/layout/PageContainer.jsx';
import AdminBackground from '../../components/AdminBackground.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { ADMIN_NAV_ITEMS } from './adminMockData.js';
import mainLogo from '../../assets/main_logo.png';
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

  return (
    <div className="admin-shell">
      <AdminBackground />

      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <img src={mainLogo} alt="Logo" className="admin-sidebar__logo" />
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
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="14" r="8" fill="currentColor" />
              <path d="M8 43 C9 34, 15 27, 24 27 C33 27, 39 34, 40 43 H8Z" fill="currentColor" />
            </svg>
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

        <div className="admin-content">
          <PageContainer className="admin-page-container">
            <Outlet />
          </PageContainer>
        </div>
      </main>
    </div>
  );
}
