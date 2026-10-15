import { useEffect, useState } from 'react';
import { IconShoppingBag } from '@tabler/icons-react';
import CustomDropdown from '../../components/ui/CustomDropdown.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import { listCollectionSlots } from '../../services/employeeApi.js';
import './CartSummary.css';

const formatTime = (timestamp, timeZone) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', ...(timeZone ? { timeZone } : {}) });
};

const isSlotAvailable = (slot) => {
  return !slot.paused && (slot.reserved_count || 0) < (slot.capacity || Infinity);
};

function localDateKey(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export default function CartSummary({ subtotal, serviceFee, total, selectedSlot, now = Date.now(), timeZone, token, vendorLocationId, onSelectSlot, slots, itemCount, onPlaceOrder, disabled = false, updating = false }) {
  const [currentSlots, setCurrentSlots] = useState(slots);
  const [slotRefreshError, setSlotRefreshError] = useState('');

  useEffect(() => setCurrentSlots(slots), [slots]);

  const refreshSlots = async () => {
    if (!token || !vendorLocationId) return;
    setSlotRefreshError('');
    try {
      const response = await listCollectionSlots(vendorLocationId, { token });
      setCurrentSlots(response?.collectionSlots || []);
    } catch (error) {
      console.error('Failed to refresh collection slots:', error);
      setSlotRefreshError('Could not refresh collection times. Showing the last available schedule.');
    }
  };

  const nextMinute = Math.floor(now / 60_000) * 60_000 + 60_000;
  const today = localDateKey(now, timeZone);
  const upcomingSlots = currentSlots.filter((slot) => (
    localDateKey(slot.starts_at, timeZone) === today
    && new Date(slot.starts_at).getTime() >= nextMinute
  ));
  const slotOptions = upcomingSlots.map(slot => {
    const available = isSlotAvailable(slot);
    return {
      id: slot.id,
      name: formatTime(slot.starts_at, timeZone),
      timeRange: formatTime(slot.ends_at, timeZone),
      available,
    };
  });

  const handleSlotChange = (option) => {
    if (option) {
      onSelectSlot(option.id);
    }
  };

  const selectedSlotData = upcomingSlots.find(s => s.id === selectedSlot);

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
          value={selectedSlotData ? { id: selectedSlotData.id, name: `${formatTime(selectedSlotData.starts_at, timeZone)} - ${formatTime(selectedSlotData.ends_at, timeZone)}` } : null}
          onChange={handleSlotChange}
          onOpen={refreshSlots}
          placeholder={upcomingSlots.length ? 'Select time...' : 'No collection times available'}
          showClockIcon
        />
        {slotRefreshError && <p className="cart-summary__slot-empty" role="status">{slotRefreshError}</p>}
        {upcomingSlots.length === 0 && (
          <p className="cart-summary__slot-empty">
            No more collection times are available today.
          </p>
        )}
      </div>

      <button
        type="button"
        className="cart-summary__checkout"
        disabled={!selectedSlotData || disabled}
        onClick={onPlaceOrder}
      >
        <IconShoppingBag size={18} stroke={2} />
        <span>Proceed to Checkout</span>
      </button>
    </div>
  );
}
