import { IconX, IconCheck, IconLeaf, IconFlame, IconInfoCircle } from '@tabler/icons-react';
import QuantitySelector from '../../components/ui/QuantitySelector.jsx';
import './CartItem.css';

export default function CartItem({ item, onUpdateQuantity, onRemove }) {
  const { menuItem, quantity, selectedOptions, specialInstructions } = item;

  const optionsTotal = selectedOptions.reduce((sum, opt) => sum + opt.priceDelta, 0);
  const lineTotal = (menuItem.basePrice + optionsTotal) * quantity;

  return (
    <div className="cart-item">
      <div className="cart-item__content">
        <div className="cart-item__image">
          {menuItem.image ? (
            <img src={menuItem.image} alt={menuItem.name} />
          ) : (
            <div className="cart-item__image-placeholder">
              <IconLeaf size={24} stroke={1.2} />
            </div>
          )}
        </div>

        <div className="cart-item__details">
          <div className="cart-item__header">
            <h3 className="cart-item__name">{menuItem.name}</h3>
            <button
              type="button"
              className="cart-item__remove"
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${menuItem.name}`}
            >
              <IconX size={16} stroke={1.8} />
            </button>
          </div>

          <p className="cart-item__description">{menuItem.description}</p>

          {selectedOptions.length > 0 && (
            <div className="cart-item__options">
              {selectedOptions.map((opt) => (
                <span key={opt.id} className="cart-item__option">
                  {opt.name}
                  {opt.priceDelta > 0 && (
                    <span className="cart-item__option-price">+R{opt.priceDelta.toFixed(2)}</span>
                  )}
                </span>
              ))}
            </div>
          )}

          {menuItem.dietaryTags.length > 0 && (
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

          {menuItem.allergens.length > 0 && (
            <div className="cart-item__allergens">
              <IconInfoCircle size={12} stroke={1.5} />
              <span>Contains: {menuItem.allergens.join(', ')}</span>
            </div>
          )}

          {specialInstructions && (
            <div className="cart-item__instructions">
              <span>Note:</span> {specialInstructions}
            </div>
          )}
        </div>

        <div className="cart-item__actions">
          <QuantitySelector
            value={quantity}
            onChange={(val) => onUpdateQuantity(item.id, val)}
            min={1}
            max={10}
          />
          <span className="cart-item__price">R{lineTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
