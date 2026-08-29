import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { IconBell, IconShoppingCart, IconChefHat } from '@tabler/icons-react';
import DesktopNav from './DesktopNav.jsx';
import logo from '../../assets/main_logo.png';

/**
 * Global application header (glass topbar).
 * Reuses .topbar / .brand / .icon-button from the design system.
 * Brand treatment matches the auth screens: "merchant" blue, "munchies" dark.
 * Mobile: brand + actions. Desktop: brand + centered nav + actions.
 * Glass background only appears when scrolled (undocked).
 */
export default function ApplicationHeader({ actions }) {
  const ref = useRef(null);

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
          <img src={logo} alt="" className="brand-logo" />
          <span className="brand-word">
            <span className="brand-merchant">merchant</span>
            <span className="brand-munchies">munchies</span>
          </span>
        </Link>

        <DesktopNav />

        <div className="topbar-actions">
          {actions}
          <Link to="/cart" className="icon-button" aria-label="Your cart">
            <IconShoppingCart size={19} stroke={1.8} />
          </Link>
          <button type="button" className="icon-button" aria-label="Notifications">
            <IconBell size={19} stroke={1.8} />
          </button>
        </div>
      </div>
    </header>
  );
}
