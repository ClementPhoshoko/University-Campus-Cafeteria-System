import Skeleton from '../../components/ui/Skeleton.jsx';
import '../../components/cards/CardSkeletonShimmer.css';
import './profile-skeletons.css';

function LoadingLine({ width, height = 12, className = '' }) {
  return <Skeleton className={`home_card-skeleton-shimmer ${className}`} style={{ width, height }} />;
}

function SkeletonHeading({ titleWidth = '136px', descriptionWidth = 'min(100%, 320px)' }) {
  return (
    <div className="access-section-heading" aria-hidden="true">
      <Skeleton className="profile-skeleton-section-icon home_card-skeleton-shimmer" />
      <div className="access-section-heading__copy">
        <LoadingLine width={titleWidth} height={16} />
        <LoadingLine width={descriptionWidth} height={11} />
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
          <LoadingLine className="profile-skeleton-source" width="84px" height={9} />
        </div>
        <Skeleton className="profile-skeleton-status home_card-skeleton-shimmer" />
      </div>
      <div className="access-role-card__body">
        <LoadingLine width={index ? '58%' : '44%'} height={13} />
        <LoadingLine width="90%" height={10} />
        <LoadingLine width="72%" height={10} />
      </div>
    </article>
  );
}

function SkeletonMembershipCard({ index }) {
  return (
    <article className="access-membership-card" aria-hidden="true">
      <Skeleton className="profile-skeleton-round-icon home_card-skeleton-shimmer" />
      <div className="access-membership-card__body">
        <LoadingLine width="92px" height={9} />
        <LoadingLine width={index ? '48%' : '62%'} height={13} />
      </div>
      <Skeleton className="profile-skeleton-status home_card-skeleton-shimmer" />
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

      <section className="profile-access-section">
        <SkeletonHeading titleWidth="152px" />
        <div className="access-membership-list">
          <SkeletonMembershipCard index={0} />
          <SkeletonMembershipCard index={1} />
        </div>
      </section>
    </div>
  );
}
