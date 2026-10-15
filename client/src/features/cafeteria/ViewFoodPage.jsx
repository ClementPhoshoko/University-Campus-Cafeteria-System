import { useCallback, useEffect, useRef, useState } from 'react';
import { IconClock, IconCheck, IconPlus, IconFlame, IconLeaf, IconInfoCircle } from '@tabler/icons-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import PageContainer from '../../components/layout/PageContainer.jsx';
import FoodCard from '../../components/cards/FoodCard.jsx';
import QuantitySelector from '../../components/ui/QuantitySelector.jsx';
import CustomDropdown from '../../components/ui/CustomDropdown.jsx';
import Breadcrumb from '../../components/ui/Breadcrumb.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import ViewFoodBackground from '../../components/ViewFoodBackground.jsx';
import SmartImage from '../../components/ui/SmartImage.jsx';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.webp';
import { useAuth } from '../../hooks/useAuth.js';
import { useFetch } from '../../hooks/useFetch.js';
import { getMenuItem, getVendor, addToCart } from '../../services/employeeApi.js';
import { CACHE_TTL } from '../../services/cache.js';
import '../../components/cards/CardSkeletonShimmer.css';
import './ViewFoodPage.css';

function formatPrice(price) {
  const num = typeof price === 'string' ? parseFloat(price.replace(/[^0-9.]/g, '')) : price;
  return `R${Number(num || 0).toFixed(2)}`;
}

