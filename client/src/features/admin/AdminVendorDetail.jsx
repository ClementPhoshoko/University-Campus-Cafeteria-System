import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  IconChevronLeft,
  IconBuildingStore,
  IconMapPin,
  IconClock,
  IconMail,
  IconPhone,
  IconUser,
  IconStarFilled,
  IconCheck,
  IconBan,
  IconEdit,
  IconPower,
  IconTrendingUp,
  IconTrendingDown,
  IconReceipt,
  IconList,
  IconEye,
} from '@tabler/icons-react';
import Breadcrumb from '../../components/ui/Breadcrumb.jsx';
import { adminRequest } from '../../services/adminApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { formatCurrency } from './adminMockData.js';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.png';

function StatusPill({ status }) {
  return <span className={`admin-status admin-status--${status}`}>{status}</span>;
}

function formatCurrencyLocal(amount) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
}

function VendorLogo({ src, alt }) {
  return (
    <div className="admin-vendor-detail__logo">
      <img src={src} alt={alt || ''} />
    </div>
  );
}

function getVendorDetails(vendor) {
  return {
    id: vendor.id,
    name: vendor.name,
    slug: vendor.slug,
    description: vendor.description,
    logo_url: vendor.logo_url,
    status: vendor.status,
    isPending: vendor.isPending,
    vendor_location_name: vendor.vendor_location_name,
    categories: vendor.categories || [],
    corporate_catering_enabled: vendor.corporate_catering_enabled || false,
    manager_name: vendor.manager_name || '—',
    support_email: vendor.support_email || '—',
    support_phone: vendor.support_phone || '—',
    operating_hours: vendor.operating_hours || [],
    revenue_30d: vendor.revenue_30d || 0,
    average_rating: vendor.average_rating || 0,
    rating_count: vendor.rating_count || 0,
    menu_item_count: vendor.menu_item_count || 0,
  };
}

