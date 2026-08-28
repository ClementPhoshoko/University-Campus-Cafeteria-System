import { IconMinus, IconPlus } from '@tabler/icons-react';
import './QuantitySelector.css';

export default function QuantitySelector({ value = 1, onChange, min = 1, max = 10, disabled }) {
  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  return (
    <div className={`quantity-selector${disabled ? ' quantity-selector--disabled' : ''}`}>
      <button
        type="button"
        className="quantity-selector__btn quantity-selector__btn--decrement"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
      >
        <IconMinus size={16} stroke={2.5} />
      </button>

      <span className="quantity-selector__value" aria-live="polite">
        {value}
      </span>

      <button
        type="button"
        className="quantity-selector__btn quantity-selector__btn--increment"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
      >
        <IconPlus size={16} stroke={2.5} />
      </button>
    </div>
  );
}
