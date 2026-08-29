import { useState } from 'react';
import { IconClock, IconMapPin } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../../components/layout/PageContainer.jsx';
import CartItem from './CartItem.jsx';
import CartSummary from './CartSummary.jsx';
import Breadcrumb from '../../components/ui/Breadcrumb.jsx';
import FoodCard from '../../components/cards/FoodCard.jsx';
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
    { id: 'slot-1', starts_at: '2024-01-01T12:00:00Z', ends_at: '2024-01-01T12:15:00Z', capacity: 10, reserved_count: 3, paused: false },
    { id: 'slot-2', starts_at: '2024-01-01T12:15:00Z', ends_at: '2024-01-01T12:30:00Z', capacity: 10, reserved_count: 8, paused: false },
    { id: 'slot-3', starts_at: '2024-01-01T12:30:00Z', ends_at: '2024-01-01T12:45:00Z', capacity: 10, reserved_count: 10, paused: false },
    { id: 'slot-4', starts_at: '2024-01-01T12:45:00Z', ends_at: '2024-01-01T13:00:00Z', capacity: 10, reserved_count: 0, paused: false },
    { id: 'slot-5', starts_at: '2024-01-01T13:00:00Z', ends_at: '2024-01-01T13:15:00Z', capacity: 10, reserved_count: 5, paused: false },
    { id: 'slot-6', starts_at: '2024-01-01T13:15:00Z', ends_at: '2024-01-01T13:30:00Z', capacity: 10, reserved_count: 0, paused: true },
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
        <Breadcrumb
          items={[
            { label: 'Cafeterias', to: '/cafeterias' },
            { label: 'Your Cart' }
          ]}
        />

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
                  <span className="cart__expiry-label">Cart expires in</span>
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
                    to={`/cafeterias/${item.menuItem.cafeteriaId}/menu/${item.menuItem.id}`}
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
                onChange={(e) => {
                  setSpecialInstructions(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
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

        <div className="cart__suggestions">
          <div className="cart__suggestions-header">
            <h2 className="cart__suggestions-title">More at {cart.vendor.name}</h2>
          </div>
          <div className="cart__suggestions-scroll">
            {popularMeals
              .filter(meal => meal.cafeteriaId === cart.vendor.id)
              .map(meal => (
                <FoodCard
                  key={meal.id}
                  id={meal.id}
                  name={meal.name}
                  price={meal.price}
                  vendor={meal.vendor}
                  image={meal.image}
                  bestSeller={meal.bestSeller}
                  description={meal.description}
                  to={`/cafeteria/${cart.vendor.id}/item/${meal.id}`}
                />
              ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
