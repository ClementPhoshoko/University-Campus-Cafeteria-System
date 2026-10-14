import { useRef, useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  IconSearch,
  IconMapPin,
  IconChevronRight,
  IconChevronDown,
  IconChevronLeft,
  IconArrowRight,
} from '@tabler/icons-react';
import { useAuth } from '../../hooks/useAuth.js';
import PageContainer from '../../components/layout/PageContainer.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import SectionHeader from '../../components/layout/SectionHeader.jsx';
import CategoryCard from '../../components/cards/CategoryCard.jsx';
import CategoryCardSkeleton from '../../components/cards/CategoryCardSkeleton.jsx';
import CafeteriaCard from '../../components/cards/CafeteriaCard.jsx';
import CafeteriaCardSkeleton from '../../components/cards/CafeteriaCardSkeleton.jsx';
import FoodCard from '../../components/cards/FoodCard.jsx';
import FoodCardSkeleton from '../../components/cards/FoodCardSkeleton.jsx';
import ReviewItem from '../../components/reviews/ReviewItem.jsx';
import androidBadge from '../../assets/android_download-PJqqAvJc.webp';
import iosBadge from '../../assets/ios_download-Dn_KtiFi.webp';
import HeroFoodShowcase from '../../components/hero/HeroFoodShowcase.jsx';
import { getVendor, getPopularMenuItems, listVendors, listVendorMenu, listVendorCategoryCatalog } from '../../services/employeeApi.js';
import { CACHE_TTL } from '../../services/cache.js';
import { useFetch } from '../../hooks/useFetch.js';
import { mapVendorToCafeteriaCard, mapFeaturedMenuItems, mapMenuItemToMeal } from './homeTransform.js';
import { deliveryImage, reviewsImage, heroImage, heroFoods } from './homeData.js';
import './home.css';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
}

function useScrollProgress() {
  const scrollRef = useRef(null);
  const fillRef = useRef(null);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    const fill = fillRef.current;
    if (!el || !fill) return;
    const pct = el.scrollWidth <= el.clientWidth
      ? 0
      : (el.scrollLeft / (el.scrollWidth - el.clientWidth)) * 100;
    fill.style.width = `${pct}%`;
  }, []);

  return { scrollRef, fillRef, onScroll };
}

function ScrollIndicator({ fillRef }) {
  return (
    <div className="home_scroll-indicator">
      <div className="home_scroll-track">
        <div className="home_scroll-fill" ref={fillRef} />
      </div>
    </div>
  );
}

