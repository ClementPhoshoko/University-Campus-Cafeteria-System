import { IconStar, IconStarFilled } from '@tabler/icons-react';
import './ReviewItem.css';

export default function ReviewItem({ name, stars, role, text, animState }) {
  return (
    <div className="home_review-item" data-state={animState}>
      <div className="home_review-body">
        <div className="home_review-head">
          <span className="home_review-name">{name}</span>
          <span className="home_review-stars">
            {Array.from({ length: 5 }, (_, i) =>
              i < stars
                ? <IconStarFilled key={i} size={13} stroke={0} />
                : <IconStar key={i} size={13} stroke={1.5} />
            )}
          </span>
        </div>
        <span className="home_review-role">{role}</span>
        <p className="home_review-text">{text}</p>
      </div>
    </div>
  );
}
