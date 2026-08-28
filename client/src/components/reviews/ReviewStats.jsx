import { IconStarFilled, IconStar } from '@tabler/icons-react';
import './ReviewStats.css';

export default function ReviewStats({ rating, totalReviews, ratingBreakdown, selectedRating, onRatingClick }) {
  const stars = [5, 4, 3, 2, 1];

  return (
    <div className="review-stats">
      <div className="review-stats-card">
        <div className="review-stats-overview">
          <span className="review-stats-rating">{rating.toFixed(1)}</span>
          <div className="review-stats-meta">
            <span className="review-stats-count">{totalReviews}</span>
            <span className="review-stats-label-text">reviews</span>
          </div>
        </div>

        <div className="review-stats-breakdown">
          {stars.map((star) => {
            const count = ratingBreakdown?.[star] || 0;
            const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
            const isSelected = selectedRating === star;
            return (
              <button
                key={star}
                type="button"
                className={`review-stats-row${isSelected ? ' review-stats-row--selected' : ''}`}
                onClick={() => onRatingClick(isSelected ? null : star)}
                aria-pressed={isSelected}
              >
                <span className="review-stats-label">{star}</span>
                <IconStarFilled size={12} stroke={0} className="review-stats-star-icon" />
                <div className="review-stats-bar">
                  <div className="review-stats-bar-fill" style={{ width: `${percentage}%` }} />
                </div>
                <span className="review-stats-count">{count}</span>
              </button>
            );
          })}
        </div>

        {selectedRating && (
          <button
            type="button"
            className="review-stats-clear"
            onClick={() => onRatingClick(null)}
          >
            Show all reviews
          </button>
        )}
      </div>
    </div>
  );
}
