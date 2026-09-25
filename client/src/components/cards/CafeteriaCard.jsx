import { Link } from 'react-router-dom';
import {
  IconPlugX,
  IconClock,
  IconMapPin,
  IconToolsKitchen2,
  IconCoffee,
} from '@tabler/icons-react';
import './CafeteriaCard.css';
import SmartImage from '../ui/SmartImage.jsx';

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
  siteName,
  name,
  status,
  category,
  image,
  description,
  walkTime,
  prepWindow,
  rating,
  reviewCount,
  location,
  variant = 'default',
  to = '/cafeterias',
}) {
  const CategoryIcon = CATEGORY_ICONS[category] || IconToolsKitchen2;

  return (
    <Link
      to={to}
      className={`home_vendor-card${status === 'closed' ? ' home_closed' : ''}${variant === 'directory' ? ' home_vendor-card--directory' : ''}`}
    >
      <div className="home_vendor-media">
        <SmartImage src={image} alt={name} width={248} height={320} />
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
        <h3>{siteName || name}</h3>
        <p className="home_vendor-desc">{description}</p>
        {Number(rating) > 0 && (
          <div className="home_vendor-directory-meta">
            <span className="home_vendor-rating" aria-label={`${rating} out of 5 stars`}>
              <span aria-hidden="true">★</span> {rating} <small>({reviewCount || 0})</small>
            </span>
          </div>
        )}
        <div className="home_vendor-divider" />
        <div className="home_vendor-meta">
          {location && (
            <span>
              <IconMapPin size={15} stroke={1.8} />
              {location}
            </span>
          )}
          {prepWindow && prepWindow !== '—' && (
            <>
              <i className="home_meta-dot" />
              <span>
                <IconClock size={15} stroke={1.8} />
                {prepWindow}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
