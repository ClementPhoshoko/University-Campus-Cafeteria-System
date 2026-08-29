import { Link } from 'react-router-dom';
import { IconArrowLeft, IconHome } from '@tabler/icons-react';
import './Breadcrumb.css';

export default function Breadcrumb({ items = [] }) {
  if (items.length === 0) return null;

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol className="breadcrumb__list">
        <li className="breadcrumb__item breadcrumb__item--home">
          <Link to="/" className="breadcrumb__link">
            <IconHome size={14} stroke={2} />
            <span>Home</span>
          </Link>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.to || item.label} className="breadcrumb__item">
              <IconArrowLeft size={12} stroke={2} className="breadcrumb__separator" />
              {isLast ? (
                <span className="breadcrumb__current">{item.label}</span>
              ) : (
                <Link to={item.to} className="breadcrumb__link">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