export default function HomePage() {
  const { profile, session } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const cafeteria = useScrollProgress();
  const meals = useScrollProgress();
  const token = session?.access_token;

  const attemptedImageRefreshes = useRef(new Set());
  const loadHome = useCallback(async ({ signal }) => {
    const cafeteriasResponse = await listVendors({
      limit: 6,
      token,
      signal,
      cache: 'no-cache',
    });
    const cafeteriaList = cafeteriasResponse?.vendors || [];
    const mappedCafeterias = cafeteriaList.map(mapVendorToCafeteriaCard);

    const [menuResponses, popularResult] = await Promise.all([
      Promise.all(
        cafeteriaList.map((cafeteria) => cafeteria.id
          ? listVendorMenu(cafeteria.id, { token, signal, cache: 'no-cache' }).catch((error) => {
            console.error(`Failed to load menu for cafeteria ${cafeteria.id}:`, error);
            return { categories: [] };
          })
          : Promise.resolve({ categories: [] }))
      ),
      getPopularMenuItems({ token, signal, cache: 'no-cache' }).then(
        (response) => ({ response, error: null }),
        (error) => {
          console.error('Failed to load popular menu items:', error);
          return { response: null, error };
        },
      ),
    ]);

    const popularResponse = popularResult.response;
    const hasRankedItems = Array.isArray(popularResponse?.items) && popularResponse.items.length > 0;
    const popularSource = hasRankedItems ? (popularResponse.source || 'sales') : 'featured';
    const popularMeals = hasRankedItems ? popularResponse.items.map((item) => ({
      ...mapMenuItemToMeal(item, item.vendor_name),
      vendorId: item.vendor_id,
      source: popularSource,
    })) : mapFeaturedMenuItems(menuResponses, cafeteriaList);
    return {
      cafeterias: mappedCafeterias,
      popularMeals,
      popularSource,
      popularError: popularResult.error && popularMeals.length === 0
        ? 'Unable to load popular meals right now.'
        : null,
    };
  }, [token]);
  const homeFeed = useFetch(loadHome, {
    cacheKey: 'employee:home-feed',
    enabled: Boolean(token),
    staleTime: CACHE_TTL.employeeHomeFeed,
  });
  const loadCategories = useCallback(async ({ signal }) => {
    const response = await listVendorCategoryCatalog({ token, signal, cache: 'no-cache' });
    return (response?.categories || []).map((category) => ({
      id: category.id,
      name: category.name,
      image: category.image_url || '',
    }));
  }, [token]);
  const categoryFeed = useFetch(loadCategories, {
    cacheKey: 'employee:vendor-categories',
    enabled: Boolean(token),
    staleTime: CACHE_TTL.employeeVendorCategories,
  });
  const feed = token ? homeFeed.data : null;
  const cafeterias = feed?.cafeterias || [];
  const popularMeals = feed?.popularMeals || [];
  const popularSource = feed?.popularSource || 'sales';
  const categories = token ? categoryFeed.data || [] : [];
  const categoryLoading = Boolean(token) && categoryFeed.isLoading && !categoryFeed.data;
  const categoryError = categoryFeed.error && !categoryFeed.data
    ? categoryFeed.error?.message || 'Unable to load categories.'
    : null;
  const homeError = homeFeed.error && !feed
    ? homeFeed.error?.message || 'Unable to load the home feed right now.'
    : null;
  const homeRefreshError = homeFeed.error && feed
    ? 'Could not refresh cafeteria information. Showing the last loaded data.'
    : null;
  const popularError = feed?.popularError || null;
  const homeLoading = Boolean(token) && homeFeed.isLoading && !feed;

  const refreshCafeteriaImage = async (vendorId, failedImage) => {
    const refreshKey = `${vendorId}:${failedImage}`;
    if (!vendorId || attemptedImageRefreshes.current.has(refreshKey)) return;
    attemptedImageRefreshes.current.add(refreshKey);

    try {
      const response = await getVendor(vendorId, { token, cache: 'no-cache' });
      const image = response?.vendor?.logo_url;
      if (!image || image === failedImage) return;
      homeFeed.mutate((current) => current && ({
        ...current,
        cafeterias: current.cafeterias.map((cafeteria) => (
          cafeteria.id === vendorId ? { ...cafeteria, image } : cafeteria
        )),
      }));
    } catch (error) {
      console.error(`Unable to refresh cafeteria image for vendor ${vendorId}:`, error);
    }
  };

  const PER_PAGE = 3;
  const homeReviews = [];
  const totalPages = Math.max(1, Math.ceil(homeReviews.length / PER_PAGE));
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewAnim, setReviewAnim] = useState('entering');
  const [searchQuery, setSearchQuery] = useState('');
  const timeoutRef = useRef(null);

  const pageReviews = homeReviews.slice(reviewPage * PER_PAGE, reviewPage * PER_PAGE + PER_PAGE);

  const goToPage = useCallback((next) => {
    if (next < 0 || next >= totalPages || next === reviewPage) return;
    setReviewAnim('exiting');
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setReviewPage(next);
      setReviewAnim('entering');
    }, 200);
  }, [reviewPage, totalPages]);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return (
    <PageContainer noPad>
      <div className="home-hero">
        <img src={heroImage} alt="" className="home-hero-bg" aria-hidden="true" loading="eager" />
        <div className="home-hero-inner">
          <div className="home-hero-left">
            <PageHeader
              eyebrow={greeting()}
              title={`${firstName} 👋`}
              subtitle="What are you eating today?"
              actions={
                <button type="button" className="home_location-pill" aria-label="Change building">
                  <IconMapPin size={16} stroke={1.8} />
                  Merchant Place
                  <IconChevronDown size={15} stroke={2} />
                </button>
              }
            />
            <div className="search-field">
              <IconSearch size={18} stroke={1.8} />
              <input
                type="search"
                placeholder="Search cafeterias or meals…"
                aria-label="Search cafeterias or meals"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              className={`search-btn${searchQuery.trim() ? ' search-btn--visible' : ''}`}
            >
              <IconSearch size={16} stroke={2} />
              Search
            </button>
          </div>
          <div className="home-hero-right">
            <HeroFoodShowcase items={heroFoods} />
          </div>
        </div>
      </div>

      <div className="home-content">
        {homeRefreshError && <p className="home_loading-text" role="status">{homeRefreshError}</p>}
        <section aria-label="Our cafeterias">
          <SectionHeader title="Our cafeterias" actionLabel="View all" actionTo="/cafeterias" />
          {homeLoading ? (
            <>
              <div className="home_cafeteria-scroll" role="status" aria-label="Loading cafeterias">
                {Array.from({ length: 5 }, (_, index) => (
                  <CafeteriaCardSkeleton key={index} />
                ))}
              </div>
              <ScrollIndicator fillRef={cafeteria.fillRef} />
            </>
          ) : homeError ? (
            <p className="home_loading-text">{homeError}</p>
          ) : (
            <>
              <div className="home_cafeteria-scroll" ref={cafeteria.scrollRef} onScroll={cafeteria.onScroll}>
                {cafeterias.map((v) => (
                  <CafeteriaCard
                    key={v.id}
                    id={v.id}
                    name={v.name}
                    status={v.status}
                    image={v.image}
                    description={v.description}
                    prepWindow={v.prepWindow}
                    rating={v.rating}
                    reviewCount={v.reviewCount}
                    location={v.location}
                    locations={v.locations}
                    onImageError={refreshCafeteriaImage}
                    to={`/cafeterias/${v.id}`}
                  />
                ))}

                <Link to="/cafeterias" className="home_cafeteria-more" aria-label="View all cafeterias">
                  <IconChevronRight size={26} stroke={2.2} />
                </Link>
              </div>
              <ScrollIndicator fillRef={cafeteria.fillRef} />
            </>
          )}
        </section>

        <section aria-label={popularSource === 'featured' ? 'Featured meals' : 'Popular meals'} style={{ marginTop: 'var(--space-8)' }}>
          <SectionHeader title={popularSource === 'featured' ? 'Featured meals' : 'Popular right now'} actionLabel="View all" actionTo="/cafeterias" />
          {homeLoading ? (
            <div className="home_meals-scroll" role="status" aria-label="Loading popular meals">
              {Array.from({ length: 5 }, (_, index) => (
                <FoodCardSkeleton key={index} />
              ))}
            </div>
          ) : popularError ? (
            <p className="home_loading-text">{popularError}</p>
          ) : popularMeals.length === 0 ? (
            <p className="home_loading-text">No available meals right now. Please check back soon.</p>
          ) : (
            <div className="home_meals-scroll" ref={meals.scrollRef} onScroll={meals.onScroll}>
              {popularMeals.map((m, index) => (
                <FoodCard
                  key={`${m.vendorId}-${m.id}`}
                  id={m.id}
                  name={m.name}
                  price={m.price}
                  cafeteriaName={m.cafeteriaName}
                  image={m.image}
                  bestSeller={m.source === 'sales' && index < 3}
                  to={`/cafeterias/${m.vendorId}/menu/${m.id}`}
                />
              ))}
              <Link to="/cafeterias" className="home_cafeteria-more" aria-label="View all meals">
                <IconChevronRight size={26} stroke={2.2} />
              </Link>
            </div>
          )}
          {!homeLoading && <ScrollIndicator fillRef={meals.fillRef} />}
        </section>

        <section aria-label="Shop by category" style={{ marginTop: 'var(--space-8)' }}>
          <SectionHeader title="Shop by category" />
          <div className="home_category-scroll">
            {categoryLoading
              ? Array.from({ length: 6 }, (_, index) => <CategoryCardSkeleton key={index} />)
              : categoryError
                ? <p className="home_loading-text" role="alert">{categoryError}</p>
                : categories.map((c) => (
                  <CategoryCard key={c.id} id={c.id} name={c.name} image={c.image} filterId={c.name} />
                ))}
          </div>
        </section>

        <section className="home_delivery" aria-label="Why order with us">
          <div className="home_delivery-content">
            <span className="home_delivery-label">Why order with us</span>
            <h2 className="home_delivery-title">
              Skip the queue,{'\n'}
              eat on your terms
            </h2>
            <p className="home_delivery-desc">
              Order ahead from your favourite spots and pick up when it suits you.
              No waiting, no stress — just great food, ready when you are.
            </p>
            <button type="button" className="home_delivery-btn">
              Start Order
              <IconArrowRight size={18} stroke={2} />
            </button>
          </div>
          <div className="home_delivery-image">
            <img src={deliveryImage} alt="" loading="lazy" />
          </div>
        </section>

        {pageReviews.length > 0 && (
          <div className="home_reviews-wrap">
            <div className="home_reviews-image">
              <img src={reviewsImage} alt="" loading="lazy" />
            </div>
            <div className="home_reviews-content">
              <h2 className="home_reviews-title">What colleagues are saying</h2>
              <p className="home_reviews-subtitle">Real reviews from the workplace community</p>
              <div className="home_reviews-list" key={reviewPage}>
                {pageReviews.map((r) => (
                  <ReviewItem
                    key={r.id}
                    name={r.name}
                    stars={r.stars}
                    role={r.role}
                    text={r.text}
                    animState={reviewAnim}
                  />
                ))}
              </div>
              <div className="home_reviews-pagination">
                <button
                  type="button"
                  className="home_reviews-page-btn"
                  disabled={reviewPage === 0}
                  onClick={() => goToPage(reviewPage - 1)}
                  aria-label="Previous reviews"
                >
                  <IconChevronLeft size={18} stroke={2} />
                </button>
                <div className="home_reviews-dots">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className="home_reviews-dot"
                      data-active={i === reviewPage}
                      onClick={() => goToPage(i)}
                      aria-label={`Go to page ${i + 1}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="home_reviews-page-btn"
                  disabled={reviewPage === totalPages - 1}
                  onClick={() => goToPage(reviewPage + 1)}
                  aria-label="Next reviews"
                >
                  <IconChevronRight size={18} stroke={2} />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="home_app-download">
          <p className="home_app-download-text">
            You can also download and order your food on our mobile apps
          </p>
          <div className="home_app-download-badges">
            <a href="#" className="home_app-badge" aria-label="Download on Android">
              <img src={androidBadge} alt="Get it on Google Play" loading="lazy" />
            </a>
            <a href="#" className="home_app-badge" aria-label="Download on iOS">
              <img src={iosBadge} alt="Download on the App Store" loading="lazy" />
            </a>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
