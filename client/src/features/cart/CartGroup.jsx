import { useState } from 'react';
import CartItem from './CartItem.jsx';
import CartSummary from './CartSummary.jsx';
import SmartImage from '../../components/ui/SmartImage.jsx';

function formatExpiry(timestamp, now) {
  if (!timestamp) return '';
  const diff = new Date(timestamp).getTime() - now;
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

export default function CartGroup({
  cart,
  token,
  now,
  isUpdating,
  checkoutPending,
  onUpdateQuantity,
  onRemoveItem,
  onImageError,
  onCheckout,
}) {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const vendorName = cart.vendor?.name || 'Cafeteria';
  const expired = Boolean(cart.expiresAt && new Date(cart.expiresAt).getTime() <= now);

  const handleCheckout = async () => {
    setCheckoutError('');
    const error = await onCheckout(cart, selectedSlot, orderNotes);
    if (error) setCheckoutError(error);
  };

  return (
    <section className="cart-vendor-group" aria-labelledby={`cart-vendor-${cart.id}`}>
      <div className="cart__content">
        <div className="cart__main">
          <div className="cart__header">
            <div className="cart__vendor">
              {cart.vendor?.logo_url && (
                <div className="cart__vendor-image">
                  <SmartImage
                    src={cart.vendor.logo_url}
                    alt={vendorName}
                    width={56}
                    height={56}
                    onError={() => onImageError(cart.id, 'vendor', cart.vendor.logo_url)}
                  />
                </div>
              )}
              <div className="cart__vendor-details">
                <h2 className="cart__vendor-name" id={`cart-vendor-${cart.id}`}>{vendorName}</h2>
                <p className="cart__vendor-description">This cafeteria has a separate checkout.</p>
              </div>
              {cart.expiresAt && (
                <div className="cart__expiry">
                  <span className="cart__expiry-label">Cart expires in</span>
                  <span className="cart__expiry-time">{formatExpiry(cart.expiresAt, now)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="cart__items">
            <h3 className="cart__section-title">Your Order</h3>
            <div className="cart__items-list">
              {cart.items.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  to={item.menuItem ? `/cafeterias/${cart.vendor?.id}/menu/${item.menuItem.id}` : '#'}
                  onUpdateQuantity={onUpdateQuantity}
                  onRemove={onRemoveItem}
                  onImageError={(itemId, image) => onImageError(cart.id, itemId, image)}
                />
              ))}
            </div>
          </div>

          <div className="cart__special">
            <label className="cart__special-label" htmlFor={`cart-order-notes-${cart.id}`}>
              Order Notes for {vendorName}
            </label>
            <textarea
              id={`cart-order-notes-${cart.id}`}
              className="cart__special-input"
              placeholder="Any special requests or notes for this cafeteria..."
              maxLength={1000}
              value={orderNotes}
              onChange={(event) => setOrderNotes(event.target.value)}
            />
          </div>
          {checkoutError && <p className="cart-action-error" role="alert">{checkoutError}</p>}
        </div>

        <div className="cart__sidebar">
          <CartSummary
            subtotal={cart.subtotal || 0}
            serviceFee={cart.serviceFee || 0}
            total={cart.total || 0}
            selectedSlot={selectedSlot}
            now={now}
            timeZone={cart.siteTimezone}
            token={token}
            vendorLocationId={cart.vendorLocationId}
            onSelectSlot={setSelectedSlot}
            slots={cart.collectionSlots || []}
            itemCount={cart.itemCount || 0}
            onPlaceOrder={handleCheckout}
            disabled={expired || checkoutPending || isUpdating}
            updating={isUpdating}
          />
        </div>
      </div>
    </section>
  );
}
