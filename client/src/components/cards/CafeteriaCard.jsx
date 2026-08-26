import { Link } from 'react-router-dom';
import {
  IconPlugX,
  IconWalk,
  IconClock,
  IconToolsKitchen2,
  IconCoffee,
} from '@tabler/icons-react';
import './CafeteriaCard.css';

const STATUS_LABELS = {
  open: 'Open',
  busy: 'Busy',
  closed: 'Closed',
};

const CATEGORY_ICONS = {
  dining: IconToolsKitchen2,
  seafood: IconToolsKitchen2,
  cafe: IconCoffee,
};

export default function CafeteriaCard({
  id,
  name,
  status,
  category,
  image,
  description,
  walkTime,
  prepWindow,
  to = '/cafeterias',
}) {
  const CategoryIcon = CATEGORY_ICONS[category] || IconToolsKitchen2;

  return (
    <Link
      to={to}
      className={`home_vendor-card${status === 'closed' ? ' home_closed' : ''}`}
    >
      <div className="home_vendor-media">
        <img src={image} alt={name} loading="lazy" />
        <span className={`home_vendor-status-pill ${status}`}>
          {STATUS_LABELS[status]}
        </span>
        {status === 'closed' && (
          <span className="home_vendor-closed-badge" aria-hidden="true">
            <IconPlugX size={24} stroke={1.8} />
          </span>
        )}
      </div>

      <span className="home_vendor-category-badge" aria-hidden="true">
        <CategoryIcon size={24} stroke={1.8} />
      </span>

      <div className="home_vendor-body">
        <h3>{name}</h3>
        <p className="home_vendor-desc">{description}</p>
        <div className="home_vendor-divider" />
        <div className="home_vendor-meta">
          <span>
            <IconWalk size={15} stroke={1.8} />
            {walkTime}
          </span>
          <i className="home_meta-dot" />
          <span>
            <IconClock size={15} stroke={1.8} />
            {prepWindow}
          </span>
        </div>
      </div>
    </Link>
  );
}
