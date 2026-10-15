import { IconShoppingBag } from '@tabler/icons-react';
import CustomDropdown from '../../components/ui/CustomDropdown.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import './CartSummary.css';

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const isSlotAvailable = (slot) => {
  return !slot.paused && (slot.reserved_count || 0) < (slot.capacity || Infinity);
};

export default function CartSummary({ subtotal, serviceFee, total, selectedSlot, onSelectSlot, slots, itemCount, onPlaceOrder, disabled = false, updating = false }) {
  const slotOptions = slots.map(slot => {
    const available = isSlotAvailable(slot);
    return {
      id: slot.id,
      name: formatTime(slot.starts_at),
      timeRange: formatTime(slot.ends_at),
      available,
    };
  });

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
          {updating
            ? <Skeleton className="cart-summary__value-skeleton home_card-skeleton-shimmer" style={{ width: 68, height: 14 }} aria-label="Updating service fee" />
            : <span className="cart-summary__value">R{serviceFee.toFixed(2)}</span>}
        </div>
      </div>

      <div className="cart-summary__divider" />

      <div className="cart-summary__line cart-summary__line--total">
        <span className="cart-summary__label">Total</span>
        {updating
          ? <Skeleton className="cart-summary__value-skeleton cart-summary__value-skeleton--total home_card-skeleton-shimmer" style={{ width: 82, height: 16 }} aria-label="Updating total" />
          : <span className="cart-summary__value">R{total.toFixed(2)}</span>}
      </div>

      <div className="cart-summary__slot">
        <CustomDropdown
          label="Collection Time"
          options={slotOptions}
          value={selectedSlotData ? { id: selectedSlotData.id, name: `${formatTime(selectedSlotData.starts_at)} - ${formatTime(selectedSlotData.ends_at)}` } : null}
          onChange={handleSlotChange}
          placeholder={slots.length ? 'Select time...' : 'No collection times available'}
          showClockIcon
        />
        {slots.length === 0 && (
          <p className="cart-summary__slot-empty">
            This cafeteria has no upcoming collection times scheduled.
          </p>
        )}
      </div>

      <button
        type="button"
        className="cart-summary__checkout"
        disabled={!selectedSlot || disabled}
        onClick={onPlaceOrder}
      >
        <IconShoppingBag size={18} stroke={2} />
        <span>Proceed to Checkout</span>
      </button>
    </div>
  );
}
