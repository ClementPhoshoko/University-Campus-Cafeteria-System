import { IconCheck, IconPlus } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import './FoodCard.css';

export default function FoodCard({
  id,
  name,
  price,
  vendor,
  image,
  bestSeller,
  description,
  status = 'available',
  prepMinutes,
  dietaryTags = [],
  variant = 'default',
  added = false,
  onAdd,
  to,
}) {
  if (variant === 'browse') {
    const unavailable = status !== 'available' || !onAdd;

    const cardContent = (
      <>
        <div className="food_browse-image-wrap">
          {bestSeller && <span className="home_best-seller">Best Seller</span>}
          <img src={image} alt={name} className="food_browse-image" loading="lazy" />
        </div>
        <div className="food_browse-content">
          <div className="food_browse-heading">
            <h3 className="food_browse-name">{name}</h3>
            {status !== 'available' && (
              <span className="food_browse-status">{status === 'sold_out' ? 'Sold out' : 'Unavailable'}</span>
            )}
          </div>
          <p className="food_browse-description">{description}</p>
          {dietaryTags.length > 0 && (
            <div className="food_browse-tags" aria-label="Dietary information">
              {dietaryTags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          )}
          <div className="food_browse-footer">
            <div className="food_browse-price-meta">
              <span className="food_browse-price">{price}</span>
              {prepMinutes && <span className="food_browse-prep">{prepMinutes} min</span>}
            </div>
            <button
              type="button"
              className={`food_browse-add${added ? ' food_browse-add--added' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAdd?.();
              }}
              disabled={unavailable}
              aria-label={added ? `${name} added to cart` : `Add ${name} to cart`}
            >
              {added ? <IconCheck size={18} stroke={2.2} /> : <IconPlus size={18} stroke={2.2} />}
            </button>
          </div>
        </div>
      </>
    );

    if (to) {
      return (
        <Link to={to} className={`food_browse-item${unavailable ? ' food_browse-item--unavailable' : ''}`}>
          {cardContent}
        </Link>
      );
    }

    return (
      <article className={`food_browse-item${unavailable ? ' food_browse-item--unavailable' : ''}`}>
        {cardContent}
      </article>
    );
  }

  const cardContent = (
    <div className="home_vendor-card home_meal-card">
      {bestSeller && <span className="home_best-seller">Best Seller</span>}
      <div className="home_vendor-media">
        <img src={image} alt={name} loading="lazy" />
      </div>

      <div className="home_vendor-body">
        <h3>{name}</h3>
        <p className="home_vendor-subtitle">{vendor}</p>
        <div className="home_vendor-divider" />
        <div className="home_meal-footer">
          <span className="home_meal-price">{price}</span>
          <button type="button" className="home_add-btn" aria-label={`Add ${name} to cart`}>
            <IconPlus size={18} stroke={2.2} />
          </button>
        </div>
      </div>
    </div>
  );

  if (to) {
    return <Link to={to} className="home_meal-card-link">{cardContent}</Link>;
  }

  return cardContent;
}
