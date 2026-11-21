import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { IconBell, IconShoppingCart, IconSun, IconMoon } from '@tabler/icons-react';
import DesktopNav from './DesktopNav.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useNotifications } from '../../contexts/NotificationsContext.jsx';
import logo from '../../assets/main_logo.webp';
import './ApplicationHeader.css';

/**
 * Global application header (glass topbar).
 * Reuses .topbar / .brand / .icon-button from the design system.
 * Brand treatment matches the auth screens: "merchant" blue, "munchies" dark.
 * Mobile: brand + actions. Desktop: brand + centered nav + actions.
 * Glass background only appears when scrolled (undocked).
 */
export default function ApplicationHeader({ actions }) {
  const ref = useRef(null);
  const { isDark, toggleTheme } = useTheme();
  const { unreadCount, level } = useNotifications();
  const hasUnread = unreadCount > 0;
  const bellLabel = hasUnread
    ? `Notifications, ${unreadCount} unread`
    : 'Notifications, no unread';
  const bellTitle = hasUnread
    ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'} (${level})`
    : 'No unread notifications';

  useEffect(() => {
    const onScroll = () => {
      ref.current?.classList.toggle('topbar--scrolled', window.scrollY > 10);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="topbar" ref={ref}>
      <div className="topbar-inner">
        <Link to="/" className="brand app-brand" aria-label="Merchant Munchies home">
          <img src={logo} alt="" className="brand-logo" loading="eager" />
          <span className="brand-word">
            <span className="brand-merchant">merchant</span>
            <span className="brand-munchies">munchies</span>
          </span>
        </Link>

        <DesktopNav />

        <div className="topbar-actions">
          {actions}
          <button
            type="button"
            className="icon-button"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
          >
            {isDark ? <IconSun size={19} stroke={1.8} /> : <IconMoon size={19} stroke={1.8} />}
          </button>
          <Link to="/cart" className="icon-button" aria-label="Your cart">
            <IconShoppingCart size={19} stroke={1.8} />
          </Link>
          <Link
            to="/notifications"
            className="icon-button notification-bell"
            aria-label={bellLabel}
            title={bellTitle}
          >
            <IconBell size={19} stroke={1.8} />
            {hasUnread && (
              <span
                className={`notification-bell__indicator notification-bell__indicator--${level}`}
                aria-hidden="true"
              >
                {level === 'alert' && (
                  <span className="notification-bell__count">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
