import { Link } from 'react-router-dom';
import { IconX, IconCheck, IconLeaf, IconFlame } from '@tabler/icons-react';
import QuantitySelector from '../../components/ui/QuantitySelector.jsx';
import SmartImage from '../../components/ui/SmartImage.jsx';
import './CartItem.css';

export default function CartItem({ item, onUpdateQuantity, onRemove, onImageError, to }) {
  const { menuItem, quantity, unitPriceSnapshot, selectedOptions, specialInstructions } = item;

  const formatPrice = (price) => {
    const numPrice = typeof price === 'string'
      ? parseFloat(price.toString().replace(/[^0-9.]/g, ''))
      : Number(price);
    if (!Number.isFinite(numPrice)) return 'Price unavailable';
    return `R${numPrice.toFixed(2)}`;
  };

  const snapshotPrice = unitPriceSnapshot === null || unitPriceSnapshot === undefined || unitPriceSnapshot === ''
    ? NaN
    : Number(unitPriceSnapshot);
  const currentMenuPrice = menuItem?.base_price === null || menuItem?.base_price === undefined || menuItem?.base_price === ''
    ? NaN
    : Number(menuItem.base_price);
  const unitPrice = Number.isFinite(snapshotPrice) && snapshotPrice >= 0
    ? snapshotPrice
    : currentMenuPrice;
  const optionsTotal = selectedOptions.reduce(
    (sum, opt) => sum + (Number(opt.priceDelta) || 0) * (Number(opt.quantity) || 1),
    0,
  );
  const lineTotal = Number.isFinite(unitPrice) ? (unitPrice + optionsTotal) * quantity : NaN;

  return (
    <div className="cart-item">
      <Link to={to} className="cart-item__image">
        {menuItem.image_url ? (
          <SmartImage
            src={menuItem.image_url}
            alt={menuItem.name}
            width={100}
            height={100}
            onError={onImageError ? () => onImageError(item.id, menuItem.image_url) : undefined}
          />
        ) : (
          <div className="cart-item__image-placeholder">
            <IconLeaf size={20} stroke={1.2} />
          </div>
        )}
      </Link>

      <div className="cart-item__content">
        <div className="cart-item__section">
          <div className="cart-item__header">
            <div>
              <Link to={to} className="cart-item__name-link">
                <h3 className="cart-item__name">{menuItem.name}</h3>
              </Link>
              {menuItem.description && (
                <p className="cart-item__description">{menuItem.description}</p>
              )}
            </div>
            <button
              type="button"
              className="cart-item__remove"
              onClick={() => onRemove(item.id)}
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
                  {opt.quantity > 1 && <span> × {opt.quantity}</span>}
                  {opt.priceDelta > 0 && (
                    <span className="cart-item__option-price">
                      +{formatPrice(opt.priceDelta * (opt.quantity || 1))}
                    </span>
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
    </div>
  );
}