export default function AdminVendorDetail() {
  const { vendorId } = useParams();
  const { user } = useAuth();
  const token = user?.session?.access_token;
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vendorId || !token) return;
    const fetchVendor = async () => {
      try {
        const response = await adminRequest(`/api/v1/admin/vendors/${vendorId}`, {
          token,
        });
        setVendor(getVendorDetails(response.data));
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch vendor:', err);
        setLoading(false);
      }
    };

    fetchVendor();
  }, [vendorId, token]);

  if (loading) {
    return (
      <div className="admin-vendor-detail__loading">
        <div className="admin-vendor-detail__loading-spinner" />
        <p>Loading vendor details...</p>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="admin-empty">
        <img src={emptyStateAvatar} alt="" className="admin-empty__avatar" />
        <h3>Vendor not found</h3>
        <p>The vendor you are looking for may have been removed.</p>
        <Link to="/admin/vendors" className="admin-action--ghost">
          <IconChevronLeft size={13} stroke={2} />
          Back to all vendors
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-vendor-detail">
      <Breadcrumb
        homeLabel="Dashboard"
        homeTo="/admin"
        items={[
          { label: 'Vendors', to: '/admin/vendors' },
          { label: vendor.name }
        ]}
      />

      {/* Vendor Header */}
      <header className="admin-vendor-header">
        <div className="admin-vendor-header__logo">
          <img src={vendor.logo_url} alt={vendor.name} />
        </div>
        <div className="admin-vendor-header__content">
          <div className="admin-vendor-header__top">
            <span className="admin-vendor-header__slug">/{vendor.slug}</span>
            <span className={`admin-status admin-status--${vendor.isPending ? 'pending' : vendor.status}`}>
              {vendor.isPending ? 'Pending approval' : vendor.status}
            </span>
          </div>
          <h1 className="admin-vendor-header__name">{vendor.name}</h1>
          <p className="admin-vendor-header__desc">{vendor.description}</p>
          <div className="admin-vendor-header__tags">
            {vendor.categories.map((cat) => (
              <span key={cat} className="admin-tag">{cat}</span>
            ))}
            {vendor.corporate_catering_enabled && (
              <span className="admin-tag admin-tag--success">Corporate catering</span>
            )}
          </div>
        </div>
        <div className="admin-vendor-header__actions">
          {vendor.isPending ? (
            <>
              <button type="button" className="admin-action admin-action--ghost">
                <IconBan size={14} stroke={2} /> Reject
              </button>
              <button type="button" className="admin-action admin-action--approve">
                <IconCheck size={14} stroke={2} /> Approve
              </button>
            </>
          ) : (
            <>
              <button type="button" className="admin-action admin-action--ghost">
                <IconEdit size={14} stroke={2} /> Edit profile
              </button>
              <button type="button" className="admin-action admin-action--ghost admin-action--destructive">
                <IconPower size={14} stroke={2} /> Deactivate
              </button>
            </>
          )}
        </div>
      </header>

      {/* Performance Strip */}
      {!vendor.isPending && (
        <section className="admin-vendor-performance">
          <div className="admin-vendor-performance__metric">
            <span className="admin-vendor-performance__label">Orders today</span>
            <span className="admin-vendor-performance__value">
              {vendor.orders_today || 0}
            </span>
            <span className="admin-vendor-performance__sub">
              <IconTrendingUp size={12} stroke={2} /> +14 today
            </span>
          </div>
          <div className="admin-vendor-performance__metric">
            <span className="admin-vendor-performance__label">30-day revenue</span>
            <span className="admin-vendor-performance__value">
              {formatCurrencyLocal(vendor.revenue_30d || 0)}
            </span>
            <span className="admin-vendor-performance__sub">+8.2% vs prev</span>
          </div>
          <div className="admin-vendor-performance__metric">
            <span className="admin-vendor-performance__label">Average rating</span>
            <span className="admin-vendor-performance__value">
              {vendor.average_rating.toFixed(1)}
              <IconStarFilled size={16} stroke={0} className="admin-vendor-performance__star" />
            </span>
            <span className="admin-vendor-performance__sub">{vendor.rating_count || 0} reviews</span>
          </div>
          <div className="admin-vendor-performance__metric">
            <span className="admin-vendor-performance__label">Menu items</span>
            <span className="admin-vendor-performance__value">
              {vendor.menu_item_count || 0}
            </span>
            <span className="admin-vendor-performance__sub">3 sold out today</span>
          </div>
        </section>
      )}

      {/* Pending Application Review */}
      {vendor.isPending && (
        <section className="admin-vendor-checklist">
          <div className="admin-vendor-checklist__header">
            <h3 className="admin-vendor-checklist__title">Application review</h3>
            <span className="admin-vendor-checklist__badge">Review required</span>
          </div>
          <ul className="admin-vendor-checklist__list">
            <li className="admin-vendor-checklist__item admin-vendor-checklist__item--done">
              <IconCheck size={14} stroke={2} /> Business registration verified
            </li>
            <li className="admin-vendor-checklist__item admin-vendor-checklist__item--done">
              <IconCheck size={14} stroke={2} /> Health certificate on file
            </li>
            <li className="admin-vendor-checklist__item admin-vendor-checklist__item--done">
              <IconCheck size={14} stroke={2} /> Insurance details confirmed
            </li>
            <li className="admin-vendor-checklist__item admin-vendor-checklist__item--done">
              <IconCheck size={14} stroke={2} /> Menu reviewed for allergen labelling
            </li>
            <li className="admin-vendor-checklist__item admin-vendor-checklist__item--pending">
              <IconClock size={14} stroke={2} /> Payment provider pending
            </li>
            <li className="admin-vendor-checklist__item admin-vendor-checklist__item--pending">
              <IconClock size={14} stroke={2} /> Final operational sign-off
            </li>
          </ul>
        </section>
      )}

      {/* Main Content */}
      {!vendor.isPending && (
        <div className="admin-vendor-content">
          {/* Left Column - Vendor Information */}
          <section className="admin-vendor-info">
            <h3 className="admin-vendor-info__heading">Vendor information</h3>

            <div className="admin-vendor-info__section">
              <h4 className="admin-vendor-info__section-title">Location</h4>
              <div className="admin-vendor-info__row">
                <IconMapPin size={14} stroke={1.8} />
                <span>{vendor.vendor_location_name}</span>
              </div>
            </div>

            <div className="admin-vendor-info__section">
              <h4 className="admin-vendor-info__section-title">Operating hours</h4>
              <div className="admin-vendor-info__row">
                <IconClock size={14} stroke={1.8} />
                <span>{vendor.operating_hours ? vendor.operating_hours.map((h) => `${h.day_of_week}: ${h.opens_at}-${h.closes_at}`).join(', ') : 'Not set'}</span>
              </div>
              <div className="admin-vendor-info__row admin-vendor-info__row--muted">
                <span>Est. prep time</span>
                <span>{vendor.estimated_prep_minutes || 0} minutes</span>
              </div>
            </div>

            <div className="admin-vendor-info__section">
              <h4 className="admin-vendor-info__section-title">Contact</h4>
              <div className="admin-vendor-info__row">
                <IconUser size={14} stroke={1.8} />
                <span>{vendor.manager_name || '—'}</span>
              </div>
              <div className="admin-vendor-info__row">
                <IconMail size={14} stroke={1.8} />
                <a href={`mailto:${vendor.support_email}`}>{vendor.support_email}</a>
              </div>
              <div className="admin-vendor-info__row">
                <IconPhone size={14} stroke={1.8} />
                <span>{vendor.support_phone || '—'}</span>
              </div>
            </div>
          </section>

          {/* Right Column - Top Selling Items */}
          <section className="admin-vendor-top-items">
            <div className="admin-vendor-top-items__header">
              <h3 className="admin-vendor-top-items__heading">Top selling items</h3>
              <button type="button" className="admin-vendor-top-items__link">
                View all <IconChevronLeft size={12} stroke={2} style={{ transform: 'rotate(180deg)' }} />
              </button>
            </div>
            <ul className="admin-vendor-top-items__list">
              {/* Top items would come from API - showing placeholder for now */}
              <li className="admin-vendor-top-items__item" style={{ display: 'none' }}>
                <span className="admin-vendor-top-items__rank">1</span>
                <div className="admin-vendor-top-items__image" />
                <div className="admin-vendor-top-items__body">
                  <span className="admin-vendor-top-items__name">No data</span>
                  <span className="admin-vendor-top-items__meta">0 orders</span>
                </div>
                <span className="admin-vendor-top-items__revenue">—</span>
              </li>
            </ul>
          </section>
        </div>
      )}

      {/* Recent Activity - Full Width */}
      {!vendor.isPending && (
        <section className="admin-vendor-activity">
          <div className="admin-vendor-activity__header">
            <h3 className="admin-vendor-activity__heading">Recent activity</h3>
            <button type="button" className="admin-vendor-activity__link">
              View all <IconChevronLeft size={12} stroke={2} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>
          <ul className="admin-vendor-activity__list">
            {/* Recent activity would come from API - showing placeholder */}
            <li className="admin-vendor-activity__item" style={{ display: 'none' }}>
              <span className="admin-vendor-activity__icon admin-vendor-activity__icon--check" />
              <span className="admin-vendor-activity__message">No recent activity</span>
              <span className="admin-vendor-activity__time">—</span>
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}