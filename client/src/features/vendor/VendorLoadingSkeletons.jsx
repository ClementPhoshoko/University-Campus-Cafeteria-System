import Skeleton from '../../components/ui/Skeleton.jsx';
import '../../components/cards/CardSkeletonShimmer.css';

function LoadingLine({ width, height = 12, className = '' }) {
  return <Skeleton className={`home_card-skeleton-shimmer ${className}`} style={{ width, height }} />;
}

function SummaryCardSkeleton() {
  return <div className="vendor-summary-card" aria-hidden="true">
    <Skeleton className="vendor-summary-card__icon home_card-skeleton-shimmer" />
    <div className="vendor-loading-summary-copy">
      <LoadingLine width="72%" height={12} />
      <LoadingLine width="42%" height={22} />
      <LoadingLine width="88%" height={10} />
    </div>
  </div>;
}

export function VendorSummarySkeleton() {
  return <div className="vendor-ops-summary" role="status" aria-label="Loading order summary">
    {Array.from({ length: 4 }, (_, index) => <SummaryCardSkeleton key={index} />)}
  </div>;
}

function SectionHeadingSkeleton({ descriptionWidth }) {
  return <div className="vendor-ops-section__heading" aria-hidden="true">
    <div className="vendor-ops-section__title-wrap">
      <Skeleton className="vendor-ops-section__icon home_card-skeleton-shimmer" />
      <div className="vendor-loading-section-copy">
        <LoadingLine width="146px" height={16} />
        <LoadingLine width={descriptionWidth} height={11} />
      </div>
    </div>
    <Skeleton className="vendor-loading-refresh home_card-skeleton-shimmer" />
  </div>;
}

function OrderRowSkeleton() {
  return <article className="vendor-order-card vendor-order-card--loading" aria-hidden="true">
    <div className="vendor-order-card__summary">
      <span className="vendor-order-card__summary-identity">
        <LoadingLine width="104px" height={13} />
        <LoadingLine width="148px" height={10} />
      </span>
      <LoadingLine className="vendor-order-card__summary-time" width="90px" height={12} />
      <Skeleton className="vendor-loading-status home_card-skeleton-shimmer" />
      <LoadingLine className="vendor-order-card__summary-total" width="52px" height={14} />
      <Skeleton className="vendor-loading-chevron home_card-skeleton-shimmer" />
    </div>
  </article>;
}

export function VendorQueueSkeleton() {
  return <div className="vendor-order-skeleton-list" role="status" aria-label="Loading orders">
    {Array.from({ length: 5 }, (_, index) => <OrderRowSkeleton key={index} />)}
  </div>;
}

function MenuRowSkeleton() {
  return <div className="vendor-menu-item-wrap" aria-hidden="true">
    <article className="vendor-menu-item">
      <div className="vendor-menu-item__main">
        <div className="vendor-loading-menu-copy">
          <LoadingLine width="62%" height={15} />
          <LoadingLine width="78%" height={11} />
        </div>
        <Skeleton className="vendor-loading-status home_card-skeleton-shimmer" />
      </div>
      <div className="vendor-menu-item__controls">
        <div className="vendor-loading-menu-field"><LoadingLine width="68px" height={10} /><Skeleton className="vendor-loading-input home_card-skeleton-shimmer" /></div>
        <Skeleton className="vendor-loading-button home_card-skeleton-shimmer" />
      </div>
    </article>
    <div className="vendor-menu-item-wrap__actions">
      <Skeleton className="vendor-loading-button home_card-skeleton-shimmer" />
      <Skeleton className="vendor-loading-button home_card-skeleton-shimmer" />
    </div>
  </div>;
}

export function VendorMenuItemsSkeleton() {
  return <div className="vendor-menu-skeleton-list" role="status" aria-label="Loading menu items">
    {Array.from({ length: 4 }, (_, index) => <MenuRowSkeleton key={index} />)}
  </div>;
}

export function VendorDashboardSkeleton() {
  return <div className="vendor-dashboard-skeleton" role="status" aria-label="Loading vendor dashboard" aria-busy="true">
    <section className="page-header has-actions" aria-hidden="true">
      <div>
        <div className="page-header-heading">
          <LoadingLine width="112px" height={11} />
          <LoadingLine width="248px" height={27} />
        </div>
        <LoadingLine className="page-header-subtitle" width="min(100%, 470px)" height={14} />
      </div>
      <div className="page-header-actions vendor-loading-header-actions">
        <Skeleton className="vendor-loading-header-control home_card-skeleton-shimmer" />
        <Skeleton className="vendor-loading-header-control home_card-skeleton-shimmer" />
      </div>
    </section>

    <VendorSummarySkeleton />

    <div className="vendor-ops-grid" aria-hidden="true">
      <section className="vendor-ops-section vendor-ops-section--queue">
        <SectionHeadingSkeleton descriptionWidth="212px" />
        <div className="vendor-queue-filters vendor-loading-filters">
          {[104, 132, 122].map((width) => <Skeleton key={width} className="vendor-loading-filter home_card-skeleton-shimmer" style={{ width }} />)}
        </div>
        <div className="vendor-queue-list">
          <VendorQueueSkeleton />
          <div className="vendor-list-pagination-slot"><Skeleton className="vendor-loading-pagination home_card-skeleton-shimmer" /></div>
        </div>
      </section>

      <section className="vendor-ops-section vendor-ops-section--menu">
        <SectionHeadingSkeleton descriptionWidth="190px" />
        <div className="vendor-menu-list">
          <VendorMenuItemsSkeleton />
        </div>
      </section>
    </div>
  </div>;
}

export function VendorTeamInvitationsSkeleton() {
  return <div className="vendor-team__loading" role="status" aria-label="Loading staff invitations">
    {Array.from({ length: 3 }, (_, index) => <article className="vendor-team__invitation" key={index} aria-hidden="true">
      <div><LoadingLine width="min(100%, 188px)" height={13} /><LoadingLine width="min(100%, 232px)" height={11} /></div>
      <Skeleton className="vendor-loading-button home_card-skeleton-shimmer" />
    </article>)}
  </div>;
}
