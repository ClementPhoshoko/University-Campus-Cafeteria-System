import { useEffect, useState } from 'react';
import { IconClock, IconMapPin } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../../components/layout/PageContainer.jsx';
import CartItem from './CartItem.jsx';
import CartSummary from './CartSummary.jsx';
import Breadcrumb from '../../components/ui/Breadcrumb.jsx';
import CartBackground from '../../components/CartBackground.jsx';
import FoodCard from '../../components/cards/FoodCard.jsx';
import OrderConfirmation from '../../components/orders/OrderConfirmation.jsx';
import avoidQueuesImg from '../../assets/avatars/illustration_avoid_queues.png';
import { useAuth } from '../../hooks/useAuth.js';
import { getCart, updateCartItem, removeCartItem, createOrder } from '../../services/employeeApi.js';
import './CartPage.css';

export default function CartPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const token = session?.access_token;

  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [orderStatus, setOrderStatus] = useState(null);
  const [createdOrderId, setCreatedOrderId] = useState(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    getCart({ token })
      .then((res) => {
        if (!cancelled) setCart(res?.cart || null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const subtotal = cart?.subtotal || 0;
  const serviceFee = cart?.serviceFee || 0;
  const total = cart?.total || 0;

  const handleUpdateQuantity = async (itemId, newQuantity) => {
    if (!token) return;
    if (newQuantity < 1) {
      handleRemoveItem(itemId);
      return;
    }
    try {
      const res = await updateCartItem(itemId, { quantity: newQuantity }, { token });
      if (res?.cart) setCart((prev) => prev ? { ...prev, ...res.cart } : prev);
    } catch (err) {
      console.error('Failed to update cart item:', err);
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!token) return;
    try {
      const res = await removeCartItem(itemId, { token });
      if (res?.cart) setCart((prev) => prev ? { ...prev, ...res.cart } : prev);
    } catch (err) {
      console.error('Failed to remove cart item:', err);
    }
  };

  const handleSelectSlot = (slotId) => {
    setSelectedSlot(slotId);
  };

  const handlePlaceOrder = async () => {
    if (!token || !selectedSlot || !cart) return;
    setOrderStatus('loading');
    try {
      const res = await createOrder({
        vendorId: cart.vendor?.id,
        vendorLocationId: cart.vendorLocationId,
        collectionSlotId: selectedSlot,
        items: [],
        notes: specialInstructions || null,
      }, { token });
      setCreatedOrderId(res?.order?.id || null);
      setOrderStatus('success');
    } catch (err) {
      console.error('Failed to place order:', err);
      setOrderStatus(null);
    }
  };

  const handleCloseOrderStatus = () => {
    setOrderStatus(null);
    if (orderStatus === 'success') {
      setCart(null);
      navigate('/orders');
    }
  };

  if (orderStatus === 'success') {
    return (
      <OrderConfirmation
        orderId={createdOrderId}
        onContinue={handleCloseOrderStatus}
      />
    );
  }

  if (loading) {
    return (
      <PageContainer className="cart-page-container">
        <CartBackground />
        <div className="cart-page">
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading cart...</p>
        </div>
      </PageContainer>
    );
  }

  if (!cart || !cart.items || cart.items.length === 0) {
    return (
      <PageContainer className="cart-page-container">
        <CartBackground />
        <div className="cart-page">
          <Breadcrumb items={[{ label: 'Your Cart' }]} />
          <div className="cart-empty">
            <img src={avoidQueuesImg} alt="" className="cart-empty__image" />
            <div className="cart-empty__content">
              <h2 className="cart-empty__title">Your cart is empty</h2>
              <p className="cart-empty__text">Start your order and fill it with delicious items from our campus cafeterias</p>
              <button type="button" className="cart-empty__btn" onClick={() => navigate('/cafeterias')}>
                Order Now
              </button>
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  const vendorName = cart.vendor?.name || 'Vendor';
  const vendorImage = cart.vendor?.logo_url;

  const formatExpiry = () => {
    if (!cart.expiresAt) return '';
    const now = new Date();
    const diff = new Date(cart.expiresAt) - now;
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <PageContainer className="cart-page-container">
      <CartBackground />
      <div className="cart-page">
        <Breadcrumb items={[{ label: 'Cafeterias', to: '/cafeterias' }, { label: 'Your Cart' }]} />

        <div className="cart__content">
          <div className="cart__main">
            <div className="cart__header">
              <div className="cart__vendor">
                {vendorImage && (
                  <div className="cart__vendor-image">
                    <img src={vendorImage} alt={vendorName} />
                  </div>
                )}
                <div className="cart__vendor-details">
                  <h1 className="cart__vendor-name">{vendorName}</h1>
                </div>
                {cart.expiresAt && (
                  <div className="cart__expiry">
                    <span className="cart__expiry-label">Cart expires in</span>
                    <span className="cart__expiry-time">{formatExpiry()}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="cart__items">
              <h2 className="cart__section-title">Your Order</h2>
              <div className="cart__items-list">
                {cart.items.map((item) => (
                  <CartItem
                    key={item.id}
                    item={item}
                    to={item.menuItem ? `/cafeterias/${cart.vendor?.id}/menu/${item.menuItem.id}` : '#'}
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
              slots={cart.collectionSlots || []}
              itemCount={cart.itemCount || 0}
              onPlaceOrder={handlePlaceOrder}
            />
          </div>
        </div>
      </div>

      {orderStatus === 'loading' && (
        <div className="order-status">
          <div className="order-status__overlay" />
          <div className="order-status__card">
            <div className="order-status__spinner" />
            <h2 className="order-status__title">Placing your order...</h2>
            <p className="order-status__text">Please wait a moment</p>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
