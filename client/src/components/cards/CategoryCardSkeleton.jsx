import './CategoryCard.css';
import './CardSkeletonShimmer.css';

export default function CategoryCardSkeleton() {
  return (
    <div className="home_category-card home_category-card--skeleton" aria-hidden="true">
      <span className="home_category-skeleton-name home_card-skeleton-shimmer" />
    </div>
  );
}
