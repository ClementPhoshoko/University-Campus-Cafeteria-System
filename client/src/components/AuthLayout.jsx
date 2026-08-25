import { Outlet, useLocation } from 'react-router-dom';
import AuthBackground from './AuthBackground.jsx';
import mainLogo from '../assets/main_logo.png';

export default function AuthLayout() {
  const location = useLocation();

  return (
    <div className="auth-screen">
      <AuthBackground />
      <div className="auth-content">
        <div className="auth-brand">
          <img src={mainLogo} alt="Merchant Munchies" className="auth-logo" />
          <div className="auth-brand-name">
            <span className="auth-brand-merchant">merchant</span>
            <span className="auth-brand-munchies">munchies</span>
          </div>
          <p className="auth-brand-tagline">
            <span>GOOD FOOD</span>
            <span className="auth-brand-tagline-dot">•</span>
            <span className="auth-brand-tagline-accent">LESS QUEUE</span>
            <span className="auth-brand-tagline-dot">•</span>
            <span>MORE YOU</span>
          </p>
          <svg className="auth-brand-smile" width="36" height="12" viewBox="0 0 48 16" fill="none" aria-hidden="true">
            <path d="M4 4C12 14 36 14 44 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="auth-page" key={location.pathname}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
