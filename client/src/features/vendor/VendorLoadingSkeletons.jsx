import Skeleton from '../../components/ui/Skeleton.jsx';
import '../../components/cards/CardSkeletonShimmer.css';
import './vendor-manager-skeletons.css';

const MANAGER_SKELETON_ROWS = 8;

function LoadingLine({ width, height = 12, className = '' }) {
  return <Skeleton className={`home_card-skeleton-shimmer ${className}`} style={{ width, height }} />;
}

function SkeletonCopy({ titleWidth, descriptionWidth, titleHeight = 16 }) {
  return <div className="vendor-manager-skeleton-copy" aria-hidden="true">
    <LoadingLine width={titleWidth} height={titleHeight} />
    <LoadingLine width={descriptionWidth} height={11} />
  </div>;
}

export function VendorStockPageSkeleton() {
  const itemWidths = ['64%', '78%', '58%', '72%', '66%', '60%', '74%', '62%'];

  return <>
    <section className="vendor-stock-page__card" role="status" aria-label="Loading collection location" aria-busy="true">
      <header className="vendor-stock-page__card-heading" aria-hidden="true">
        <Skeleton className="vendor-manager-skeleton-icon home_card-skeleton-shimmer" />
        <SkeletonCopy titleWidth="184px" descriptionWidth="min(100%, 430px)" />
      </header>
      <div className="vendor-stock-page__location-grid" aria-hidden="true">
        <div className="vendor-stock-page__field">
          <LoadingLine width="132px" height={11} />
          <Skeleton className="vendor-manager-skeleton-control home_card-skeleton-shimmer" />
        </div>
        <div className="vendor-stock-page__metrics">
          {Array.from({ length: 3 }, (_, index) => <article key={index}>
            <LoadingLine width="72%" height={10} />
            <LoadingLine width="34px" height={20} />
          </article>)}
        </div>
        <div className="vendor-stock-page__tracking vendor-manager-skeleton-tracking">
          <Skeleton className="vendor-manager-skeleton-checkbox home_card-skeleton-shimmer" />
          <SkeletonCopy titleWidth="196px" descriptionWidth="min(100%, 390px)" titleHeight={13} />
        </div>
      </div>
    </section>

    <section className="vendor-stock-page__card" role="status" aria-label="Loading stock by menu item" aria-busy="true">
      <header className="vendor-stock-page__card-heading vendor-stock-page__card-heading--split" aria-hidden="true">
        <div className="vendor-stock-page__title-copy">
          <SkeletonCopy titleWidth="166px" descriptionWidth="min(100%, 420px)" />
        </div>
        <div className="vendor-stock-page__table-actions">
          <div className="vendor-stock-page__reason">
            <LoadingLine width="104px" height={11} />
            <Skeleton className="vendor-manager-skeleton-input home_card-skeleton-shimmer" />
          </div>
          <Skeleton className="vendor-manager-skeleton-refresh home_card-skeleton-shimmer" />
        </div>
      </header>
      <div className="vendor-stock-page__table" aria-hidden="true">
        <div className="vendor-stock-page__table-head">
          <LoadingLine width="74px" height={9} />
          <LoadingLine width="48px" height={9} />
          <LoadingLine width="54px" height={9} />
          <LoadingLine width="56px" height={9} />
          <LoadingLine width="44px" height={9} />
          <LoadingLine width="52px" height={9} />
        </div>
        {Array.from({ length: MANAGER_SKELETON_ROWS }, (_, index) => (
          <div className="vendor-stock-page__table-row vendor-manager-skeleton-row" key={index}>
            <span className="vendor-stock-page__item">
              <LoadingLine width={itemWidths[index]} height={13} />
              {index % 4 === 0 && <LoadingLine width="74px" height={9} />}
            </span>
            <span className="vendor-manager-skeleton-cell--center">
              <Skeleton className="vendor-manager-skeleton-quantity home_card-skeleton-shimmer" />
            </span>
            <span className="vendor-manager-skeleton-cell--center"><LoadingLine width="28px" height={11} /></span>
            <span className="vendor-manager-skeleton-cell--center"><LoadingLine width="28px" height={11} /></span>
            <span className="vendor-manager-skeleton-cell--center">
              <Skeleton className="vendor-manager-skeleton-pill home_card-skeleton-shimmer" />
            </span>
            <span className="vendor-manager-skeleton-cell--right">
              <Skeleton className="vendor-manager-skeleton-button home_card-skeleton-shimmer" />
            </span>
          </div>
        ))}
      </div>
      <div className="vendor-stock-page__pagination" aria-hidden="true">
        <Skeleton className="vendor-manager-skeleton-pagination home_card-skeleton-shimmer" />
      </div>
    </section>
  </>;
}

