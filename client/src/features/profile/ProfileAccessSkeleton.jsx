import Skeleton from '../../components/ui/Skeleton.jsx';
import '../../components/cards/CardSkeletonShimmer.css';
import './profile-skeletons.css';

function LoadingLine({ width, height = 12, className = '' }) {
  return <Skeleton className={`home_card-skeleton-shimmer ${className}`} style={{ width, height }} />;
}

function SkeletonCardHeading({ width = '140px' }) {
  return (
    <div className="profile_card-header">
      <LoadingLine width={width} height={16} />
    </div>
  );
}

function SkeletonBadgeRow() {
  return (
    <div className="profile-access-badge-list" aria-hidden="true">
      <Skeleton className="profile-skeleton-badge home_card-skeleton-shimmer" />
      <Skeleton className="profile-skeleton-badge profile-skeleton-badge--short home_card-skeleton-shimmer" />
    </div>
  );
}

function SkeletonMemberRows() {
  return (
    <div className="profile-access-member-list" aria-hidden="true">
      {Array.from({ length: 2 }, (_, index) => (
        <div className="profile-access-member-row" key={index}>
          <div className="profile-access-member-main">
            <LoadingLine width={index ? '58%' : '70%'} height={13} />
            <LoadingLine width="96px" height={10} />
          </div>
          <Skeleton className="profile-skeleton-status home_card-skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}

/**
 * Mirrors the role and access layout while GET /profile/access is in flight.
 */
export default function ProfileAccessSkeleton() {
  return (
    <div className="profile-access-skeleton" role="status" aria-label="Loading role and access" aria-busy="true">
      <header className="profile-access-header" aria-hidden="true">
        <LoadingLine width="104px" height={11} />
        <LoadingLine width="min(100%, 220px)" height={28} />
        <LoadingLine width="min(100%, 420px)" height={12} />
      </header>

      <section className="profile_card" aria-hidden="true">
        <SkeletonCardHeading width="132px" />
        <SkeletonBadgeRow />
        <div className="profile-access-summary">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="profile-access-stat" key={index}>
              <LoadingLine width="84px" height={10} />
              <LoadingLine width="32px" height={20} />
            </div>
          ))}
        </div>
      </section>

      <div className="profile-access-grid" aria-hidden="true">
        <section className="profile_card">
          <SkeletonCardHeading width="132px" />
          <SkeletonBadgeRow />
        </section>
        <section className="profile_card">
          <SkeletonCardHeading width="120px" />
          <SkeletonMemberRows />
        </section>
      </div>
    </div>
  );
}
