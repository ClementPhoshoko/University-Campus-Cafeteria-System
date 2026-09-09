import { useEffect, useMemo, useRef, useState } from 'react';
import { IconClock, IconMapPin, IconStar, IconStarFilled, IconX, IconCheck } from '@tabler/icons-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageContainer from '../../components/layout/PageContainer.jsx';
import FoodCard from '../../components/cards/FoodCard.jsx';
import ReviewItem from '../../components/reviews/ReviewItem.jsx';
import ReviewStats from '../../components/reviews/ReviewStats.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Breadcrumb from '../../components/ui/Breadcrumb.jsx';
import BrowseCafeteriaBackground from '../../components/BrowseCafeteriaBackground.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { listVendorMenu, getVendor, addToCart } from '../../services/employeeApi.js';
import { reviews } from '../home/homeData.js';
import './browse-cafeteria.css';

const REVIEWS_PER_PAGE = 5;

const RATING_BREAKDOWN = { 5: 142, 4: 58, 3: 22, 2: 6, 1: 2 };

function formatPrice(price) {
  const num = typeof price === 'string' ? parseFloat(price.replace(/[^0-9.]/g, '')) : price;
  return `R${Number(num || 0).toFixed(2)}`;
}

function CategoryTabs({ activeCategory, onChange, counts, categoryNames }) {
  return (
    <nav className="browse_cafeteria-categories" aria-label="Menu categories">
      {categoryNames.map((category) => (
        <button
          key={category}
          type="button"
          className={`browse_cafeteria-category${activeCategory === category ? ' browse_cafeteria-category--active' : ''}`}
          onClick={() => onChange(category)}
          aria-current={activeCategory === category ? 'page' : undefined}
        >
          {category}
          {counts[category.toLowerCase()] !== undefined && (
            <span className="browse_cafeteria-category__count">{counts[category.toLowerCase()]}</span>
          )}
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
  const { session } = useAuth();
  const token = session?.access_token;

  const [vendor, setVendor] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [addedItems, setAddedItems] = useState([]);
  const [selectedRating, setSelectedRating] = useState(null);
  const [showAddReview, setShowAddReview] = useState(false);

  const isReviewsView = searchParams.get('view') === 'reviews';
  const rating = 4.6;
  const totalReviews = 230;
  const hasOrdered = true;

  useEffect(() => {
    if (!token || !cafeteriaId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getVendor(cafeteriaId, { token }),
      listVendorMenu(cafeteriaId, { token }),
    ]).then(([vendorRes, menuRes]) => {
      if (cancelled) return;
      setVendor(vendorRes?.vendor || null);
      const cats = menuRes?.categories || [];
      setCategories(cats);
      if (cats.length) setActiveCategory('All');
      setError(null);
    }).catch((err) => {
      if (cancelled) return;
      setError(err?.message || 'Failed to load menu');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [cafeteriaId, token]);

  const allItems = useMemo(() => {
    return categories.flatMap((cat) => cat.items || []);
  }, [categories]);

  const categoryNames = useMemo(() => {
    return ['All', ...categories.map((c) => c.name)];
  }, [categories]);

  const categoryCounts = useMemo(() => {
    const counts = { all: allItems.length };
    categories.forEach((cat) => { counts[cat.name.toLowerCase()] = (cat.items || []).length; });
    return counts;
  }, [categories, allItems]);

  const visibleItems = useMemo(() => {
    if (activeCategory === 'All') return allItems;
    const cat = categories.find((c) => c.name === activeCategory);
    return cat?.items || [];
  }, [activeCategory, categories, allItems]);

  const filteredReviews = useMemo(() => {
    if (!selectedRating) return reviews;
    return reviews.filter((r) => r.stars === selectedRating);
  }, [selectedRating]);

  const addItem = async (itemId) => {
    if (!token) return;
    try {
      await addToCart({ menuItemId: itemId, quantity: 1, options: [] }, { token });
      setAddedItems((current) => (current.includes(itemId) ? current : [...current, itemId]));
      setTimeout(() => setAddedItems((current) => current.filter((id) => id !== itemId)), 2000);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    }
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

  const cafeteria = vendor ? { id: vendor.id, name: vendor.name, description: vendor.description, image: vendor.logo_url, status: 'open' } : { id: cafeteriaId, name: 'Loading...', description: '', image: null, status: 'open' };

  return (
    <PageContainer className="browse_cafeteria-page-container">
      <BrowseCafeteriaBackground />
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
            <CategoryTabs activeCategory={activeCategory} onChange={setActiveCategory} counts={categoryCounts} categoryNames={categoryNames} />
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
            {loading ? (
              <div className="browse_cafeteria-empty">
                <p>Loading menu...</p>
              </div>
            ) : error ? (
              <div className="browse_cafeteria-empty">
                <h2>Unable to load menu</h2>
                <p>{error}</p>
              </div>
            ) : visibleItems.length > 0 ? (
              <div className="browse_cafeteria-item-list">
                {visibleItems.map((item) => (
                  <FoodCard
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    price={formatPrice(item.base_price)}
                    image={item.image_url}
                    description={item.description}
                    status={item.status}
                    prepMinutes={item.prep_minutes}
                    dietaryTags={item.dietary_tags || []}
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