export function VendorCollectionSlotsPageSkeleton() {
  const timeWidths = ['112px', '136px', '104px', '124px', '118px', '108px', '132px', '116px'];

  return <>
    <section className="vendor-slots-page__card" role="status" aria-label="Loading collection location" aria-busy="true">
      <header className="vendor-slots-page__card-heading" aria-hidden="true">
        <Skeleton className="vendor-manager-skeleton-icon home_card-skeleton-shimmer" />
        <SkeletonCopy titleWidth="184px" descriptionWidth="min(100%, 390px)" />
      </header>
      <div className="vendor-slots-page__location-grid" aria-hidden="true">
        <div className="vendor-slots-page__field">
          <LoadingLine width="132px" height={11} />
          <Skeleton className="vendor-manager-skeleton-control home_card-skeleton-shimmer" />
        </div>
        <div className="vendor-slots-page__metrics">
          {Array.from({ length: 4 }, (_, index) => <article key={index}>
            <LoadingLine width="72%" height={10} />
            <LoadingLine width="34px" height={20} />
          </article>)}
        </div>
      </div>
    </section>

    <section className="vendor-slots-page__card" role="status" aria-label="Loading upcoming collection times" aria-busy="true">
      <header className="vendor-slots-page__card-heading vendor-slots-page__card-heading--split" aria-hidden="true">
        <div className="vendor-slots-page__title-copy">
          <SkeletonCopy titleWidth="186px" descriptionWidth="min(100%, 430px)" />
        </div>
        <div className="vendor-slots-page__table-actions">
          <div className="vendor-slots-page__reason">
            <LoadingLine width="92px" height={11} />
            <Skeleton className="vendor-manager-skeleton-input home_card-skeleton-shimmer" />
          </div>
          <Skeleton className="vendor-manager-skeleton-refresh home_card-skeleton-shimmer" />
        </div>
      </header>
      <div className="vendor-slots-page__table" aria-hidden="true">
        <div className="vendor-slots-page__table-head">
          <LoadingLine width="102px" height={9} />
          <LoadingLine width="68px" height={9} />
          <LoadingLine width="42px" height={9} />
          <LoadingLine width="48px" height={9} />
        </div>
        {Array.from({ length: MANAGER_SKELETON_ROWS }, (_, index) => (
          <div className="vendor-slots-page__table-row vendor-manager-skeleton-row" key={index}>
            <span className="vendor-slots-page__time">
              <LoadingLine width={timeWidths[index]} height={13} />
              <LoadingLine width="78px" height={9} />
            </span>
            <span>
              <span className="vendor-manager-skeleton-capacity"><LoadingLine width="88px" height={10} /></span>
              <Skeleton className="vendor-manager-skeleton-track home_card-skeleton-shimmer" />
            </span>
            <span className="vendor-manager-skeleton-cell--center">
              <Skeleton className="vendor-manager-skeleton-badge home_card-skeleton-shimmer" />
            </span>
            <span className="vendor-manager-skeleton-cell--right">
              <Skeleton className="vendor-manager-skeleton-button home_card-skeleton-shimmer" />
            </span>
          </div>
        ))}
      </div>
      <div className="vendor-slots-page__pagination" aria-hidden="true">
        <Skeleton className="vendor-manager-skeleton-pagination home_card-skeleton-shimmer" />
      </div>
    </section>
  </>;
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
      <div className="vendor-menu-item__content">
        <Skeleton className="vendor-menu-item__image home_card-skeleton-shimmer" />
        <div className="vendor-menu-item__details">
          <div className="vendor-menu-item__heading">
            <div className="vendor-loading-menu-copy">
              <LoadingLine width="62%" height={15} />
              <LoadingLine width="78%" height={11} />
            </div>
            <Skeleton className="vendor-loading-status home_card-skeleton-shimmer" />
          </div>
        </div>
      </div>
      <div className="vendor-menu-item__footer">
        <div className="vendor-menu-item__availability">
          <Skeleton className="vendor-loading-input home_card-skeleton-shimmer" />
        </div>
        <div className="vendor-menu-item__actions">
          <Skeleton className="vendor-loading-button home_card-skeleton-shimmer" />
          <Skeleton className="vendor-loading-button home_card-skeleton-shimmer" />
        </div>
      </div>
    </article>
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

export function VendorTeamInvitationsSkeleton({ label = 'Loading staff invitations' }) {
  return <div className="vendor-team__loading" role="status" aria-label={label}>
    {Array.from({ length: 3 }, (_, index) => <article className="vendor-team__invitation" key={index} aria-hidden="true">
      <div><LoadingLine width="min(100%, 188px)" height={13} /><LoadingLine width="min(100%, 232px)" height={11} /></div>
      <Skeleton className="vendor-loading-button home_card-skeleton-shimmer" />
    </article>)}
  </div>;
}
