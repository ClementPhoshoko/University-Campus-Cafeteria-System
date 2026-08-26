import { useRef, useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  IconSearch,
  IconMapPin,
  IconClock,
  IconWalk,
  IconToolsKitchen2,
  IconCoffee,
  IconPlugX,
  IconChevronRight,
  IconChevronDown,
  IconChevronLeft,
  IconPlus,
  IconArrowRight,
  IconStar,
  IconStarFilled,
} from '@tabler/icons-react';
import { useAuth } from '../../hooks/useAuth.js';
import PageContainer from '../../components/layout/PageContainer.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import SectionHeader from '../../components/layout/SectionHeader.jsx';
import HomeBackground from '../../components/HomeBackground.jsx';
import { cafeterias, popularMeals, categories, deliveryImage, reviews, reviewsImage } from './homeData.js';
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

const STATUS_LABELS = {
  open: 'Open',
  busy: 'Busy',
  closed: 'Closed',
};

const CATEGORY_ICONS = {
  dining: IconToolsKitchen2,
  seafood: IconToolsKitchen2,
  cafe: IconCoffee,
};

export default function HomePage() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const cafeteria = useScrollProgress();
  const meals = useScrollProgress();

  const PER_PAGE = 3;
  const totalPages = Math.ceil(reviews.length / PER_PAGE);
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewAnim, setReviewAnim] = useState('entering');
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
    <PageContainer>
      <HomeBackground />
      <PageHeader
        eyebrow={greeting()}
        title={`${firstName} 👋`}
        subtitle="What are you eating today?"
        actions={
          <button type="button" className="home_location-pill" aria-label="Change campus">
            <IconMapPin size={16} stroke={1.8} />
            Main Campus
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
        />
      </div>

      <section aria-label="Campus cafeterias">
        <SectionHeader title="Campus cafeterias" actionLabel="View all" actionTo="/cafeterias" />
        <div className="home_cafeteria-scroll" ref={cafeteria.scrollRef} onScroll={cafeteria.onScroll}>
          {cafeterias.map((v) => {
            const CategoryIcon = CATEGORY_ICONS[v.category] || IconToolsKitchen2;
            return (
              <Link
                to="/cafeterias"
                key={v.id}
                className={`home_vendor-card${v.status === 'closed' ? ' home_closed' : ''}`}
              >
                <div className="home_vendor-media">
                  <img src={v.image} alt={v.name} loading="lazy" />
                  <span className={`home_vendor-status-pill ${v.status}`}>{STATUS_LABELS[v.status]}</span>
                  {v.status === 'closed' && (
                    <span className="home_vendor-closed-badge" aria-hidden="true">
                      <IconPlugX size={24} stroke={1.8} />
                    </span>
                  )}
                </div>

                <span className="home_vendor-category-badge" aria-hidden="true">
                  <CategoryIcon size={24} stroke={1.8} />
                </span>

                <div className="home_vendor-body">
                  <h3>{v.name}</h3>
                  <p className="home_vendor-desc">{v.description}</p>
                  <div className="home_vendor-divider" />
                  <div className="home_vendor-meta">
                    <span>
                      <IconWalk size={15} stroke={1.8} />
                      {v.walkTime}
                    </span>
                    <i className="home_meta-dot" />
                    <span>
                      <IconClock size={15} stroke={1.8} />
                      {v.prepWindow}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}

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
            <div key={m.id} className="home_vendor-card home_meal-card">
              {m.bestSeller && <span className="home_best-seller">Best Seller</span>}
              <div className="home_vendor-media">
                <img src={m.image} alt={m.name} loading="lazy" />
              </div>

              <div className="home_vendor-body">
                <h3>{m.name}</h3>
                <p className="home_vendor-subtitle">{m.vendor}</p>
                <div className="home_vendor-divider" />
                <div className="home_meal-footer">
                  <span className="home_meal-price">{m.price}</span>
                  <button type="button" className="home_add-btn" aria-label={`Add ${m.name} to cart`}>
                    <IconPlus size={18} stroke={2.2} />
                  </button>
                </div>
              </div>
            </div>
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
            <div key={c.id} className="home_category-card">
              <img src={c.image} alt={c.name} loading="lazy" />
              <div className="home_category-fade" />
              <span className="home_category-name">{c.name}</span>
            </div>
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
            Order ahead from your favourite campus spots and pick up when it suits you.
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
          <h2 className="home_reviews-title">What students are saying</h2>
          <p className="home_reviews-subtitle">Real reviews from the campus community</p>
          <div className="home_reviews-list" key={reviewPage}>
            {pageReviews.map((r) => (
              <div key={r.id} className="home_review-item" data-state={reviewAnim}>
                <div className="home_review-body">
                  <div className="home_review-head">
                    <span className="home_review-name">{r.name}</span>
                    <span className="home_review-stars">
                      {Array.from({ length: 5 }, (_, i) =>
                        i < r.stars
                          ? <IconStarFilled key={i} size={13} stroke={0} />
                          : <IconStar key={i} size={13} stroke={1.5} />
                      )}
                    </span>
                  </div>
                  <span className="home_review-role">{r.role}</span>
                  <p className="home_review-text">{r.text}</p>
                </div>
              </div>
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
    </PageContainer>
  );
}

