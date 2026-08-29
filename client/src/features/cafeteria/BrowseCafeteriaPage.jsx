import { useMemo, useRef, useState } from 'react';
import { IconClock, IconMapPin, IconStar, IconStarFilled, IconX, IconCheck } from '@tabler/icons-react';
import { useParams, useSearchParams } from 'react-router-dom';
import PageContainer from '../../components/layout/PageContainer.jsx';
import FoodCard from '../../components/cards/FoodCard.jsx';
import ReviewItem from '../../components/reviews/ReviewItem.jsx';
import ReviewStats from '../../components/reviews/ReviewStats.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Breadcrumb from '../../components/ui/Breadcrumb.jsx';
import { cafeterias, popularMeals, reviews } from '../home/homeData.js';
import imgSlusher from '../../assets/drinks/Refreshing_Slusher_with_Ice.png';
import imgWater from '../../assets/drinks/Merchant_Munchies_H2O_Refreshment.png';
import imgChocolateMilk from '../../assets/drinks/Indulgent_Chocolate_Milk_Splash.png';
import imgCoke from '../../assets/drinks/Condensation-Kissed_Coca-Cola_Can.png';
import imgLager from '../../assets/drinks/Merchant_Munchies_Premium_Lager.png';
import './browse-cafeteria.css';

const MENU_CATEGORIES = ['Popular', 'Breakfast', 'Lunch', 'Meals', 'Snacks', 'Drinks'];

const REVIEWS_PER_PAGE = 5;

const RATING_BREAKDOWN = { 5: 142, 4: 58, 3: 22, 2: 6, 1: 2 };

const MENU_ITEMS = [
  { id: 'menu-item-1', menuItemId: 'chicken-wrap', categoryId: 'popular', name: 'Chicken Wrap', description: 'Grilled chicken, lettuce, tomato, cucumber and mayo.', image: popularMeals[0].image, basePrice: 'R42.00', prepMinutes: 12, status: 'available', dietaryTags: ['Popular'] },
  { id: 'menu-item-2', menuItemId: 'grilled-chicken-rice', categoryId: 'lunch', name: 'Grilled Chicken & Rice', description: 'Juicy grilled chicken with seasoned rice and vegetables.', image: popularMeals[1].image, basePrice: 'R49.00', prepMinutes: 15, status: 'available', dietaryTags: ['High protein'] },
  { id: 'menu-item-3', menuItemId: 'beef-burger', categoryId: 'meals', name: 'Beef Burger', description: 'Beef patty, cheese, fresh lettuce, tomato, onion and burger sauce.', image: popularMeals[3].image, basePrice: 'R45.00', prepMinutes: 14, status: 'available', dietaryTags: [] },
  { id: 'menu-item-4', menuItemId: 'vegetable-pasta', categoryId: 'meals', name: 'Vegetable Pasta', description: 'Penne pasta with mixed vegetables in a creamy herb sauce.', image: popularMeals[8].image, basePrice: 'R40.00', prepMinutes: 12, status: 'available', dietaryTags: ['Vegetarian'] },
  { id: 'menu-item-5', menuItemId: 'fresh-fruit-cup', categoryId: 'snacks', name: 'Fresh Fruit Cup', description: 'A refreshing mix of seasonal fresh fruits.', image: popularMeals[2].image, basePrice: 'R22.00', prepMinutes: 5, status: 'available', dietaryTags: ['Fresh', 'Healthy'] },
  { id: 'menu-item-6', menuItemId: 'tea-scones', categoryId: 'breakfast', name: 'Tea & Berry Scones', description: 'Berry scones served with a fresh brewed tea.', image: popularMeals[2].image, basePrice: 'R28.00', prepMinutes: 8, status: 'available', dietaryTags: ['Breakfast'] },
  { id: 'menu-item-7', menuItemId: 'iced-vanilla-latte', categoryId: 'drinks', name: 'Iced Vanilla Latte', description: 'Smooth espresso blended with cold milk and vanilla syrup.', image: imgSlusher, basePrice: 'R32.00', prepMinutes: 3, status: 'available', dietaryTags: ['Cold'] },
  { id: 'menu-item-8', menuItemId: 'still-water', categoryId: 'drinks', name: 'Still Water 500ml', description: 'Pure, crisp still water to keep you hydrated throughout the day.', image: imgWater, basePrice: 'R15.00', prepMinutes: 1, status: 'available', dietaryTags: ['Cold', 'Healthy'] },
  { id: 'menu-item-9', menuItemId: 'chocolate-milkshake', categoryId: 'drinks', name: 'Chocolate Milkshake', description: 'Rich, creamy chocolate milkshake made with real cocoa.', image: imgChocolateMilk, basePrice: 'R28.00', prepMinutes: 4, status: 'available', dietaryTags: ['Cold'] },
  { id: 'menu-item-10', menuItemId: 'coca-cola', categoryId: 'drinks', name: 'Coca-Cola 330ml', description: 'Classic ice-cold Coca-Cola, perfectly carbonated.', image: imgCoke, basePrice: 'R18.00', prepMinutes: 1, status: 'available', dietaryTags: ['Cold'] },
  { id: 'menu-item-11', menuItemId: 'premium-lager', categoryId: 'drinks', name: 'Premium Lager 330ml', description: 'Crisp, refreshing craft lager brewed locally.', image: imgLager, basePrice: 'R35.00', prepMinutes: 2, status: 'available', dietaryTags: ['Cold'] },
  { id: 'menu-item-12', menuItemId: 'fresh-orange-juice', categoryId: 'drinks', name: 'Fresh Orange Juice', description: 'Freshly squeezed orange juice, no added sugar.', image: imgSlusher, basePrice: 'R24.00', prepMinutes: 3, status: 'available', dietaryTags: ['Fresh', 'Healthy'] },
];

