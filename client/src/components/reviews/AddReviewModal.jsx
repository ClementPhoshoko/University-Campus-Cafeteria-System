import { useState } from 'react';
import { IconX, IconStarFilled, IconStar } from '@tabler/icons-react';
import './AddReviewModal.css';

export default function AddReviewModal({ isOpen, onClose, onSubmit, cafeteriaName }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ rating, comment });
      setRating(0);
      setComment('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setRating(0);
    setHoverRating(0);
    setComment('');
    onClose();
  };

  return (
    <div className="add-review-modal-overlay" onClick={handleClose}>
      <div className="add-review-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-review-modal__header">
          <div>
            <h2 className="add-review-modal__title">Write a Review</h2>
            <p className="add-review-modal__subtitle">for {cafeteriaName}</p>
          </div>
          <button type="button" className="add-review-modal__close" onClick={handleClose} aria-label="Close">
            <IconX size={20} stroke={2} />
          </button>
        </div>

        <div className="add-review-modal__body">
          <div className="add-review-modal__rating">
            <label className="add-review-modal__label">Your rating</label>
            <div className="add-review-modal__stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="add-review-modal__star"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  aria-label={`Rate ${star} stars`}
                >
                  {(hoverRating || rating) >= star ? (
                    <IconStarFilled size={28} stroke={0} />
                  ) : (
                    <IconStar size={28} stroke={1.5} />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="add-review-modal__comment">
            <label className="add-review-modal__label" htmlFor="review-comment">Your review</label>
            <textarea
              id="review-comment"
              className="add-review-modal__textarea"
              placeholder="Share your experience with this cafeteria..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <div className="add-review-modal__footer">
          <button
            type="button"
            className="add-review-modal__btn add-review-modal__btn--cancel"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="add-review-modal__btn add-review-modal__btn--submit"
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
