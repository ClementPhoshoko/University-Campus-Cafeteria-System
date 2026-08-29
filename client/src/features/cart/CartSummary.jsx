import { IconClock, IconShoppingBag } from '@tabler/icons-react';
import './CartSummary.css';

export default function CartSummary({ subtotal, serviceFee, total, selectedSlot, itemCount }) {
  return (
    <div className="cart-summary">
      <div className="cart-summary__header">
        <h2 className="cart-summary__title">Order Summary</h2>
        <span className="cart-summary__count">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
      </div>

      <div className="cart-summary__lines">
        <div className="cart-summary__line">
          <span className="cart-summary__label">Subtotal</span>
          <span className="cart-summary__value">R{subtotal.toFixed(2)}</span>
        </div>
        <div className="cart-summary__line">
          <span className="cart-summary__label">Service Fee</span>
          <span className="cart-summary__value">R{serviceFee.toFixed(2)}</span>
        </div>
      </div>

      <div className="cart-summary__divider" />

      <div className="cart-summary__line cart-summary__line--total">
        <span className="cart-summary__label">Total</span>
        <span className="cart-summary__value">R{total.toFixed(2)}</span>
      </div>

      {selectedSlot && (
        <div className="cart-summary__slot">
          <IconClock size={14} stroke={1.5} />
          <span>Collect at {selectedSlot.startsAt} - {selectedSlot.endsAt}</span>
        </div>
      )}

      <button
        type="button"
        className="cart-summary__checkout"
        disabled={!selectedSlot}
      >
        <IconShoppingBag size={18} stroke={2} />
        <span>Proceed to Checkout</span>
      </button>
    </div>
  );
}
