import { NavLink } from 'react-router-dom';

/**
 * Route-aware navigation item shared by desktop and mobile navigation.
 * Styling comes from .nav-item / .bottom-nav-item active states in shell.css.
 */
export default function NavigationItem({ item, variant = 'desktop', onNavigate }) {
  const { route, label, Icon } = item;

  if (variant === 'mobile') {
    return (
      <NavLink
        to={route}
        end={route === '/'}
        className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
        onClick={onNavigate}
      >
        <Icon size={22} stroke={1.8} />
        <span>{label}</span>
      </NavLink>
    );
  }

  return (
    <NavLink
      to={route}
      end={route === '/'}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
    >
      <Icon size={18} stroke={1.8} />
      <span>{label}</span>
    </NavLink>
  );
}
