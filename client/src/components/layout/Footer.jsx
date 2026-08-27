import { Link } from 'react-router-dom';
import { IconBrandInstagram, IconBrandTwitter, IconBrandWhatsapp } from '@tabler/icons-react';
import logo from '../../assets/main_logo.png';
import './Footer.css';

const quickLinks = [
  { label: 'Help Centre', to: '/help' },
  { label: 'Contact Us', to: '/contact' },
  { label: 'About', to: '/about' },
];

const legalLinks = [
  { label: 'Terms of Service', to: '/terms' },
  { label: 'Privacy Policy', to: '/privacy' },
];

const socials = [
  { icon: IconBrandInstagram, href: '#', label: 'Instagram' },
  { icon: IconBrandTwitter, href: '#', label: 'Twitter' },
  { icon: IconBrandWhatsapp, href: '#', label: 'WhatsApp' },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <Link to="/" className="footer-brand-name app-brand" aria-label="Merchant Munchies home">
              <img src={logo} alt="" className="brand-logo" />
              <span className="brand-word">
                <span className="brand-merchant">merchant</span>
                <span className="brand-munchies">munchies</span>
              </span>
            </Link>
            <p className="footer-tagline">
              Fast, fresh meals for the Merchant Place team.
            </p>
          </div>

          <div className="footer-links">
            <div className="footer-col">
              <h4 className="footer-col-title">Quick Links</h4>
              <ul className="footer-link-list">
                {quickLinks.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="footer-link">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="footer-col">
              <h4 className="footer-col-title">Legal</h4>
              <ul className="footer-link-list">
                {legalLinks.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="footer-link">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="footer-socials">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                className="footer-social-link"
                aria-label={s.label}
                target="_blank"
                rel="noopener noreferrer"
              >
                <s.icon size={20} stroke={1.8} />
              </a>
            ))}
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2026 Merchant Munchies. Made for Merchant Place.</p>
        </div>
      </div>
    </footer>
  );
}
