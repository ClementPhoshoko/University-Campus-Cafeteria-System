import { useEffect, useRef, useState } from 'react';
import { IconClock, IconCheck, IconPlus, IconFlame, IconLeaf, IconInfoCircle } from '@tabler/icons-react';
import { useParams } from 'react-router-dom';
import PageContainer from '../../components/layout/PageContainer.jsx';
import FoodCard from '../../components/cards/FoodCard.jsx';
import QuantitySelector from '../../components/ui/QuantitySelector.jsx';
import CustomDropdown from '../../components/ui/CustomDropdown.jsx';
import Breadcrumb from '../../components/ui/Breadcrumb.jsx';
import ViewFoodBackground from '../../components/ViewFoodBackground.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { getMenuItem, getVendor, addToCart } from '../../services/employeeApi.js';
import './ViewFoodPage.css';

function formatPrice(price) {
  const num = typeof price === 'string' ? parseFloat(price.replace(/[^0-9.]/g, '')) : price;
  return `R${Number(num || 0).toFixed(2)}`;
}

export default function ViewFoodPage() {
  const { cafeteriaId, menuItemId } = useParams();
  const { session } = useAuth();
  const token = session?.access_token;

  const [menuItem, setMenuItem] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [addedToCart, setAddedToCart] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const specialInstructionsRef = useRef(null);

  useEffect(() => {
    if (!token || !cafeteriaId || !menuItemId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getVendor(cafeteriaId, { token }),
      getMenuItem(cafeteriaId, menuItemId, { token }),
    ]).then(([vendorRes, itemRes]) => {
      if (cancelled) return;
      setVendor(vendorRes?.vendor || null);
      setMenuItem(itemRes?.menuItem || null);
      setError(null);
    }).catch((err) => {
      if (cancelled) return;
      setError(err?.message || 'Failed to load item');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [cafeteriaId, menuItemId, token]);

  const calculateTotal = () => {
    if (!menuItem) return 'R0.00';
    let total = menuItem.base_price || 0;
    Object.values(selectedOptions).forEach((option) => {
      if (option) {
        if (Array.isArray(option)) {
          option.forEach((opt) => { total += opt.price_delta || 0; });
        } else {
          total += option.price_delta || 0;
        }
      }
    });
    return formatPrice(total);
  };

  const handleOptionChange = (groupId, value) => {
    setSelectedOptions((prev) => ({ ...prev, [groupId]: value }));
  };

  const handleAddToCart = async () => {
    if (!token || addingToCart || !menuItem) return;
    setAddingToCart(true);
    try {
      const options = [];
      Object.entries(selectedOptions).forEach(([groupId, value]) => {
        const group = menuItem.option_groups?.find((g) => g.id === groupId);
        if (!group || !value) return;
        if (Array.isArray(value)) {
          value.forEach((opt) => { options.push({ optionId: opt.id, priceDelta: opt.price_delta || 0 }); });
        } else {
          options.push({ optionId: value.id, priceDelta: value.price_delta || 0 });
        }
      });
      await addToCart({
        menuItemId: menuItem.id,
        quantity,
        options,
        specialInstructions: specialInstructionsRef.current?.value || null,
      }, { token });
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    } finally {
      setAddingToCart(false);
    }
  };

  if (loading) {
    return (
      <PageContainer className="view-food-page-container">
        <ViewFoodBackground />
        <main className="view-food-page">
          <div className="view-food__empty"><p>Loading...</p></div>
        </main>
      </PageContainer>
    );
  }

  if (error || !menuItem) {
    return (
      <PageContainer className="view-food-page-container">
        <ViewFoodBackground />
        <main className="view-food-page">
          <div className="view-food__empty"><h2>Item not found</h2><p>{error || 'This menu item could not be loaded.'}</p></div>
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
            { label: menuItem.name }
          ]}
        />

        <div className="view-food__content">
          <div className="view-food__main">
            <div className="view-food__image-wrap">
              <img src={menuItem.image_url} alt={menuItem.name} className="view-food__image" />
              {menuItem.status !== 'available' && (
                <div className="view-food__status-badge">
                  {menuItem.status === 'sold_out' ? 'Sold Out' : 'Unavailable'}
                </div>
              )}
            </div>

            <div className="view-food__details">
              <div className="view-food__section">
                <h1 className="view-food__name">{menuItem.name}</h1>
                <p className="view-food__description">{menuItem.description}</p>
              </div>

              <div className="view-food__section view-food__section--row">
                <span className="view-food__price">{formatPrice(menuItem.base_price)}</span>
                <span className="view-food__divider" />
                <span className="view-food__prep">
                  <IconClock size={14} stroke={1.8} />
                  {menuItem.prep_minutes} min
                </span>
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
                  <span className="view-food__allergen-list">{menuItem.allergens.map((a) => a.name || a).join(', ')}</span>
                </div>
              )}
            </div>
          </div>

          <div className="view-food__sidebar">
            <div className="view-food__customize">
              <h2 className="view-food__section-title">Customize</h2>

              <div className="view-food__options">
                {(menuItem.option_groups || []).map((group) => (
                  <div key={group.id} className="view-food__option-group">
                    <div className="view-food__option-header">
                      <span className="view-food__option-name">
                        {group.name}
                        {group.is_required && <span className="view-food__required">*</span>}
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

              <div className="view-food__special">
                <label className="view-food__special-label" htmlFor="special-instructions">
                  Special instructions
                </label>
                <textarea
                  id="special-instructions"
                  ref={specialInstructionsRef}
                  className="view-food__special-input"
                  placeholder="Any special requests or dietary requirements..."
                  onChange={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                />
              </div>
            </div>

            <div className="view-food__actions">
              <QuantitySelector
                value={quantity}
                onChange={setQuantity}
                min={1}
                max={10}
                disabled={menuItem.status !== 'available'}
              />
              <button
                type="button"
                className={`view-food__add-btn${addedToCart ? ' view-food__add-btn--added' : ''}`}
                onClick={handleAddToCart}
                disabled={menuItem.status !== 'available' || addingToCart}
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