function ProductPageSkeleton() {
  return (
    <div className="view-food-skeleton" role="status" aria-label="Loading menu item" aria-busy="true">
      <div className="view-food-skeleton__main">
        <Skeleton className="view-food-skeleton__image home_card-skeleton-shimmer" />
        <div className="view-food-skeleton__details">
          <Skeleton className="skeleton--text home_card-skeleton-shimmer" style={{ width: '48%', height: 26 }} />
          <Skeleton className="skeleton--text home_card-skeleton-shimmer" style={{ width: '92%', height: 14 }} />
          <Skeleton className="skeleton--text home_card-skeleton-shimmer" style={{ width: '74%', height: 14 }} />
          <div className="view-food-skeleton__meta">
            <Skeleton className="skeleton--text home_card-skeleton-shimmer" style={{ width: 78, height: 22 }} />
            <Skeleton className="skeleton--text home_card-skeleton-shimmer" style={{ width: 58, height: 14 }} />
          </div>
          <Skeleton className="skeleton--text home_card-skeleton-shimmer" style={{ width: '38%', height: 13 }} />
          <Skeleton className="view-food-skeleton__tag home_card-skeleton-shimmer" />
        </div>
      </div>
      <div className="view-food-skeleton__sidebar">
        <Skeleton className="view-food-skeleton__customize home_card-skeleton-shimmer" />
        <div className="view-food-skeleton__actions">
          <Skeleton className="view-food-skeleton__quantity home_card-skeleton-shimmer" />
          <Skeleton className="view-food-skeleton__button home_card-skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

export default function ViewFoodPage() {
  const { cafeteriaId, menuItemId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedVendorId = searchParams.get('vendorId');
  const vendorId = requestedVendorId || cafeteriaId;
  const { session } = useAuth();
  const token = session?.access_token;

  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [addedToCart, setAddedToCart] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartActionError, setCartActionError] = useState('');
  const [optionError, setOptionError] = useState('');
  const attemptedImageRefreshes = useRef(new Set());
  const addedTimer = useRef(null);

  const loadVendor = useCallback(({ signal }) => (
    getVendor(vendorId, { token, signal, cache: 'no-cache' })
  ), [token, vendorId]);
  const transformVendor = useCallback((response) => response?.vendor || null, []);
  const vendorFeed = useFetch(loadVendor, {
    cacheKey: vendorId ? `employee:vendor-detail:${vendorId}` : null,
    enabled: Boolean(token && vendorId),
    staleTime: CACHE_TTL.employeeVendorDetail,
    transform: transformVendor,
  });

  const loadMenuItem = useCallback(({ signal }) => (
    getMenuItem(vendorId, menuItemId, { token, signal, cache: 'no-cache' })
  ), [token, vendorId, menuItemId]);
  const transformMenuItem = useCallback((response) => ({
    vendorId,
    menuItemId,
    menuItem: response?.menuItem || null,
  }), [vendorId, menuItemId]);
  const itemFeed = useFetch(loadMenuItem, {
    cacheKey: vendorId && menuItemId ? `employee:menu-item:${vendorId}:${menuItemId}` : null,
    enabled: Boolean(token && vendorId && menuItemId),
    staleTime: CACHE_TTL.employeeMenu,
    transform: transformMenuItem,
  });

  const vendor = vendorFeed.data?.id === vendorId ? vendorFeed.data : null;
  const itemResponse = itemFeed.data?.vendorId === vendorId && itemFeed.data?.menuItemId === menuItemId
    ? itemFeed.data
    : null;
  const menuItem = itemResponse?.menuItem || null;
  const optionGroups = menuItem?.option_groups || [];
  const itemLoading = itemFeed.isLoading && !itemResponse;
  const vendorRefreshError = vendorFeed.error && vendor
    ? 'Cafeteria information could not be refreshed. Showing the last loaded details.'
    : null;
  const vendorLoadError = vendorFeed.error && !vendor
    ? 'Cafeteria details could not be loaded. Showing the menu item without them.'
    : null;
  const itemRefreshError = itemFeed.error && menuItem
    ? 'This item could not be refreshed. Showing the last loaded details.'
    : null;

  useEffect(() => {
    setQuantity(1);
    setSelectedOptions({});
    setSpecialInstructions('');
    setAddedToCart(false);
    setAddingToCart(false);
    setCartActionError('');
    setOptionError('');
    attemptedImageRefreshes.current.clear();
    if (addedTimer.current) window.clearTimeout(addedTimer.current);
  }, [vendorId, menuItemId]);

  useEffect(() => () => {
    if (addedTimer.current) window.clearTimeout(addedTimer.current);
  }, []);

  const calculateTotal = () => {
    if (!menuItem) return 'R0.00';
    let total = Number(menuItem.base_price) || 0;
    Object.values(selectedOptions).forEach((option) => {
      if (Array.isArray(option)) {
        option.forEach((selected) => { total += Number(selected.price_delta) || 0; });
      } else if (option) {
        total += Number(option.price_delta) || 0;
      }
    });
    return formatPrice(total);
  };

  const handleOptionChange = (groupId, value) => {
    setSelectedOptions((previous) => ({ ...previous, [groupId]: value }));
    setOptionError('');
    setCartActionError('');
  };

  const refreshMenuItemImage = async (failedImage) => {
    const refreshKey = `menu-item:${vendorId}:${menuItemId}`;
    if (!vendorId || !menuItemId || attemptedImageRefreshes.current.has(refreshKey)) return;
    attemptedImageRefreshes.current.add(refreshKey);

    try {
      const response = await getMenuItem(vendorId, menuItemId, {
        token,
        cache: 'no-cache',
        refreshImages: true,
      });
      const image = response?.menuItem?.image_url;
      if (!image || image === failedImage) {
        console.error(`Unable to refresh menu item image for item ${menuItemId}: no new image URL was returned.`);
        return;
      }
      itemFeed.mutate((current) => {
        if (current?.vendorId !== vendorId || current?.menuItemId !== menuItemId || !current.menuItem) return current;
        return { ...current, menuItem: { ...current.menuItem, image_url: image } };
      });
    } catch (error) {
      console.error(`Unable to refresh menu item image for item ${menuItemId}:`, error);
    }
  };

  const handleAddToCart = async () => {
    if (!token || addingToCart || !menuItem) return;
    const missingGroup = optionGroups.find((group) => {
      const selected = selectedOptions[group.id];
      const selectedCount = Array.isArray(selected) ? selected.length : selected ? 1 : 0;
      const minimum = Number(group.min_select) || (group.is_required ? 1 : 0);
      return selectedCount < minimum;
    });
    if (missingGroup) {
      setOptionError(`Please choose at least ${Number(missingGroup.min_select) || 1} option${Number(missingGroup.min_select) > 1 ? 's' : ''} for ${missingGroup.name}.`);
      setCartActionError('');
      return;
    }

    setAddingToCart(true);
    setCartActionError('');
    try {
      const options = [];
      Object.entries(selectedOptions).forEach(([groupId, value]) => {
        const group = optionGroups.find((candidate) => candidate.id === groupId);
        if (!group || !value) return;
        if (Array.isArray(value)) {
          value.forEach((option) => { options.push({ optionId: option.id, priceDelta: Number(option.price_delta) || 0 }); });
        } else {
          options.push({ optionId: value.id, priceDelta: Number(value.price_delta) || 0 });
        }
      });
      await addToCart({
        menuItemId: menuItem.id,
        quantity,
        options,
        specialInstructions: specialInstructions.trim() || null,
      }, { token });
      setAddedToCart(true);
      addedTimer.current = window.setTimeout(() => setAddedToCart(false), 2000);
    } catch (error) {
      console.error('Failed to add menu item to cart:', error);
      setCartActionError(error?.message || 'Could not add this item to your cart. Please try again.');
    } finally {
      setAddingToCart(false);
    }
  };

  const isPurchasable = menuItem?.status === 'available' || menuItem?.status === 'limited';

  if (itemLoading) {
    return (
      <PageContainer className="view-food-page-container">
        <ViewFoodBackground />
        <main className="view-food-page">
          <Breadcrumb items={[{ label: 'Cafeterias', to: '/cafeterias' }, { label: 'Loading menu item' }]} />
          <ProductPageSkeleton />
        </main>
      </PageContainer>
    );
  }

  if (itemFeed.isError && !menuItem) {
    return (
      <PageContainer className="view-food-page-container">
        <ViewFoodBackground />
        <main className="view-food-page">
          <Breadcrumb items={[{ label: 'Cafeterias', to: '/cafeterias' }, { label: 'Menu item' }]} />
          <div className="view-food__empty" role="alert">
            <img src={emptyStateAvatar} alt="" className="view-food__empty-avatar" />
            <h2>Could not load this menu item</h2>
            <p>{itemFeed.error?.message || 'Please check your connection and try again.'}</p>
            <button type="button" className="view-food__retry" onClick={itemFeed.invalidate}>Try again</button>
          </div>
        </main>
      </PageContainer>
    );
  }

  if (!menuItem) {
    return (
      <PageContainer className="view-food-page-container">
        <ViewFoodBackground />
        <main className="view-food-page">
          <Breadcrumb items={[{ label: 'Cafeterias', to: '/cafeterias' }, { label: 'Menu item' }]} />
          <div className="view-food__empty">
            <img src={emptyStateAvatar} alt="" className="view-food__empty-avatar" />
            <h2>Item not found</h2>
            <p>This menu item could not be found or is no longer available.</p>
            <Link to={`/cafeterias/${cafeteriaId}`} className="view-food__back-link">Back to cafeteria menu</Link>
          </div>
        </main>
      </PageContainer>
    );
  }

  const cafeteriaName = vendor?.name || 'Cafeteria';
  const suggestedItems = [];

  return (
    <PageContainer className="view-food-page-container">
      <ViewFoodBackground />
      <main className="view-food-page">
        <Breadcrumb
          items={[
            { label: 'Cafeterias', to: '/cafeterias' },
            { label: cafeteriaName, to: `/cafeterias/${cafeteriaId}` },
            { label: menuItem.name },
          ]}
        />

        {(vendorLoadError || vendorRefreshError || itemRefreshError) && (
          <p className="view-food__refresh-notice" role="status">
            {itemRefreshError || vendorRefreshError || vendorLoadError}
          </p>
        )}

        <div className="view-food__content">
          <div className="view-food__main">
            <div className="view-food__image-wrap">
              <SmartImage
                src={menuItem.image_url}
                alt={menuItem.name}
                className="view-food__image"
                eager
                width={640}
                height={480}
                onError={() => refreshMenuItemImage(menuItem.image_url)}
              />
              {menuItem.status !== 'available' && (
                <div className="view-food__status-badge">
                  {menuItem.status === 'sold_out' ? 'Sold Out' : menuItem.status === 'limited' ? 'Limited' : 'Unavailable'}
                </div>
              )}
            </div>

            <div className="view-food__details">
              <div className="view-food__section">
                <h1 className="view-food__name">{menuItem.name}</h1>
                {menuItem.description && <p className="view-food__description">{menuItem.description}</p>}
              </div>

              <div className="view-food__section view-food__section--row">
                <span className="view-food__price">{formatPrice(menuItem.base_price)}</span>
                {menuItem.prep_minutes && (
                  <>
                    <span className="view-food__divider" />
                    <span className="view-food__prep">
                      <IconClock size={14} stroke={1.8} />
                      {menuItem.prep_minutes} min
                    </span>
                  </>
                )}
              </div>

              {menuItem.dietary_tags?.length > 0 && (
                <div className="view-food__section">
                  <span className="view-food__section-label">Dietary</span>
                  <div className="view-food__tags">
                    {menuItem.dietary_tags.map((tag) => (
                      <span key={tag} className="view-food__tag">
                        {tag === 'Halal' && <IconCheck size={14} stroke={2} />}
                        {tag === 'High Protein' && <IconFlame size={14} stroke={2} />}
                        {tag === 'Vegetarian' && <IconLeaf size={14} stroke={2} />}
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {menuItem.allergens?.length > 0 && (
                <div className="view-food__section">
                  <span className="view-food__section-label">
                    <IconInfoCircle size={14} stroke={1.8} />
                    Contains
                  </span>
                  <span className="view-food__allergen-list">{menuItem.allergens.map((allergen) => allergen.name || allergen).join(', ')}</span>
                </div>
              )}
            </div>
          </div>

          <div className="view-food__sidebar">
            <div className="view-food__customize">
              <h2 className="view-food__section-title">
                {optionGroups.length > 0 ? 'Customize' : 'Special request'}
              </h2>

              {optionGroups.length > 0 && (
                <div className="view-food__options">
                  {optionGroups.map((group) => (
                    <div key={group.id} className="view-food__option-group">
                      <div className="view-food__option-header">
                        <span className="view-food__option-name">
                          {group.name}
                          {(group.is_required || Number(group.min_select) > 0) && <span className="view-food__required">*</span>}
                        </span>
                        <span className="view-food__option-hint">
                          {group.selection_type === 'single' ? 'Select one' : 'Select multiple'}
                        </span>
                      </div>
                      <CustomDropdown
                        label=""
                        placeholder={`Select ${group.name.toLowerCase()}`}
                        options={group.options}
                        value={selectedOptions[group.id]}
                        onChange={(value) => handleOptionChange(group.id, value)}
                        multiple={group.selection_type === 'multiple'}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className={`view-food__special${optionGroups.length === 0 ? ' view-food__special--standalone' : ''}`}>
                <label className="view-food__special-label" htmlFor="special-instructions">
                  Special instructions (optional)
                </label>
                <p className="view-food__special-help">
                  We’ll pass this request to the cafeteria; changes depend on what they can accommodate.
                </p>
                <textarea
                  id="special-instructions"
                  className="view-food__special-input"
                  placeholder="For example, sauce on the side"
                  value={specialInstructions}
                  onChange={(event) => {
                    setSpecialInstructions(event.target.value);
                    event.target.style.height = 'auto';
                    event.target.style.height = `${event.target.scrollHeight}px`;
                  }}
                />
              </div>
            </div>

            <div className="view-food__actions-wrap">
              {optionError && <p className="view-food__action-error" role="alert">{optionError}</p>}
              {cartActionError && <p className="view-food__action-error" role="alert">{cartActionError}</p>}
              <div className="view-food__actions">
                <QuantitySelector
                  value={quantity}
                  onChange={setQuantity}
                  min={1}
                  max={10}
                  disabled={!isPurchasable}
                />
                <button
                  type="button"
                  className={`view-food__add-btn${addedToCart ? ' view-food__add-btn--added' : ''}`}
                  onClick={handleAddToCart}
                  disabled={!isPurchasable || addingToCart}
                >
                  {addedToCart ? (
                    <>
                      <IconCheck size={18} stroke={2.5} />
                      <span>Added!</span>
                    </>
                  ) : (
                    <>
                      <IconPlus size={18} stroke={2.5} />
                      <span>{addingToCart ? 'Adding...' : `Add to Cart · ${calculateTotal()}`}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {suggestedItems.length > 0 && (
          <section className="view-food__suggestions">
            <div className="view-food__suggestions-header">
              <h2 className="view-food__suggestions-title">We think you might like these</h2>
            </div>
            <div className="view-food__suggestions-scroll">
              {suggestedItems.map((item) => (
                <FoodCard
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  price={formatPrice(item.base_price)}
                  image={item.image_url}
                  to={`/cafeterias/${cafeteriaId}/menu/${item.id}`}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </PageContainer>
  );
}
