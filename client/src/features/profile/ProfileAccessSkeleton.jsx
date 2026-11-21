import Skeleton from '../../components/ui/Skeleton.jsx';
import '../../components/cards/CardSkeletonShimmer.css';
import './profile-skeletons.css';

function LoadingLine({ width, className = '' }) {
  return <Skeleton className={`home_card-skeleton-shimmer ${className}`} style={{ width }} />;
}

function SkeletonHeading({ titleWidth = '136px', descriptionWidth = 'min(100%, 320px)' }) {
  return (
    <div className="access-section-heading" aria-hidden="true">
      <Skeleton className="profile-skeleton-section-icon home_card-skeleton-shimmer" />
      <div className="access-section-heading__copy">
        <LoadingLine className="profile-skeleton-heading-title" width={titleWidth} />
        <LoadingLine className="profile-skeleton-heading-description" width={descriptionWidth} />
      </div>
    </div>
  );
}

function SkeletonRoleCard({ index }) {
  return (
    <article className="access-role-card" aria-hidden="true">
      <div className="access-role-card__top">
        <div className="access-role-card__identity">
          <Skeleton className="profile-skeleton-round-icon home_card-skeleton-shimmer" />
          <LoadingLine className="profile-skeleton-source" width="84px" />
        </div>
        <Skeleton className="profile-skeleton-status home_card-skeleton-shimmer" />
      </div>
      <div className="access-role-card__body">
        <LoadingLine className="profile-skeleton-role-title" width={index ? '58%' : '44%'} />
        <LoadingLine className="profile-skeleton-role-line" width="90%" />
        <LoadingLine className="profile-skeleton-role-line" width="72%" />
      </div>
    </article>
  );
}

/** Mirrors the role and membership cards while GET /profile/access is in flight. */
export default function ProfileAccessSkeleton() {
  return (
    <div className="profile-access-skeleton" role="status" aria-label="Loading role and access" aria-busy="true">
      <section className="profile-access-section">
        <SkeletonHeading titleWidth="124px" />
        <div className="access-role-grid">
          <SkeletonRoleCard index={0} />
          <SkeletonRoleCard index={1} />
        </div>
      </section>
    </div>
  );
}
