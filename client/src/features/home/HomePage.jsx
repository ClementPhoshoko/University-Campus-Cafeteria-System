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
  IconPlus,
} from '@tabler/icons-react';
import { useAuth } from '../../hooks/useAuth.js';
import PageContainer from '../../components/layout/PageContainer.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import SectionHeader from '../../components/layout/SectionHeader.jsx';
import { cafeterias, popularMeals } from './homeData.js';
import './home.css';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
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

  return (
    <PageContainer>
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
        <div className="home_cafeteria-scroll">
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
      </section>

      <section aria-label="Popular meals" style={{ marginTop: 'var(--space-8)' }}>
        <SectionHeader title="Popular right now" actionLabel="View all" actionTo="/cafeterias" />
        <div className="home_meals-scroll">
          {popularMeals.map((m) => (
            <div key={m.id} className="home_vendor-card home_meal-card">
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
        </div>
      </section>

      <div className="status-bar" style={{ marginTop: 'var(--space-12)' }}>
        <span className="status-dot" />
        Live menus · updated just now
      </div>
    </PageContainer>
  );
}

