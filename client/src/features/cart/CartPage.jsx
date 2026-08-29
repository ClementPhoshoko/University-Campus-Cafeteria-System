import { useState } from 'react';
import { IconArrowLeft, IconClock, IconMapPin } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../../components/layout/PageContainer.jsx';
import CartItem from './CartItem.jsx';
import CartSummary from './CartSummary.jsx';
import { IconToolsKitchen2 } from '@tabler/icons-react';
import { cafeterias, popularMeals } from '../home/homeData.js';
import './CartPage.css';

const SAMPLE_CART = {
  id: 'cart-1',
  vendor: {
    ...cafeterias[0],
    location: 'Building A, Ground Floor',
    estimatedPrepMinutes: 15,
  },
  expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
  items: [
    {
      id: 'item-1',
      menuItem: popularMeals[0],
      quantity: 2,
      unitPriceSnapshot: 45.00,
      selectedOptions: [
        { id: 'opt-1', name: 'Large', priceDelta: 12.00 },
        { id: 'opt-2', name: 'Extra Cheese', priceDelta: 5.00 },
      ],
      specialInstructions: 'No mayo please',
    },
    {
      id: 'item-2',
      menuItem: popularMeals[1],
      quantity: 1,
      unitPriceSnapshot: 52.00,
      selectedOptions: [
        { id: 'opt-3', name: 'Brown Rice', priceDelta: 0.00 },
      ],
      specialInstructions: '',
    },
  ],
  collectionSlots: [
    { id: 'slot-1', startsAt: '12:00', endsAt: '12:15', available: true },
    { id: 'slot-2', startsAt: '12:15', endsAt: '12:30', available: true },
    { id: 'slot-3', startsAt: '12:30', endsAt: '12:45', available: false },
    { id: 'slot-4', startsAt: '12:45', endsAt: '13:00', available: true },
    { id: 'slot-5', startsAt: '13:00', endsAt: '13:15', available: true },
    { id: 'slot-6', startsAt: '13:15', endsAt: '13:30', available: true },
  ],
};

export default function CartPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(SAMPLE_CART);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [specialInstructions, setSpecialInstructions] = useState('');

  const subtotal = cart.items.reduce((sum, item) => {
    const optionsTotal = item.selectedOptions.reduce((optSum, opt) => optSum + opt.priceDelta, 0);
    return sum + (item.unitPriceSnapshot + optionsTotal) * item.quantity;
  }, 0);

  const serviceFee = subtotal * 0.05;
  const total = subtotal + serviceFee;

  const handleUpdateQuantity = (itemId, newQuantity) => {
    if (newQuantity < 1) {
      handleRemoveItem(itemId);
      return;
    }
    setCart((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      ),
    }));
  };

  const handleRemoveItem = (itemId) => {
    setCart((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  };

  const handleSelectSlot = (slotId) => {
    setSelectedSlot(slotId);
  };

  const formatExpiry = () => {
    const now = new Date();
    const diff = cart.expiresAt - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (cart.items.length === 0) {
    return (
      <PageContainer className="cart-page-container">
        <div className="cart-page">
          <div className="cart-empty">
            <div className="cart-empty-icon">
              <IconToolsKitchen2 size={48} stroke={1.2} />
            </div>
            <h2>Your cart is empty</h2>
            <p>Browse our menu and add some delicious items</p>
            <button
              type="button"
              className="cart-empty-btn"
              onClick={() => navigate('/cafeterias')}
            >
              Browse Menu
            </button>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="cart-page-container">
      <div className="cart-page">
        <button
          type="button"
          className="cart__back"
          onClick={() => navigate(-1)}
        >
          <IconArrowLeft size={18} stroke={1.8} />
          <span>Back</span>
        </button>

        <div className="cart__content">
          <div className="cart__main">
            <div className="cart__header">
              <div className="cart__vendor">
                <div className="cart__vendor-image">
                  <img src={cart.vendor.image} alt={cart.vendor.name} />
                </div>
                <div className="cart__vendor-details">
                  <h1 className="cart__vendor-name">{cart.vendor.name}</h1>
                  <div className="cart__vendor-meta">
                    <span className="cart__vendor-location">
                      <IconMapPin size={13} stroke={1.5} />
                      {cart.vendor.location}
                    </span>
                    <span className="cart__vendor-prep">
                      <IconClock size={13} stroke={1.5} />
                      {cart.vendor.estimatedPrepMinutes} min
                    </span>
                  </div>
                </div>
                <div className="cart__expiry">
                  <span className="cart__expiry-label">Expires in</span>
                  <span className="cart__expiry-time">{formatExpiry()}</span>
                </div>
              </div>
            </div>

            <div className="cart__items">
              <h2 className="cart__section-title">Your Order</h2>
              <div className="cart__items-list">
                {cart.items.map((item) => (
                  <CartItem
                    key={item.id}
                    item={item}
                    onUpdateQuantity={handleUpdateQuantity}
                    onRemove={handleRemoveItem}
                  />
                ))}
              </div>
            </div>

            <div className="cart__special">
              <label className="cart__special-label" htmlFor="cart-special-instructions">
                Order Notes
              </label>
              <textarea
                id="cart-special-instructions"
                className="cart__special-input"
                placeholder="Any special requests or notes for your order..."
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
              />
            </div>

            </div>

          <div className="cart__sidebar">
            <CartSummary
              subtotal={subtotal}
              serviceFee={serviceFee}
              total={total}
              selectedSlot={selectedSlot}
              onSelectSlot={handleSelectSlot}
              slots={cart.collectionSlots}
              itemCount={cart.items.reduce((sum, item) => sum + item.quantity, 0)}
            />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
