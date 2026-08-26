import { IconPlus } from '@tabler/icons-react';
import './FoodCard.css';

export default function FoodCard({ id, name, price, vendor, image, bestSeller }) {
  return (
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
}
