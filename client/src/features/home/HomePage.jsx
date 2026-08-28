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
import CafeteriaCard from '../../components/cards/CafeteriaCard.jsx';
import FoodCard from '../../components/cards/FoodCard.jsx';
import ReviewItem from '../../components/reviews/ReviewItem.jsx';
import androidBadge from '../../assets/android_download-PJqqAvJc.png';
import iosBadge from '../../assets/ios_download-Dn_KtiFi.png';
import HeroFoodShowcase from '../../components/hero/HeroFoodShowcase.jsx';
import { cafeterias, popularMeals, categories, deliveryImage, reviews, reviewsImage, heroImage, heroFoods } from './homeData.js';
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
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const cafeteria = useScrollProgress();
  const meals = useScrollProgress();

  const PER_PAGE = 3;
  const totalPages = Math.ceil(reviews.length / PER_PAGE);
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewAnim, setReviewAnim] = useState('entering');
  const [searchQuery, setSearchQuery] = useState('');
  const timeoutRef = useRef(null);

  const pageReviews = reviews.slice(reviewPage * PER_PAGE, reviewPage * PER_PAGE + PER_PAGE);

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
        <img src={heroImage} alt="" className="home-hero-bg" aria-hidden="true" />
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
        <section aria-label="Our cafeterias">
          <SectionHeader title="Our cafeterias" actionLabel="View all" actionTo="/cafeterias" />
          <div className="home_cafeteria-scroll" ref={cafeteria.scrollRef} onScroll={cafeteria.onScroll}>
            {cafeterias.map((v) => (
              <CafeteriaCard
                key={v.id}
                id={v.id}
                name={v.name}
                status={v.status}
                category={v.category}
                image={v.image}
                description={v.description}
                walkTime={v.walkTime}
                prepWindow={v.prepWindow}
              />
            ))}

            <Link to="/cafeterias" className="home_cafeteria-more" aria-label="View all cafeterias">
              <IconChevronRight size={26} stroke={2.2} />
            </Link>
          </div>
          <ScrollIndicator fillRef={cafeteria.fillRef} />
        </section>

        <section aria-label="Popular meals" style={{ marginTop: 'var(--space-8)' }}>
          <SectionHeader title="Popular right now" actionLabel="View all" actionTo="/cafeterias" />
          <div className="home_meals-scroll" ref={meals.scrollRef} onScroll={meals.onScroll}>
            {popularMeals.map((m) => (
              <FoodCard
                key={m.id}
                id={m.id}
                name={m.name}
                price={m.price}
                vendor={m.vendor}
                image={m.image}
                bestSeller={m.bestSeller}
                to={`/cafeterias/${m.cafeteriaId}/menu/${m.id}`}
              />
            ))}
            <Link to="/cafeterias" className="home_cafeteria-more" aria-label="View all meals">
              <IconChevronRight size={26} stroke={2.2} />
            </Link>
          </div>
          <ScrollIndicator fillRef={meals.fillRef} />
        </section>

        <section aria-label="Shop by category" style={{ marginTop: 'var(--space-8)' }}>
          <SectionHeader title="Shop by category" />
          <div className="home_category-scroll">
            {categories.map((c) => (
              <CategoryCard key={c.id} id={c.id} name={c.name} image={c.image} />
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

