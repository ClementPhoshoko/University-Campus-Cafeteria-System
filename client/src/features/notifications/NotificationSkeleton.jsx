import '../../components/cards/CardSkeletonShimmer.css';

const ROWS = 5;

export default function NotificationSkeleton({ rows = ROWS }) {
  return (
    <div className="notification-skeleton" role="status" aria-label="Loading notifications">
      {Array.from({ length: rows }, (_, index) => (
        <div className="notification-skeleton__row" key={index}>
          <span className="notification-skeleton__icon home_card-skeleton-shimmer" />
          <span className="notification-skeleton__lines">
            <span className="notification-skeleton__line home_card-skeleton-shimmer" />
            <span className="notification-skeleton__line notification-skeleton__line--short home_card-skeleton-shimmer" />
          </span>
        </div>
      ))}
    </div>
  );
}
