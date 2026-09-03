import { Link } from 'react-router-dom';
import { IconHome } from '@tabler/icons-react';
import './Breadcrumb.css';

export default function Breadcrumb({ items = [], homeLabel = 'Home', homeTo = '/' }) {
  if (items.length === 0) return null;

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol className="breadcrumb__list">
        <li className="breadcrumb__item breadcrumb__item--home">
          <Link to={homeTo} className="breadcrumb__link">
            <IconHome size={14} stroke={2} />
            <span>{homeLabel}</span>
          </Link>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.to || item.label} className="breadcrumb__item">
              <span className="breadcrumb__separator">/</span>
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
