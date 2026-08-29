import { Link } from 'react-router-dom';
import { IconX, IconCheck, IconLeaf, IconFlame } from '@tabler/icons-react';
import QuantitySelector from '../../components/ui/QuantitySelector.jsx';
import './CartItem.css';

export default function CartItem({ item, onUpdateQuantity, onRemove, to }) {
  const { menuItem, quantity, unitPriceSnapshot, selectedOptions, specialInstructions } = item;

  const formatPrice = (price) => {
    const numPrice = typeof price === 'string' ? parseFloat(price.toString().replace(/[^0-9.]/g, '')) : price;
    if (isNaN(numPrice)) return 'R0.00';
    return `R${numPrice.toFixed(2)}`;
  };

  const optionsTotal = selectedOptions.reduce((sum, opt) => sum + opt.priceDelta, 0);
  const lineTotal = (unitPriceSnapshot + optionsTotal) * quantity;

  const cardContent = (
    <>
      <div className="cart-item__image">
        {menuItem.image ? (
          <img src={menuItem.image} alt={menuItem.name} />
        ) : (
          <div className="cart-item__image-placeholder">
            <IconLeaf size={20} stroke={1.2} />
          </div>
        )}
      </div>

      <div className="cart-item__content">
        <div className="cart-item__section">
          <div className="cart-item__header">
            <div>
              <h3 className="cart-item__name">{menuItem.name}</h3>
              {menuItem.description && (
                <p className="cart-item__description">{menuItem.description}</p>
              )}
            </div>
            <button
              type="button"
              className="cart-item__remove"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove(item.id);
              }}
              aria-label={`Remove ${menuItem.name}`}
            >
              <IconX size={16} stroke={1.8} />
            </button>
          </div>
        </div>

        {selectedOptions.length > 0 && (
          <div className="cart-item__section">
            <span className="cart-item__section-label">Customizations</span>
            <div className="cart-item__options">
              {selectedOptions.map((opt) => (
                <span key={opt.id} className="cart-item__option">
                  {opt.name}
                  {opt.priceDelta > 0 && (
                    <span className="cart-item__option-price">+{formatPrice(opt.priceDelta)}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {(menuItem.dietaryTags?.length > 0 || menuItem.allergens?.length > 0) && (
          <div className="cart-item__section cart-item__section--row">
            {menuItem.dietaryTags?.length > 0 && (
              <div className="cart-item__tags">
                {menuItem.dietaryTags.map((tag) => (
                  <span key={tag} className="cart-item__tag">
                    {tag === 'Halal' && <IconCheck size={10} stroke={2} />}
                    {tag === 'High Protein' && <IconFlame size={10} stroke={2} />}
                    {tag === 'Vegetarian' && <IconLeaf size={10} stroke={2} />}
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {menuItem.allergens?.length > 0 && (
              <span className="cart-item__allergens">
                Contains: {menuItem.allergens.join(', ')}
              </span>
            )}
          </div>
        )}

        {specialInstructions && (
          <div className="cart-item__section">
            <span className="cart-item__instructions">{specialInstructions}</span>
          </div>
        )}

        <div className="cart-item__section cart-item__section--actions">
          <QuantitySelector
            value={quantity}
            onChange={(val) => onUpdateQuantity(item.id, val)}
            min={1}
            max={10}
          />
          <span className="cart-item__price">{formatPrice(lineTotal)}</span>
        </div>
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="cart-item cart-item--clickable">
        {cardContent}
      </Link>
    );
  }

  return <div className="cart-item">{cardContent}</div>;
}
