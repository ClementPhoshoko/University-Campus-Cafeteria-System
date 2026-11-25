import PageContainer from '../../components/layout/PageContainer.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import '../../components/cards/CardSkeletonShimmer.css';
import './corporate-catering.css';

const SHIMMER = 'home_card-skeleton-shimmer';

function line(className = '') {
  return <Skeleton className={`${SHIMMER} corporate-skeleton-line ${className}`.trim()} />;
}

function SkeletonField() {
  return (
    <div className="corporate-skeleton-field">
      {line('corporate-skeleton-field-label')}
      {line('corporate-skeleton-control')}
    </div>
  );
}

function SkeletonCardHeading() {
  return (
    <div className="corporate-skeleton-card__heading">
      <Skeleton className={`${SHIMMER} corporate-skeleton-icon`} />
      <div className="corporate-skeleton-card__heading-copy">
        {line('corporate-skeleton-card-title')}
        {line('corporate-skeleton-card-subtitle')}
      </div>
    </div>
  );
}

export default function CorporateCateringSkeleton() {
  return (
    <PageContainer>
      <div className="corporate-skeleton-page" role="status" aria-label="Loading catering requests" aria-busy="true">
        <div className="corporate-skeleton-page__header" aria-hidden="true">
          <div className="corporate-skeleton-page__header-copy">
            {line('corporate-skeleton-line--eyebrow')}
            {line('corporate-skeleton-line--heading')}
            {line('corporate-skeleton-line--subheading')}
          </div>
          {line('corporate-skeleton-button')}
        </div>

        <div className="corporate-layout" aria-hidden="true">
          <div className="corporate-card">
            <SkeletonCardHeading />
            <div className="corporate-field-grid">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => <SkeletonField key={index} />)}
            </div>
            {line('corporate-skeleton-subheading')}
            <div className="corporate-menu-skeletons">
              {[0, 1, 2, 3].map((index) => (
                <div className="corporate-menu-skeleton" key={index}>
                  {line('corporate-skeleton-menu-label')}
                  {line('corporate-skeleton-line--input')}
                </div>
              ))}
            </div>
            <div className="corporate-skeleton-footer">
              {line('corporate-skeleton-footer-line')}
              {line('corporate-skeleton-button')}
            </div>
          </div>

          <div className="corporate-card">
            <SkeletonCardHeading />
            <div className="corporate-request-skeletons">
              {[0, 1, 2].map((index) => (
                <div className="corporate-request-skeleton" key={index}>
                  {line('corporate-skeleton-line--title')}
                  {line('corporate-skeleton-line')}
                  {line('corporate-skeleton-line--short')}
                </div>
              ))}
            </div>
            <div className="corporate-detail">
              {line('corporate-skeleton-line--title')}
              {line('corporate-skeleton-line')}
              {line('corporate-skeleton-line--short')}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