function CategoryTabs({ activeCategory, onChange }) {
  return (
    <nav className="browse_cafeteria-categories" aria-label="Menu categories">
      {MENU_CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          className={`browse_cafeteria-category${activeCategory === category ? ' browse_cafeteria-category--active' : ''}`}
          onClick={() => onChange(category)}
          aria-current={activeCategory === category ? 'page' : undefined}
        >
          {category}
        </button>
      ))}
    </nav>
  );
}

function SearchRow() {
  return (
    <div className="browse_cafeteria-search-row">
      <div className="search-field">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input type="search" placeholder="Search menu..." aria-label="Search menu items" />
      </div>
    </div>
  );
}

function ReviewsSection({ rating, totalReviews, filteredReviews, selectedRating, onRatingClick, onClose, cafeteriaName, hasOrdered, showAddReview, onToggleAddReview, onSubmitReview }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const reviewTextareaRef = useRef(null);
  const totalPages = Math.ceil(filteredReviews.length / REVIEWS_PER_PAGE);
  const startIndex = (currentPage - 1) * REVIEWS_PER_PAGE;
  const visibleReviews = filteredReviews.slice(startIndex, startIndex + REVIEWS_PER_PAGE);

  const handleSubmit = async () => {
    if (reviewRating === 0) return;
    setIsSubmitting(true);
    await onSubmitReview({ rating: reviewRating, comment: reviewComment });
    setReviewRating(0);
    setReviewComment('');
    setIsSubmitting(false);
  };

  const handleCancel = () => {
    setReviewRating(0);
    setReviewComment('');
    onToggleAddReview();
  };

  return (
    <section className="browse_cafeteria-reviews" aria-live="polite" aria-label="Reviews">
      <div className="browse_cafeteria-reviews-header">
        <div>
          <span className="browse_cafeteria-eyebrow">Customer feedback</span>
          <h2>{selectedRating ? `${selectedRating} Star Reviews` : 'Reviews'}</h2>
        </div>
        <div className="browse_cafeteria-reviews-actions">
          {hasOrdered && !showAddReview && (
            <button type="button" className="browse_cafeteria-reviews-new" onClick={onToggleAddReview}>
              New
            </button>
          )}
          <button type="button" className="browse_cafeteria-reviews-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="browse_cafeteria-reviews-grid">
        <ReviewStats
          rating={rating}
          totalReviews={totalReviews}
          ratingBreakdown={RATING_BREAKDOWN}
          selectedRating={selectedRating}
          onRatingClick={onRatingClick}
        />

        <div className="browse_cafeteria-reviews-list">
          {showAddReview && (
            <div className="browse_cafeteria-reviews-add">
              <div className="home_review-head">
                <span className="browse_cafeteria-reviews-add-label">Give us rating</span>
                <div className="home_review-stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="browse_cafeteria-reviews-add-star"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setReviewRating(star)}
                    >
                      {(hoverRating || reviewRating) >= star ? (
                        <IconStarFilled size={20} stroke={0} />
                      ) : (
                        <IconStar size={20} stroke={1.5} />
                      )}
                    </button>
                  ))}
                </div>
                <div className="browse_cafeteria-reviews-add-actions">
                  <button
                    type="button"
                    className="browse_cafeteria-reviews-add-btn"
                    onClick={handleCancel}
                    aria-label="Cancel"
                  >
                    <IconX size={14} stroke={1.5} />
                  </button>
                  <button
                    type="button"
                    className="browse_cafeteria-reviews-add-btn browse_cafeteria-reviews-add-btn-submit"
                    onClick={handleSubmit}
                    disabled={reviewRating === 0 || isSubmitting}
                    aria-label="Submit review"
                  >
                    <IconCheck size={14} stroke={1.5} />
                  </button>
                </div>
              </div>
              <textarea
                ref={reviewTextareaRef}
                className="browse_cafeteria-reviews-add-input"
                placeholder="Share your experience..."
                value={reviewComment}
                onChange={(e) => {
                  setReviewComment(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
              />
            </div>
          )}

          <div className="browse_cafeteria-reviews-items">
            {visibleReviews.map((review) => (
              <ReviewItem
                key={review.id}
                name={review.name}
                stars={review.stars}
                role={review.role}
                text={review.text}
              />
            ))}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </section>
  );
}

