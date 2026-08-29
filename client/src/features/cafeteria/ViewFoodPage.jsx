import { useRef, useState } from 'react';
import { IconClock, IconCheck, IconPlus, IconFlame, IconLeaf, IconInfoCircle } from '@tabler/icons-react';
import { useParams } from 'react-router-dom';
import PageContainer from '../../components/layout/PageContainer.jsx';
import FoodCard from '../../components/cards/FoodCard.jsx';
import QuantitySelector from '../../components/ui/QuantitySelector.jsx';
import CustomDropdown from '../../components/ui/CustomDropdown.jsx';
import Breadcrumb from '../../components/ui/Breadcrumb.jsx';
import ViewFoodBackground from '../../components/ViewFoodBackground.jsx';
import { cafeterias, popularMeals } from '../home/homeData.js';
import './ViewFoodPage.css';

const SAMPLE_MENU_ITEM = {
  id: 'chicken-wrap',
  name: 'Chicken Wrap & Salad',
  description: 'Grilled chicken, lettuce, tomato, cucumber and mayo wrapped in a soft tortilla with a side of fresh garden salad.',
  image: popularMeals[0].image,
  basePrice: 'R45.00',
  prepMinutes: 12,
  status: 'available',
  dietaryTags: ['Halal', 'High Protein'],
  allergens: ['Gluten', 'Dairy'],
  optionGroups: [
    {
      id: 'size',
      name: 'Size',
      selectionType: 'single',
      isRequired: true,
      options: [
        { id: 'regular', name: 'Regular', priceDelta: 'R0.00' },
        { id: 'large', name: 'Large', priceDelta: 'R12.00' },
      ],
    },
    {
      id: 'extras',
      name: 'Extras',
      selectionType: 'multiple',
      isRequired: false,
      options: [
        { id: 'cheese', name: 'Extra Cheese', priceDelta: 'R5.00' },
        { id: 'bacon', name: 'Crispy Bacon', priceDelta: 'R8.00' },
        { id: 'avocado', name: 'Avocado', priceDelta: 'R10.00' },
      ],
    },
    {
      id: 'sauce',
      name: 'Sauce',
      selectionType: 'single',
      isRequired: true,
      options: [
        { id: 'mayo', name: 'Mayo', priceDelta: 'R0.00' },
        { id: 'bbq', name: 'BBQ Sauce', priceDelta: 'R0.00' },
        { id: 'sweet-chilli', name: 'Sweet Chilli', priceDelta: 'R0.00' },
        { id: 'peri-peri', name: 'Peri-Peri', priceDelta: 'R0.00' },
      ],
    },
  ],
};

const SUGGESTED_ITEMS = popularMeals.slice(0, 6);

export default function ViewFoodPage() {
  const { cafeteriaId, menuItemId } = useParams();
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [addedToCart, setAddedToCart] = useState(false);
  const specialInstructionsRef = useRef(null);
  const cafeteria = cafeterias.find((c) => c.id === cafeteriaId) || cafeterias[0];
  const menuItem = SAMPLE_MENU_ITEM;

  const calculateTotal = () => {
    let total = parseFloat(menuItem.basePrice.replace('R', ''));
    Object.values(selectedOptions).forEach((option) => {
      if (option) {
        if (Array.isArray(option)) {
          option.forEach((opt) => {
            total += parseFloat(opt.priceDelta.replace('R', ''));
          });
        } else {
          total += parseFloat(option.priceDelta.replace('R', ''));
        }
      }
    });
    return `R${total.toFixed(2)}`;
  };

  const handleOptionChange = (groupId, value) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [groupId]: value,
    }));
  };

  const handleAddToCart = () => {
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  return (
    <PageContainer className="view-food-page-container">
      <ViewFoodBackground />
      <main className="view-food-page">
        <Breadcrumb
          items={[
            { label: 'Cafeterias', to: '/cafeterias' },
            { label: cafeteria.name, to: `/cafeterias/${cafeteriaId}` },
            { label: menuItem.name }
          ]}
        />

        <div className="view-food__content">
          <div className="view-food__main">
            <div className="view-food__image-wrap">
              <img src={menuItem.image} alt={menuItem.name} className="view-food__image" />
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
                <span className="view-food__price">{menuItem.basePrice}</span>
                <span className="view-food__divider" />
                <span className="view-food__prep">
                  <IconClock size={14} stroke={1.8} />
                  {menuItem.prepMinutes} min
                </span>
              </div>

              {menuItem.dietaryTags.length > 0 && (
                <div className="view-food__section">
                  <span className="view-food__section-label">Dietary</span>
                  <div className="view-food__tags">
                    {menuItem.dietaryTags.map((tag) => (
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

              {menuItem.allergens.length > 0 && (
                <div className="view-food__section">
                  <span className="view-food__section-label">
                    <IconInfoCircle size={14} stroke={1.8} />
                    Contains
                  </span>
                  <span className="view-food__allergen-list">{menuItem.allergens.join(', ')}</span>
                </div>
              )}
            </div>
          </div>

          <div className="view-food__sidebar">
            <div className="view-food__customize">
              <h2 className="view-food__section-title">Customize</h2>

              <div className="view-food__options">
                {menuItem.optionGroups.map((group) => (
                  <div key={group.id} className="view-food__option-group">
                    <div className="view-food__option-header">
                      <span className="view-food__option-name">
                        {group.name}
                        {group.isRequired && <span className="view-food__required">*</span>}
                      </span>
                      <span className="view-food__option-hint">
                        {group.selectionType === 'single' ? 'Select one' : 'Select multiple'}
                      </span>
                    </div>
                    <CustomDropdown
                      label=""
                      placeholder={`Select ${group.name.toLowerCase()}`}
                      options={group.options}
                      value={selectedOptions[group.id]}
                      onChange={(value) => handleOptionChange(group.id, value)}
                      multiple={group.selectionType === 'multiple'}
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
                disabled={menuItem.status !== 'available'}
              >
                {addedToCart ? (
                  <>
                    <IconCheck size={18} stroke={2.5} />
                    <span>Added!</span>
                  </>
                ) : (
                  <>
                    <IconPlus size={18} stroke={2.5} />
                    <span>Add to Cart · {calculateTotal()}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <section className="view-food__suggestions">
          <div className="view-food__suggestions-header">
            <h2 className="view-food__suggestions-title">We think you might like these</h2>
          </div>
          <div className="view-food__suggestions-scroll">
            {SUGGESTED_ITEMS.map((item) => (
              <FoodCard
                key={item.id}
                {...item}
                price={item.price}
                to={`/cafeterias/${item.cafeteriaId}/menu/${item.id}`}
              />
            ))}
          </div>
        </section>
      </main>
    </PageContainer>
  );
}
