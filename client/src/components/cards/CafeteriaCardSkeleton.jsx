import './CafeteriaCard.css';
import './CardSkeletonShimmer.css';

export default function CafeteriaCardSkeleton({ variant = 'default' }) {
  const directory = variant === 'directory';

  return (
    <div
      className={`home_vendor-card home_vendor-card--skeleton${directory ? ' home_vendor-card--directory' : ''}`}
      aria-hidden="true"
    >
      <div className="home_vendor-media home_vendor-skeleton-media home_card-skeleton-shimmer">
        <span className="home_vendor-skeleton-pill home_card-skeleton-shimmer" />
      </div>
      <div className="home_vendor-body home_vendor-skeleton-body">
        <span className="home_vendor-skeleton-line home_vendor-skeleton-title home_card-skeleton-shimmer" />
        <span className="home_vendor-skeleton-line home_vendor-skeleton-description home_card-skeleton-shimmer" />
        {directory && <span className="home_vendor-skeleton-line home_vendor-skeleton-description home_vendor-skeleton-description--short home_card-skeleton-shimmer" />}
        <div className="home_vendor-divider" />
        <div className="home_vendor-meta">
          <span className="home_vendor-meta__item">
            <span className="home_vendor-skeleton-icon home_card-skeleton-shimmer" />
            <span className="home_vendor-meta__copy">
              <span className="home_vendor-skeleton-line home_vendor-skeleton-label home_card-skeleton-shimmer" />
              <span className="home_vendor-skeleton-line home_vendor-skeleton-location home_card-skeleton-shimmer" />
            </span>
          </span>
          <span className="home_vendor-meta__item home_vendor-meta__item--prep-time">
            <span className="home_vendor-skeleton-icon home_card-skeleton-shimmer" />
            <span className="home_vendor-meta__copy">
              <span className="home_vendor-skeleton-line home_vendor-skeleton-label home_card-skeleton-shimmer" />
              <span className="home_vendor-skeleton-line home_vendor-skeleton-prep home_card-skeleton-shimmer" />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
