import Skeleton from '../../components/ui/Skeleton.jsx';
import '../../components/cards/CardSkeletonShimmer.css';
import './profile-skeletons.css';

function LoadingLine({ width, height = 12, className = '' }) {
  return <Skeleton className={`home_card-skeleton-shimmer ${className}`} style={{ width, height }} />;
}

function SkeletonCardHeading({ withAction = false }) {
  return (
    <div className="profile_card-header">
      <div className="profile_card-heading">
        <Skeleton className="profile-skeleton-icon home_card-skeleton-shimmer" />
        <LoadingLine width="164px" height={16} />
      </div>
      {withAction && <Skeleton className="profile-skeleton-action home_card-skeleton-shimmer" />}
    </div>
  );
}

function SkeletonInfoRow({ labelWidth = '86px', valueWidth = '62%' }) {
  return (
    <div className="profile_info-row">
      <LoadingLine width={labelWidth} height={10} />
      <LoadingLine width={valueWidth} height={13} />
    </div>
  );
}

/**
 * Mirrors the profile overview layout while the canonical profile request is
 * in flight. Uses the shared Skeleton and shimmer used by the vendor pages.
 */
export default function ProfileOverviewSkeleton() {
  return (
    <div className="profile-overview-skeleton" role="status" aria-label="Loading profile overview" aria-busy="true">
      <section className="profile_intro" aria-hidden="true">
        <div className="profile_hero-copy">
          <LoadingLine width="104px" height={11} />
          <LoadingLine width="min(100%, 248px)" height={28} />
        </div>
        <div className="profile_hero-meta">
          <Skeleton className="profile-skeleton-pill home_card-skeleton-shimmer" />
        </div>
      </section>

      <section className="profile_section" aria-hidden="true">
        <div className="profile_editable-group">
          <div className="profile_section-toolbar">
            <LoadingLine width="228px" height={11} />
          </div>

          <div className="profile_card">
            <SkeletonCardHeading />
            <dl className="profile_info-list">
              <SkeletonInfoRow labelWidth="92px" valueWidth="74%" />
              <SkeletonInfoRow labelWidth="102px" valueWidth="68%" />
              <SkeletonInfoRow labelWidth="88px" valueWidth="58%" />
            </dl>
          </div>

          <dl className="profile_info-list profile_info-list--personal">
            <SkeletonInfoRow labelWidth="78px" valueWidth="70%" />
            <SkeletonInfoRow labelWidth="102px" valueWidth="84%" />
            <SkeletonInfoRow labelWidth="112px" valueWidth="64%" />
          </dl>

          <LoadingLine className="profile-skeleton-link" width="112px" height={10} />
        </div>
      </section>

      <section className="profile_card profile_card--accent" aria-hidden="true">
        <SkeletonCardHeading withAction />
        <div className="profile_location-grid">
          <SkeletonInfoRow labelWidth="112px" valueWidth="78%" />
          <SkeletonInfoRow labelWidth="128px" valueWidth="72%" />
        </div>
      </section>
    </div>
  );
}
