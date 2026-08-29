import { IconClock, IconShoppingBag } from '@tabler/icons-react';
import { IconClock as IconClockOutline } from '@tabler/icons-react';
import CustomDropdown from '../../components/ui/CustomDropdown.jsx';
import './CartSummary.css';

export default function CartSummary({ subtotal, serviceFee, total, selectedSlot, onSelectSlot, slots, itemCount }) {
  const slotOptions = slots.map(slot => ({
    id: slot.id,
    name: slot.startsAt,
    timeRange: slot.endsAt,
    available: slot.available,
  }));

  const handleSlotChange = (option) => {
    if (option) {
      onSelectSlot(option.id);
    }
  };

  const selectedSlotData = slots.find(s => s.id === selectedSlot);

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

      <div className="cart-summary__slot">
        <CustomDropdown
          label="Collection Time"
          options={slotOptions}
          value={selectedSlotData ? { id: selectedSlotData.id, name: selectedSlotData.startsAt, timeRange: selectedSlotData.endsAt } : null}
          onChange={handleSlotChange}
          placeholder="Select time..."
          showClockIcon
        />
      </div>

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
