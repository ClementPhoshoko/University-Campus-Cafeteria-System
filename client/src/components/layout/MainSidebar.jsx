import { NavLink } from 'react-router-dom';
import './MainSidebar.css';

/**
 * Reusable vertical section navigation rail for authenticated pages.
 *
 * Each item renders an icon with a stacked title + subtitle below it.
 * Items with a `to` value are route-aware NavLinks; items without one keep the
 * original controlled-button behavior. Used by Profile and reusable for
 * Vendor/Admin/Finance/Support portals.
 *
 * Props:
 *   items    - [{ id, Icon, title, subtitle, to? }]
 *   active   - id of the active item
 *   onSelect - (id) => void, for button-driven items
 *   heading  - optional section heading shown above the rail
 */
export default function MainSidebar({ items = [], active, onSelect, heading }) {
  return (
    <nav className="main-sidebar" aria-label={heading || 'Page sections'}>
      {heading && (
        <p className="main-sidebar_heading">{heading}</p>
      )}
      <ul className="main-sidebar_list">
        {items.map(({ id, Icon, title, subtitle, to }) => {
          const isActive = id === active;
          const className = `main-sidebar_button${isActive ? ' main-sidebar_button--active' : ''}`;
          const content = (
            <>
              <span className="main-sidebar_icon">
                <Icon size={22} stroke={1.8} />
              </span>
              <span className="main-sidebar_text">
                <span className="main-sidebar_title">{title}</span>
                <span className="main-sidebar_subtitle">{subtitle}</span>
              </span>
            </>
          );

          return (
            <li key={id} className="main-sidebar_item">
              {to ? (
                <NavLink
                  to={to}
                  className={className}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {content}
                </NavLink>
              ) : (
                <button
                  type="button"
                  className={className}
                  onClick={() => onSelect?.(id)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
