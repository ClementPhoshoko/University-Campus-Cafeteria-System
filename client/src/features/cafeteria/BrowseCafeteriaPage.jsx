import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconClock, IconMapPin, IconStar, IconStarFilled, IconX, IconCheck } from '@tabler/icons-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageContainer from '../../components/layout/PageContainer.jsx';
import FoodCard from '../../components/cards/FoodCard.jsx';
import ReviewItem from '../../components/reviews/ReviewItem.jsx';
import ReviewStats from '../../components/reviews/ReviewStats.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Breadcrumb from '../../components/ui/Breadcrumb.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import BrowseCafeteriaBackground from '../../components/BrowseCafeteriaBackground.jsx';
import SmartImage from '../../components/ui/SmartImage.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { listVendorMenu, getVendor, addToCart } from '../../services/employeeApi.js';
import { CACHE_TTL } from '../../services/cache.js';
import { useFetch } from '../../hooks/useFetch.js';
import '../../components/cards/CardSkeletonShimmer.css';
import './browse-cafeteria.css';

const REVIEWS_PER_PAGE = 5;
const EMPTY_CATEGORIES = [];

const RATING_BREAKDOWN = { 5: 142, 4: 58, 3: 22, 2: 6, 1: 2 };

function MenuItemSkeleton() {
  return (
    <div className="browse_cafeteria-menu-skeleton" aria-hidden="true">
      <Skeleton className="browse_cafeteria-menu-skeleton__image home_card-skeleton-shimmer" />
      <div className="browse_cafeteria-menu-skeleton__content">
        <Skeleton className="browse_cafeteria-menu-skeleton__title home_card-skeleton-shimmer" />
        <Skeleton className="browse_cafeteria-menu-skeleton__description home_card-skeleton-shimmer" />
        <Skeleton className="browse_cafeteria-menu-skeleton__description browse_cafeteria-menu-skeleton__description--short home_card-skeleton-shimmer" />
        <span className="browse_cafeteria-menu-skeleton__footer">
          <Skeleton className="browse_cafeteria-menu-skeleton__price home_card-skeleton-shimmer" />
          <Skeleton className="browse_cafeteria-menu-skeleton__action home_card-skeleton-shimmer" />
        </span>
      </div>
    </div>
  );
}

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

  const [activeCategory, setActiveCategory] = useState('All');
  const [addedItems, setAddedItems] = useState([]);
  const [selectedRating, setSelectedRating] = useState(null);
  const [showAddReview, setShowAddReview] = useState(false);
  const attemptedImageRefreshes = useRef(new Set());

  const isReviewsView = searchParams.get('view') === 'reviews';
  const loadVendor = useCallback(async ({ signal }) => {
    const cafeteriaRes = await getVendor(cafeteriaId, { token, signal, cache: 'no-cache' });
    return cafeteriaRes?.vendor || null;
  }, [cafeteriaId, token]);
  const vendorFeed = useFetch(loadVendor, {
    cacheKey: cafeteriaId ? `employee:vendor-detail:${cafeteriaId}` : null,
    enabled: Boolean(token && cafeteriaId),
    staleTime: CACHE_TTL.employeeVendorDetail,
  });
  const loadMenu = useCallback(async ({ signal }) => {
    const menuRes = await listVendorMenu(cafeteriaId, { token, signal, cache: 'no-cache' });
    return { vendorId: cafeteriaId, categories: menuRes?.categories || [] };
  }, [cafeteriaId, token]);
  const menuFeed = useFetch(loadMenu, {
    cacheKey: cafeteriaId ? `employee:menu:${cafeteriaId}` : null,
    enabled: Boolean(token && cafeteriaId),
    staleTime: CACHE_TTL.employeeMenu,
  });
  const vendor = token && cafeteriaId && vendorFeed.data?.id === cafeteriaId
    ? vendorFeed.data
    : null;
  const menuCatalog = token && cafeteriaId && menuFeed.data?.vendorId === cafeteriaId
    ? menuFeed.data
    : null;
  const categories = menuCatalog?.categories || EMPTY_CATEGORIES;
  const vendorLoading = Boolean(token && cafeteriaId) && vendorFeed.isLoading && !vendor;
  const menuLoading = Boolean(token && cafeteriaId) && menuFeed.isLoading && !menuCatalog;
  const vendorError = vendorFeed.error && !vendor
    ? vendorFeed.error?.message || 'Unable to load cafeteria details.'
    : null;
  const menuError = menuFeed.error && !menuCatalog
    ? menuFeed.error?.message || 'Failed to load menu'
    : null;
  const catalogRefreshError = (vendorFeed.error && vendor) || (menuFeed.error && menuCatalog)
    ? 'Could not refresh the latest cafeteria information. Showing the last loaded information.'
    : null;
  const rating = vendor?.average_rating ? Number(vendor.average_rating) : 0;
  const totalReviews = Number(vendor?.rating_count || 0);
  const hasOrdered = false;

  useEffect(() => {
    setActiveCategory('All');
  }, [cafeteriaId]);

  useEffect(() => {
    if (activeCategory !== 'All' && menuCatalog && !categories.some((category) => category.name === activeCategory)) {
      setActiveCategory('All');
    }
  }, [activeCategory, categories, menuCatalog]);

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

  const filteredReviews = useMemo(() => [], [selectedRating]);

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

  const refreshVendorImage = async (failedImage) => {
    const refreshKey = `vendor:${cafeteriaId}`;
    if (!cafeteriaId || attemptedImageRefreshes.current.has(refreshKey)) return;
    attemptedImageRefreshes.current.add(refreshKey);

    try {
      const response = await getVendor(cafeteriaId, { token, cache: 'no-cache', refreshImages: true });
      const image = response?.vendor?.logo_url;
      if (!image || image === failedImage) {
        console.error(`Unable to refresh cafeteria image for vendor ${cafeteriaId}: no new image URL was returned.`);
        return;
      }
      vendorFeed.mutate((current) => current?.id === cafeteriaId ? { ...current, logo_url: image } : current);
    } catch (error) {
      console.error(`Unable to refresh cafeteria image for vendor ${cafeteriaId}:`, error);
    }
  };

  const refreshMenuItemImage = async (itemId, vendorId, failedImage) => {
    const refreshKey = `menu:${vendorId}:${itemId}`;
    if (!itemId || vendorId !== cafeteriaId || attemptedImageRefreshes.current.has(refreshKey)) return;
    attemptedImageRefreshes.current.add(refreshKey);

    try {
      const response = await listVendorMenu(vendorId, { token, cache: 'no-cache', refreshImages: true });
      const freshItem = response?.categories
        ?.flatMap((category) => category.items || [])
        .find((item) => item.id === itemId);
      if (!freshItem?.image_url || freshItem.image_url === failedImage) {
        console.error(`Unable to refresh menu image for item ${itemId}: no new image URL was returned.`);
        return;
      }
      menuFeed.mutate((current) => {
        if (!current || current.vendorId !== vendorId) return current;
        return {
          ...current,
          categories: current.categories.map((category) => ({
            ...category,
            items: category.items.map((item) => (
              item.id === itemId ? { ...item, image_url: freshItem.image_url } : item
            )),
          })),
        };
      });
    } catch (error) {
      console.error(`Unable to refresh menu image for item ${itemId}:`, error);
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

  const cafeteria = vendor
    ? {
        id: vendor.id,
        name: vendor.name,
        description: vendor.description,
        image: vendor.logo_url,
        status: vendor.service_status || 'closed',
        walkTime: '6 min',
        prepWindow: vendor.estimated_prep_minutes ? `${vendor.estimated_prep_minutes} min` : '15 min',
        locations: vendor.locations || [],
      }
    : { id: cafeteriaId, name: 'Loading...', description: '', image: null, status: 'open', walkTime: '—', prepWindow: '—', locations: [] };

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
            <SmartImage
              src={cafeteria.image}
              alt={cafeteria.name}
              eager
              width={220}
              height={180}
              onError={vendor ? () => refreshVendorImage(cafeteria.image) : undefined}
            />
          </div>
          <div className="browse_cafeteria-header-content">
            {vendor ? (
              <>
                <div className="browse_cafeteria-heading-line">
                  <span className={`browse_cafeteria-status browse_cafeteria-status--${cafeteria.status}`}>
                    <span aria-hidden="true" />
                    {cafeteria.status === 'busy' ? 'Busy right now' : cafeteria.status === 'closed' ? 'Closed' : 'Open now'}
                  </span>
                </div>
                <h1>{cafeteria.name}</h1>
                <p className="browse_cafeteria-description">{cafeteria.description}</p>
              </>
            ) : vendorLoading ? (
              <div className="browse_cafeteria-header-skeleton" role="status" aria-label="Loading cafeteria details">
                <Skeleton className="browse_cafeteria-header-skeleton__status home_card-skeleton-shimmer" />
                <Skeleton className="browse_cafeteria-header-skeleton__title home_card-skeleton-shimmer" />
                <Skeleton className="browse_cafeteria-header-skeleton__description home_card-skeleton-shimmer" />
                <Skeleton className="browse_cafeteria-header-skeleton__description browse_cafeteria-header-skeleton__description--short home_card-skeleton-shimmer" />
              </div>
            ) : (
              <>
                <h1>Cafeteria unavailable</h1>
                <p className="browse_cafeteria-load-error" role="alert">{vendorError || 'Unable to load cafeteria details.'}</p>
              </>
            )}
            {cafeteria.locations.length > 0 && (
              <p className="browse_cafeteria-description">
                Available at: {cafeteria.locations.map((item) => {
                  const place = [item.site_name, item.building_name].filter(Boolean).join(' · ');
                  const details = [
                    item.service_status,
                    item.estimated_prep_minutes ? `${item.estimated_prep_minutes} min prep` : null,
                  ].filter(Boolean).join(', ');
                  return details ? `${place} (${details})` : place;
                }).join(', ')}
              </p>
            )}
            {vendor && <div className="browse_cafeteria-meta">
              <span><IconMapPin size={15} /> {cafeteria.walkTime} walk</span>
              <span><IconClock size={15} /> {cafeteria.prepWindow}</span>
              <button type="button" className="browse_cafeteria-reviews-link" onClick={showReviews}>
                <IconStar size={15} /> {rating} <small>{totalReviews} reviews</small>
              </button>
            </div>}
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
            {catalogRefreshError && (
              <div className="browse_cafeteria-empty" role="status">
                <p>{catalogRefreshError}</p>
              </div>
            )}
            {menuLoading ? (
              <div className="browse_cafeteria-item-list browse_cafeteria-menu-skeleton-list" role="status" aria-label="Loading menu items" aria-busy="true">
                {Array.from({ length: 4 }, (_, index) => <MenuItemSkeleton key={index} />)}
              </div>
            ) : menuError ? (
              <div className="browse_cafeteria-empty">
                <h2>Unable to load menu</h2>
                <p>{menuError}</p>
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
                    vendorId={cafeteriaId}
                    onImageError={refreshMenuItemImage}
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
