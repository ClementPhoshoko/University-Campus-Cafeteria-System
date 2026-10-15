import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../../components/layout/PageContainer.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import CartGroup from './CartGroup.jsx';
import Breadcrumb from '../../components/ui/Breadcrumb.jsx';
import CartBackground from '../../components/CartBackground.jsx';
import OrderConfirmation from '../../components/orders/OrderConfirmation.jsx';
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
  const cartMutationQueue = useRef(Promise.resolve());
  const pendingCartMutations = useRef(0);
  const latestCartMutation = useRef(new Map());
  const loadCart = useCallback(async ({ signal }) => {
    const response = await getCart({ token, signal });
    const carts = Array.isArray(response?.carts)
      ? response.carts
      : response?.cart ? [response.cart] : [];
    return { userId: cartUserId, carts };
  }, [cartUserId, token]);
  const cartFeed = useFetch(loadCart, {
    cacheKey: cartUserId ? `employee:cart:${cartUserId}` : null,
    enabled: Boolean(token && cartUserId),
    staleTime: CACHE_TTL.cart,
  });
  const cartData = cartFeed.data?.userId === cartUserId ? cartFeed.data : null;
  const carts = cartData?.carts || (cartData?.cart ? [cartData.cart] : []);
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
  const [isCartUpdating, setIsCartUpdating] = useState(false);
  const [orderStatus, setOrderStatus] = useState(null);
  const [createdOrderId, setCreatedOrderId] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const updateCartOptimistically = (cartId, updater) => {
    cartFeed.mutate((current) => {
      if (!current?.carts?.length) return current;
      return {
        ...current,
        carts: current.carts.map((cart) => {
          if (cart.id !== cartId) return cart;
          const nextCart = updater(cart);
          const items = nextCart.items || [];
          const subtotal = items.reduce((sum, item) => {
            const snapshot = item.unitPriceSnapshot === null || item.unitPriceSnapshot === undefined || item.unitPriceSnapshot === ''
              ? NaN
              : Number(item.unitPriceSnapshot);
            const currentPrice = item.menuItem?.base_price === null
              || item.menuItem?.base_price === undefined
              || item.menuItem?.base_price === ''
              ? NaN
              : Number(item.menuItem.base_price);
            const unitPrice = Number.isFinite(snapshot) && snapshot >= 0 ? snapshot : currentPrice;
            const optionsTotal = (item.selectedOptions || []).reduce(
              (optionSum, option) => optionSum + (Number(option.priceDelta) || 0) * (Number(option.quantity) || 1),
              0,
            );
            return Number.isFinite(unitPrice)
              ? sum + (unitPrice + optionsTotal) * item.quantity
              : sum;
          }, 0);
          return {
            ...nextCart,
            items,
            subtotal,
            itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
          };
        }),
      };
    });
  };

  const queueCartMutation = (cartId, mutation) => {
    const mutationId = (latestCartMutation.current.get(cartId) || 0) + 1;
    latestCartMutation.current.set(cartId, mutationId);
    pendingCartMutations.current += 1;
    setIsCartUpdating(true);

    const queuedMutation = cartMutationQueue.current.then(async () => {
      try {
        const response = await mutation();
        if (response?.cart && mutationId === latestCartMutation.current.get(cartId)) {
          cartFeed.mutate((current) => current?.carts
            ? { ...current, carts: current.carts.map((cart) => cart.id === response.cart.id
              ? { ...cart, ...response.cart }
              : cart) }
            : current);
          setActionError('');
        }
      } catch (error) {
        setActionError(error?.message || 'Could not update your cart. Please try again.');
        try {
          const response = await getCart({ token });
          if (mutationId === latestCartMutation.current.get(cartId)) {
            cartFeed.mutate((current) => current
              ? { ...current, carts: response?.carts || (response?.cart ? [response.cart] : []) }
              : current);
          }
        } catch (refreshError) {
          console.error('Failed to restore cart after an update error:', refreshError);
          setActionError(`${error?.message || 'Cart update failed.'} Your cart could not be refreshed.`);
        }
      } finally {
        pendingCartMutations.current -= 1;
        if (pendingCartMutations.current === 0) setIsCartUpdating(false);
      }
    });
    cartMutationQueue.current = queuedMutation.catch((error) => {
      console.error('Unexpected cart update queue failure:', error);
    });
  };

  const refreshCartImage = async (cartId, itemId, failedImage) => {
    if (!token || !failedImage) return;
    const key = `cart:${cartId}:${itemId}`;
    if (attemptedImageRefreshes.current.has(key)) return;
    attemptedImageRefreshes.current.add(key);

    try {
      const response = await getCart({ token, refreshImages: true });
      const refreshedCart = (response?.carts || (response?.cart ? [response.cart] : []))
        .find((cart) => cart.id === cartId);
      const nextImage = itemId === 'vendor'
        ? refreshedCart?.vendor?.logo_url
        : refreshedCart?.items?.find((item) => item.id === itemId)?.menuItem?.image_url;
      if (!nextImage || nextImage === failedImage) {
        console.error(`Unable to refresh cart image for ${itemId}: no new image URL was returned.`);
        return;
      }
      cartFeed.mutate((current) => {
        if (!current?.carts || !refreshedCart) return current;
        return {
          ...current,
          carts: current.carts.map((cart) => cart.id !== cartId ? cart : ({
            ...cart,
            vendor: itemId === 'vendor'
              ? { ...cart.vendor, logo_url: nextImage }
              : cart.vendor,
            items: itemId === 'vendor'
              ? cart.items
              : cart.items.map((item) => (
                item.id === itemId
                  ? { ...item, menuItem: { ...item.menuItem, image_url: nextImage } }
                  : item
              )),
          })),
        };
      });
    } catch (error) {
      console.error(`Unable to refresh cart image for ${itemId}:`, error);
    }
  };

  const handleUpdateQuantity = async (cartId, itemId, newQuantity) => {
    if (!token) return;
    if (newQuantity < 1) {
      handleRemoveItem(cartId, itemId);
      return;
    }
    setActionError('');
    updateCartOptimistically(cartId, (current) => ({
      ...current,
      items: current.items.map((item) => item.id === itemId ? { ...item, quantity: newQuantity } : item),
    }));
    queueCartMutation(cartId, () => updateCartItem(itemId, { quantity: newQuantity }, { token }));
  };

  const handleRemoveItem = async (cartId, itemId) => {
    if (!token) return;
    setActionError('');
    updateCartOptimistically(cartId, (current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== itemId),
    }));
    queueCartMutation(cartId, () => removeCartItem(itemId, { token }));
  };

  const handlePlaceOrder = async (cart, selectedSlot, orderNotes) => {
    if (!token || !selectedSlot || !cart) return 'Select a collection time before checkout.';
    if (cart.expiresAt && new Date(cart.expiresAt).getTime() <= Date.now()) {
      return 'This cart has expired. Refresh the cart and add the items again.';
    }
    if (orderNotes.length > 1000) {
      return 'Order notes must be 1000 characters or fewer.';
    }
    setOrderStatus('loading');
    try {
      const res = await createOrder({
        cartId: cart.id,
        vendorId: cart.vendor?.id,
        vendorLocationId: cart.vendorLocationId,
        collectionSlotId: selectedSlot,
        notes: orderNotes || null,
      }, { token });
      setCreatedOrderId(res?.order?.id || null);
      cartFeed.mutate((current) => current?.carts
        ? { ...current, carts: current.carts.filter((entry) => entry.id !== cart.id) }
        : current);
      setOrderStatus('success');
      return null;
    } catch (err) {
      const message = err?.message || 'Could not place your order. Please try again.';
      setOrderStatus(null);
      return message;
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
                    <div className="cart-skeleton__instructions" aria-hidden="true">
                      <Skeleton className="skeleton--text home_card-skeleton-shimmer" style={{ width: 104, height: 10 }} />
                      <Skeleton className="skeleton--text home_card-skeleton-shimmer" style={{ width: '84%', height: 13 }} />
                    </div>
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

  if (loadError && !cartData) {
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

  const nonEmptyCarts = carts.filter((cart) => cart.items?.length > 0);

  if (nonEmptyCarts.length === 0) {
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

  return (
    <PageContainer className="cart-page-container">
      <CartBackground />
      <div className="cart-page">
        <Breadcrumb items={[{ label: 'Cafeterias', to: '/cafeterias' }, { label: 'Your Cart' }]} />

        {actionError && <p className="cart-action-error" role="alert">{actionError}</p>}
        {refreshError && <p className="cart-refresh-error" role="status">{refreshError}</p>}
        {nonEmptyCarts.length > 1 && (
          <p className="cart-multi-vendor-notice" role="note">
            Your items are grouped by cafeteria. Each cafeteria has its own collection time and checkout.
          </p>
        )}
        {nonEmptyCarts.map((cart) => (
          <CartGroup
            key={cart.id}
            cart={cart}
            now={now}
            isUpdating={isCartUpdating}
            checkoutPending={orderStatus === 'loading'}
            onUpdateQuantity={(itemId, quantity) => handleUpdateQuantity(cart.id, itemId, quantity)}
            onRemoveItem={(itemId) => handleRemoveItem(cart.id, itemId)}
            onImageError={refreshCartImage}
            onCheckout={handlePlaceOrder}
          />
        ))}
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