export default function BrowseCafeteriaPage() {
  const navigate = useNavigate();
  const { cafeteriaId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState('Popular');
  const [addedItems, setAddedItems] = useState([]);
  const [selectedRating, setSelectedRating] = useState(null);
  const [showAddReview, setShowAddReview] = useState(false);
  const cafeteria = cafeterias.find((item) => item.id === cafeteriaId) || cafeterias[0];

  const isReviewsView = searchParams.get('view') === 'reviews';
  const rating = 4.6;
  const totalReviews = 230;
  const hasOrdered = true;

  const visibleItems = useMemo(() => {
    if (activeCategory === 'Popular') return MENU_ITEMS.filter((item) => item.categoryId === 'popular' || item.categoryId === 'lunch');
    return MENU_ITEMS.filter((item) => item.categoryId === activeCategory.toLowerCase());
  }, [activeCategory]);

  const filteredReviews = useMemo(() => {
    if (!selectedRating) return reviews;
    return reviews.filter((r) => r.stars === selectedRating);
  }, [selectedRating]);

  const addItem = (itemId) => {
    setAddedItems((current) => (current.includes(itemId) ? current : [...current, itemId]));
  };

  const showReviews = () => {
    setSelectedRating(null);
    setShowAddReview(false);
    setSearchParams({ view: 'reviews' });
  };

  const handleReviewSubmit = async (reviewData) => {
    console.log('Submitting review:', reviewData);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <PageContainer className="browse_cafeteria-page-container">
      <main className="browse_cafeteria-page">
        <Breadcrumb
          items={[
            { label: 'Cafeterias', to: '/cafeterias' },
            { label: cafeteria.name }
          ]}
        />

        <header className="browse_cafeteria-header">
          <div className="browse_cafeteria-header-image">
            <img src={cafeteria.image} alt="" />
          </div>
          <div className="browse_cafeteria-header-content">
            <div className="browse_cafeteria-heading-line">
              <span className={`browse_cafeteria-status browse_cafeteria-status--${cafeteria.status}`}>
                <span aria-hidden="true" />
                {cafeteria.status === 'busy' ? 'Busy right now' : cafeteria.status === 'closed' ? 'Closed' : 'Open now'}
              </span>
            </div>
            <h1>{cafeteria.name}</h1>
            <p className="browse_cafeteria-description">{cafeteria.description}</p>
            <div className="browse_cafeteria-meta">
              <span><IconMapPin size={15} /> {cafeteria.walkTime} walk</span>
              <span><IconClock size={15} /> {cafeteria.prepWindow}</span>
              <button type="button" className="browse_cafeteria-reviews-link" onClick={showReviews}>
                <IconStar size={15} /> {rating} <small>{totalReviews} reviews</small>
              </button>
            </div>
          </div>
        </header>

        {!isReviewsView && (
          <div className="browse_cafeteria-controls">
            <CategoryTabs activeCategory={activeCategory} onChange={setActiveCategory} />
            <SearchRow />
          </div>
        )}

        {isReviewsView ? (
          <ReviewsSection
            rating={rating}
            totalReviews={totalReviews}
            filteredReviews={filteredReviews}
            selectedRating={selectedRating}
            onRatingClick={setSelectedRating}
            onClose={() => setSearchParams({})}
            cafeteriaName={cafeteria.name}
            hasOrdered={hasOrdered}
            showAddReview={showAddReview}
            onToggleAddReview={() => setShowAddReview(!showAddReview)}
            onSubmitReview={handleReviewSubmit}
          />
        ) : (
          <section className="browse_cafeteria-menu" aria-live="polite" aria-label={`${activeCategory} menu`}>
            <div className="browse_cafeteria-menu-heading">
              <div>
                <span className="browse_cafeteria-eyebrow">Today&apos;s menu</span>
                <h2>{activeCategory}</h2>
              </div>
              <span className="browse_cafeteria-item-count">{visibleItems.length} items</span>
            </div>
            {visibleItems.length > 0 ? (
              <div className="browse_cafeteria-item-list">
                {visibleItems.map((item) => (
                  <FoodCard
                    key={item.id}
                    {...item}
                    price={item.basePrice}
                    variant="browse"
                    added={addedItems.includes(item.id)}
                    onAdd={() => addItem(item.id)}
                    to={`/cafeterias/${cafeteriaId}/menu/${item.id}`}
                  />
                ))}
              </div>
            ) : (
              <div className="browse_cafeteria-empty">
                <h2>No meals available right now</h2>
                <p>Try another menu category.</p>
              </div>
            )}
          </section>
        )}
      </main>
    </PageContainer>
  );
}
