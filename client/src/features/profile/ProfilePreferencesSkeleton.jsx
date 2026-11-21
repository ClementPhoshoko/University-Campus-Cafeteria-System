import Skeleton from '../../components/ui/Skeleton.jsx';
import '../../components/cards/CardSkeletonShimmer.css';
import './profile-skeletons.css';

const TAG_GROUPS = [
  { labelWidth: '116px', tags: ['86px', '64px'] },
  { labelWidth: '108px', tags: ['72px', '96px'] },
];

const TOGGLE_ROWS = [
  { labelWidth: '96px', descriptionWidth: 'min(100%, 248px)' },
  { labelWidth: '126px', descriptionWidth: 'min(100%, 236px)' },
  { labelWidth: '132px', descriptionWidth: 'min(100%, 276px)' },
  { labelWidth: '124px', descriptionWidth: 'min(100%, 300px)' },
];

function LoadingLine({ width, height, className = '' }) {
  return <Skeleton className={`home_card-skeleton-shimmer ${className}`} style={{ width, height }} />;
}

function SkeletonCardHeader({ titleWidth, withEdit = false }) {
  return (
    <div className="profile_card-header" aria-hidden="true">
      <div className="profile_card-heading">
        <Skeleton className="profile-skeleton-icon home_card-skeleton-shimmer" />
        <LoadingLine className="profile-skeleton-preference-title" width={titleWidth} height={18} />
      </div>
      {withEdit && <Skeleton className="profile-skeleton-action home_card-skeleton-shimmer" />}
    </div>
  );
}

function SkeletonTagGroup({ labelWidth, tags }) {
  return (
    <div className="profile_tag-group" aria-hidden="true">
      <LoadingLine className="profile-skeleton-preference-label" width={labelWidth} height={12} />
      <div className="profile_tag-list">
        {tags.map((width, index) => (
          <LoadingLine key={index} className="profile-skeleton-preference-tag" width={width} height={16} />
        ))}
      </div>
    </div>
  );
}

function SkeletonToggleRow({ labelWidth, descriptionWidth }) {
  return (
    <div className="profile_toggle" aria-hidden="true">
      <div className="profile_toggle-text">
        <LoadingLine className="profile-skeleton-preference-label" width={labelWidth} height={14} />
        <LoadingLine className="profile-skeleton-preference-description" width={descriptionWidth} height={11} />
      </div>
      <Skeleton className="profile-skeleton-preference-switch home_card-skeleton-shimmer" />
    </div>
  );
}

/** Mirrors the food-preference and notification-preference cards while the profile loads. */
export default function ProfilePreferencesSkeleton() {
  return (
    <section
      className="profile_section profile-preferences-skeleton"
      role="status"
      aria-label="Loading preferences"
      aria-busy="true"
    >
      <div className="profile_card profile_card--feature" aria-hidden="true">
        <SkeletonCardHeader titleWidth="128px" withEdit />
        {TAG_GROUPS.map((group, index) => (
          <SkeletonTagGroup key={index} {...group} />
        ))}
        <LoadingLine className="profile-skeleton-preference-note" width="min(100%, 360px)" height={12} />
      </div>

      <div className="profile_card profile_card--quiet" aria-hidden="true">
        <SkeletonCardHeader titleWidth="184px" />
        <div className="profile_toggle-list">
          {TOGGLE_ROWS.map((row, index) => (
            <SkeletonToggleRow key={index} {...row} />
          ))}
        </div>
      </div>
    </section>
  );
}
