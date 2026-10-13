import { Link } from 'react-router-dom';
import {
  IconPlugX,
  IconClock,
  IconMapPin,
} from '@tabler/icons-react';
import './CafeteriaCard.css';
import SmartImage from '../ui/SmartImage.jsx';

const STATUS_LABELS = {
  open: 'Open',
  busy: 'Busy',
  closed: 'Closed',
  temporarily_unavailable: 'Temporarily unavailable',
};

export default function CafeteriaCard({
  id,
  name,
  status,
  image,
  description,
  prepWindow,
  rating,
  reviewCount,
  location,
  locations = [],
  onImageError,
  variant = 'default',
  to = '/cafeterias',
}) {
  const selectedLocation = location || locations[0] || null;
  const locationLabel = [selectedLocation?.site_name, selectedLocation?.building_name].filter(Boolean).join(' · ');
  const visiblePrepWindow = prepWindow
    || (Number(selectedLocation?.estimated_prep_minutes) > 0
      ? `${selectedLocation.estimated_prep_minutes} min`
      : null);

  return (
    <Link
      to={to}
      className={`home_vendor-card${status === 'closed' || status === 'temporarily_unavailable' ? ' home_closed' : ''}${variant === 'directory' ? ' home_vendor-card--directory' : ''}`}
    >
      <div className="home_vendor-media">
        <SmartImage
          src={image}
          alt={name}
          width={248}
          height={320}
          onError={onImageError ? () => onImageError(id, image) : undefined}
        />
        <span className={`home_vendor-status-pill ${status}`}>
          {STATUS_LABELS[status]}
        </span>
        {(status === 'closed' || status === 'temporarily_unavailable') && (
          <span className="home_vendor-closed-badge" aria-hidden="true">
            <IconPlugX size={24} stroke={1.8} />
          </span>
        )}
      </div>

      <div className="home_vendor-body">
        <h3>{name}</h3>
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
          <span className="home_vendor-meta__item">
            <IconMapPin size={15} stroke={1.8} />
            <span className="home_vendor-meta__copy">
              <small>Location</small>
              <strong title={locationLabel}>{locationLabel || 'Location not set'}</strong>
            </span>
          </span>
          <span className="home_vendor-meta__item home_vendor-meta__item--prep-time" aria-label={visiblePrepWindow ? `Estimated prep time: ${visiblePrepWindow}` : 'Prep time not set'}>
            <IconClock size={15} stroke={1.8} />
            <span className="home_vendor-meta__copy">
              <small>Prep time</small>
              <strong>{visiblePrepWindow || 'Not set'}</strong>
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
