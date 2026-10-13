import './CafeteriaCard.css';
import './FoodCard.css';
import './CardSkeletonShimmer.css';

export default function FoodCardSkeleton() {
  return (
    <div className="home_vendor-card home_meal-card home_vendor-card--skeleton" aria-hidden="true">
      <div className="home_vendor-media home_meal-skeleton-media home_card-skeleton-shimmer" />
      <div className="home_vendor-body home_meal-skeleton-body">
        <span className="home_vendor-skeleton-line home_vendor-skeleton-title home_card-skeleton-shimmer" />
        <span className="home_vendor-skeleton-line home_meal-skeleton-subtitle home_card-skeleton-shimmer" />
        <div className="home_vendor-divider" />
        <div className="home_meal-footer">
          <span className="home_vendor-skeleton-line home_meal-skeleton-price home_card-skeleton-shimmer" />
          <span className="home_meal-skeleton-action home_card-skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}
