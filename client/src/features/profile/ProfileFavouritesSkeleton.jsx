import Skeleton from '../../components/ui/Skeleton.jsx';
import '../../components/cards/CardSkeletonShimmer.css';
import './profile-skeletons.css';

const VENDOR_ROWS = [
  { nameWidth: '124px', detailWidth: '76px' },
  { nameWidth: '98px', detailWidth: '92px' },
];

const MEAL_ROWS = [
  { nameWidth: '136px', detailWidth: '88px' },
  { nameWidth: '108px', detailWidth: '104px' },
];

function LoadingLine({ width, height, className = '' }) {
  return <Skeleton className={`home_card-skeleton-shimmer ${className}`} style={{ width, height }} />;
}

function SkeletonListHeader({ titleWidth }) {
  return (
    <div className="profile_card-header" aria-hidden="true">
      <LoadingLine className="profile-skeleton-favourite-title" width={titleWidth} height={18} />
      <Skeleton className="profile-skeleton-favourite-count home_card-skeleton-shimmer" />
    </div>
  );
}

function SkeletonListRow({ nameWidth, detailWidth }) {
  return (
    <div className="profile_favourite-item" aria-hidden="true">
      <div>
        <div className="profile_favourite-title-row">
          <LoadingLine className="profile-skeleton-favourite-name" width={nameWidth} height={14} />
          <Skeleton className="profile-skeleton-favourite-remove home_card-skeleton-shimmer" />
        </div>
        <LoadingLine className="profile-skeleton-favourite-detail" width={detailWidth} height={12} />
      </div>
      <Skeleton className="profile-skeleton-favourite-meta home_card-skeleton-shimmer" />
    </div>
  );
}

function SkeletonRows({ rows }) {
  return (
    <div className="profile_favourite-list">
      {rows.map((row, index) => (
        <SkeletonListRow key={index} {...row} />
      ))}
    </div>
  );
}

/** Used inside a list card while a later page is loading. */
export function ProfileFavouriteListSkeleton({ rows = VENDOR_ROWS }) {
  return (
    <div className="profile-favourites-skeleton-list" role="status" aria-label="Loading favourites" aria-busy="true">
      <SkeletonRows rows={rows.slice(0, 2)} />
    </div>
  );
}

/** Mirrors the favourites intro and both list cards with two rows each. */
export default function ProfileFavouritesSkeleton() {
  return (
    <section
      className="profile_section profile-favourites-skeleton"
      role="status"
      aria-label="Loading favourites"
      aria-busy="true"
    >
      <div className="profile_favourites-intro" aria-hidden="true">
        <LoadingLine width="92px" height={12} />
        <LoadingLine width="min(100%, 272px)" height={24} />
        <LoadingLine width="min(100%, 320px)" height={13} />
      </div>

      <div className="profile_favourites-grid" aria-hidden="true">
        <div className="profile_card">
          <SkeletonListHeader titleWidth="142px" />
          <SkeletonRows rows={VENDOR_ROWS} />
        </div>
        <div className="profile_card">
          <SkeletonListHeader titleWidth="128px" />
          <SkeletonRows rows={MEAL_ROWS} />
        </div>
      </div>
    </section>
  );
}
