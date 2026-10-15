import { useCallback, useEffect, useRef, useState } from 'react';
import { IconClock, IconMapPin } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../../components/layout/PageContainer.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import CartItem from './CartItem.jsx';
import CartSummary from './CartSummary.jsx';
import Breadcrumb from '../../components/ui/Breadcrumb.jsx';
import CartBackground from '../../components/CartBackground.jsx';
import FoodCard from '../../components/cards/FoodCard.jsx';
import OrderConfirmation from '../../components/orders/OrderConfirmation.jsx';
import SmartImage from '../../components/ui/SmartImage.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import '../../components/cards/CardSkeletonShimmer.css';
import avoidQueuesImg from '../../assets/avatars/illustration_avoid_queues.webp';
import { useAuth } from '../../hooks/useAuth.js';
import { useFetch } from '../../hooks/useFetch.js';
import { getCart, updateCartItem, removeCartItem, createOrder } from '../../services/employeeApi.js';
import { CACHE_TTL } from '../../services/cache.js';
import './CartPage.css';

export default function CartPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const token = session?.access_token;
  const cartUserId = session?.user?.id;
  const attemptedImageRefreshes = useRef(new Set());
  const loadCart = useCallback(async ({ signal }) => {
    const response = await getCart({ token, signal });
    return { userId: cartUserId, cart: response?.cart || null };
  }, [cartUserId, token]);
  const cartFeed = useFetch(loadCart, {
    cacheKey: cartUserId ? `employee:cart:${cartUserId}` : null,
    enabled: Boolean(token && cartUserId),
    staleTime: CACHE_TTL.cart,
  });
  const cartData = cartFeed.data?.userId === cartUserId ? cartFeed.data : null;
  const cart = cartData?.cart || null;
  const loading = Boolean(token && cartUserId) && !cartData
    && (cartFeed.isLoading || Boolean(cartFeed.data && cartFeed.data.userId !== cartUserId));
  const loadError = !token || !cartUserId
    ? 'Please sign in again to view your cart.'
    : cartFeed.error && !cartData && !loading
      ? cartFeed.error?.message || 'Could not load your cart. Please try again.'
      : '';
  const refreshError = cartFeed.error && cartData
    ? 'Cart refresh failed. Showing the last available cart.'
    : '';
  const [actionError, setActionError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [orderStatus, setOrderStatus] = useState(null);
  const [createdOrderId, setCreatedOrderId] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const subtotal = cart?.subtotal || 0;
  const serviceFee = cart?.serviceFee || 0;
  const total = cart?.total || 0;

  const refreshCartImage = async (itemId, failedImage) => {
    if (!token || !failedImage) return;
    const key = `cart:${itemId}`;
    if (attemptedImageRefreshes.current.has(key)) return;
    attemptedImageRefreshes.current.add(key);

    try {
      const response = await getCart({ token, refreshImages: true });
      const refreshedCart = response?.cart;
      const nextImage = itemId === 'vendor'
        ? refreshedCart?.vendor?.logo_url
        : refreshedCart?.items?.find((item) => item.id === itemId)?.menuItem?.image_url;
      if (!nextImage || nextImage === failedImage) {
        console.error(`Unable to refresh cart image for ${itemId}: no new image URL was returned.`);
        return;
      }
      cartFeed.mutate((current) => {
        if (!current?.cart || !refreshedCart) return current;
        return {
          ...current,
          cart: {
            ...current.cart,
            vendor: itemId === 'vendor'
              ? { ...current.cart.vendor, logo_url: nextImage }
              : current.cart.vendor,
            items: itemId === 'vendor'
              ? current.cart.items
              : current.cart.items.map((item) => (
                item.id === itemId
                  ? { ...item, menuItem: { ...item.menuItem, image_url: nextImage } }
                  : item
              )),
          },
        };
      });
    } catch (error) {
      console.error(`Unable to refresh cart image for ${itemId}:`, error);
    }
  };

  const handleUpdateQuantity = async (itemId, newQuantity) => {
    if (!token) return;
    if (newQuantity < 1) {
      handleRemoveItem(itemId);
      return;
    }
    try {
      setActionError('');
      const res = await updateCartItem(itemId, { quantity: newQuantity }, { token });
      if (res?.cart) cartFeed.mutate((prev) => prev?.cart
        ? { ...prev, cart: { ...prev.cart, ...res.cart } }
        : prev);
    } catch (err) {
      setActionError(err?.message || 'Could not update this cart item. Please try again.');
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!token) return;
    try {
      setActionError('');
      const res = await removeCartItem(itemId, { token });
      if (res?.cart) cartFeed.mutate((prev) => prev?.cart
        ? { ...prev, cart: { ...prev.cart, ...res.cart } }
        : prev);
    } catch (err) {
      setActionError(err?.message || 'Could not remove this cart item. Please try again.');
    }
  };

  const handleSelectSlot = (slotId) => {
    setSelectedSlot(slotId);
  };

  const handlePlaceOrder = async () => {
    if (!token || !selectedSlot || !cart) return;
    if (cart.expiresAt && new Date(cart.expiresAt).getTime() <= Date.now()) {
      setActionError('Your cart has expired. Refresh the cart and add your items again.');
      return;
    }
    if (specialInstructions.length > 1000) {
      setActionError('Order notes must be 1000 characters or fewer.');
      return;
    }
    setActionError('');
    setOrderStatus('loading');
    try {
      const res = await createOrder({
        vendorId: cart.vendor?.id,
        vendorLocationId: cart.vendorLocationId,
        collectionSlotId: selectedSlot,
        notes: specialInstructions || null,
      }, { token });
      setCreatedOrderId(res?.order?.id || null);
      setOrderStatus('success');
    } catch (err) {
      setActionError(err?.message || 'Could not place your order. Please try again.');
      setOrderStatus(null);
    }
  };

  const handleCloseOrderStatus = () => {
    setOrderStatus(null);
    if (orderStatus === 'success') {
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
          <Breadcrumb items={[{ label: 'Your Cart' }]} />
          <div className="cart__content cart__content--skeleton" role="status" aria-label="Loading cart" aria-busy="true">
            <div className="cart__main">
              <div className="cart-skeleton__vendor">
                <Skeleton className="cart-skeleton__avatar home_card-skeleton-shimmer" />
                <Skeleton className="skeleton--text home_card-skeleton-shimmer" style={{ width: '38%', height: 20 }} />
              </div>
              {[0, 1].map((item) => (
                <div className="cart-skeleton__item" key={item} aria-hidden="true">
                  <Skeleton className="cart-skeleton__image home_card-skeleton-shimmer" />
                  <div className="cart-skeleton__details">
                    <Skeleton className="skeleton--text home_card-skeleton-shimmer" style={{ width: '48%', height: 16 }} />
                    <Skeleton className="skeleton--text home_card-skeleton-shimmer" style={{ width: '70%', height: 12 }} />
                    <Skeleton className="skeleton--text home_card-skeleton-shimmer" style={{ width: '26%', height: 16 }} />
                  </div>
                </div>
              ))}
            </div>
            <Skeleton className="cart-skeleton__summary home_card-skeleton-shimmer" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (loadError && !cart) {
    return (
      <PageContainer className="cart-page-container">
        <CartBackground />
        <div className="cart-page">
          <Breadcrumb items={[{ label: 'Your Cart' }]} />
          <div className="cart-load-error" role="alert">
            <h2>Could not load your cart</h2>
            <p>{loadError}</p>
            {token && (
              <button type="button" onClick={() => cartFeed.invalidate()}>
                Try again
              </button>
            )}
          </div>
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
          {refreshError && <p className="cart-refresh-error" role="status">{refreshError}</p>}
          <div className="cart-empty">
            <img src={avoidQueuesImg} alt="" className="cart-empty__image" />
            <div className="cart-empty__content">
              <h2 className="cart-empty__title">Your cart is empty</h2>
              <p className="cart-empty__text">Start your order and fill it with delicious items from our campus cafeterias</p>
              <PrimaryButton onClick={() => navigate('/cafeterias')}>Order Now</PrimaryButton>
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
    const diff = new Date(cart.expiresAt).getTime() - now;
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };
  const isExpired = Boolean(cart.expiresAt && new Date(cart.expiresAt).getTime() <= now);

  return (
    <PageContainer className="cart-page-container">
      <CartBackground />
      <div className="cart-page">
        <Breadcrumb items={[{ label: 'Cafeterias', to: '/cafeterias' }, { label: 'Your Cart' }]} />

        <div className="cart__content">
          <div className="cart__main">
            {actionError && <p className="cart-action-error" role="alert">{actionError}</p>}
            {refreshError && <p className="cart-refresh-error" role="status">{refreshError}</p>}
            <div className="cart__header">
              <div className="cart__vendor">
                {vendorImage && (
                  <div className="cart__vendor-image">
                    <SmartImage
                      src={vendorImage}
                      alt={vendorName}
                      width={56}
                      height={56}
                      onError={() => refreshCartImage('vendor', vendorImage)}
                    />
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
                    onImageError={refreshCartImage}
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
                maxLength={1000}
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
              disabled={isExpired || orderStatus === 'loading'}
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
