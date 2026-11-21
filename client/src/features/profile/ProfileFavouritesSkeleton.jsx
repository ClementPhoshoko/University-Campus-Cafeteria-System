import Skeleton from '../../components/ui/Skeleton.jsx';
import '../../components/cards/CardSkeletonShimmer.css';
import './profile-skeletons.css';

function LoadingLine({ width, height = 12, className = '' }) {
  return <Skeleton className={`home_card-skeleton-shimmer ${className}`} style={{ width, height }} />;
}

function SkeletonListHeader() {
  return (
    <div className="profile_card-header" aria-hidden="true">
      <LoadingLine className="profile-skeleton-favourite-title" width="128px" height={16} />
      <Skeleton className="profile-skeleton-favourite-count home_card-skeleton-shimmer" />
    </div>
  );
}

function SkeletonListRow({ index }) {
  return (
    <div className="profile_favourite-item" aria-hidden="true">
      <div>
        <div className="profile_favourite-title-row">
          <LoadingLine
            className="profile-skeleton-favourite-name"
            width={index % 2 === 0 ? '62%' : '48%'}
            height={13}
          />
          <Skeleton className="profile-skeleton-favourite-remove home_card-skeleton-shimmer" />
        </div>
        <LoadingLine
          className="profile-skeleton-favourite-detail"
          width={index % 2 === 0 ? '44%' : '56%'}
          height={10}
        />
      </div>
      <Skeleton className="profile-skeleton-favourite-meta home_card-skeleton-shimmer" />
    </div>
  );
}

function SkeletonRows({ rows }) {
  return (
    <div className="profile_favourite-list">
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonListRow key={index} index={index} />
      ))}
    </div>
  );
}

function SkeletonPagination() {
  return (
    <div className="profile_pagination" aria-hidden="true">
      <LoadingLine width="58px" height={20} />
      <LoadingLine width="84px" height={10} />
      <LoadingLine width="44px" height={20} />
    </div>
  );
}

/** Used inside a list card while a later page is loading. */
export function ProfileFavouriteListSkeleton({ rows = 3 }) {
  return (
    <div className="profile-favourites-skeleton-list" role="status" aria-label="Loading favourites" aria-busy="true">
      <SkeletonRows rows={rows} />
    </div>
  );
}

/** Mirrors the favourites intro and two list cards while both reads are in flight. */
export default function ProfileFavouritesSkeleton() {
  return (
    <section
      className="profile_section profile-favourites-skeleton"
      role="status"
      aria-label="Loading favourites"
      aria-busy="true"
    >
      <div className="profile_favourites-intro" aria-hidden="true">
        <LoadingLine width="92px" height={11} />
        <LoadingLine width="min(100%, 272px)" height={22} />
        <LoadingLine width="min(100%, 320px)" height={12} />
      </div>

      <div className="profile_favourites-grid" aria-hidden="true">
        <div className="profile_card">
          <SkeletonListHeader />
          <SkeletonRows rows={3} />
          <SkeletonPagination />
        </div>
        <div className="profile_card">
          <SkeletonListHeader />
          <SkeletonRows rows={3} />
          <SkeletonPagination />
        </div>
      </div>
    </section>
  );
}
