import { useMemo } from 'react';
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
import { ACTIVE_VENDORS, PENDING_VENDOR_APPROVALS, formatCurrency } from './adminMockData.js';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.png';

const TOP_ITEMS = [
  { name: 'Chicken Wrap & Salad', orders: 142, revenue: 6390, image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=80' },
  { name: 'House Cappuccino', orders: 124, revenue: 3720, image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=80' },
  { name: 'Grilled Chicken & Rice', orders: 96, revenue: 4704, image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=80' },
  { name: 'Vegetable Pasta', orders: 88, revenue: 3520, image: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=80' },
  { name: 'Berry Scone', orders: 76, revenue: 2128, image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=80' },
];

const RECENT_ACTIVITY = [
  { type: 'order', icon: 'check', message: 'Order #48211 completed', meta: 'R142.50', time: '2 hours ago' },
  { type: 'order', icon: 'check', message: 'Order #48208 ready for collection', meta: 'R86.00', time: '2 hours ago' },
  { type: 'order', icon: 'arrow', message: 'Order volume increased', meta: '+18% today', time: 'Yesterday' },
  { type: 'menu', icon: 'edit', message: 'Menu updated - Chicken Wrap price changed', meta: '', time: '3 days ago' },
  { type: 'status', icon: 'check', message: 'Vendor approved', meta: 'by Admin', time: '4 days ago' },
];

export default function AdminVendorDetail() {
  const { vendorId } = useParams();
  const vendor = useMemo(() => {
    const active = ACTIVE_VENDORS.find((v) => v.id === vendorId);
    if (active) return { ...active, isPending: false };
    const pending = PENDING_VENDOR_APPROVALS.find((v) => v.id === vendorId);
    if (pending) return { ...pending, status: 'pending', isPending: true };
    return null;
  }, [vendorId]);

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
            <span className="admin-vendor-performance__value">{vendor.orders_today}</span>
            <span className="admin-vendor-performance__sub">
              <IconTrendingUp size={12} stroke={2} /> +14 today
            </span>
          </div>
          <div className="admin-vendor-performance__metric">
            <span className="admin-vendor-performance__label">30-day revenue</span>
            <span className="admin-vendor-performance__value">{formatCurrency(vendor.revenue_30d)}</span>
            <span className="admin-vendor-performance__sub">+8.2% vs prev</span>
          </div>
          <div className="admin-vendor-performance__metric">
            <span className="admin-vendor-performance__label">Average rating</span>
            <span className="admin-vendor-performance__value">
              {vendor.average_rating.toFixed(1)}
              <IconStarFilled size={16} stroke={0} className="admin-vendor-performance__star" />
            </span>
            <span className="admin-vendor-performance__sub">{vendor.rating_count} reviews</span>
          </div>
          <div className="admin-vendor-performance__metric">
            <span className="admin-vendor-performance__label">Menu items</span>
            <span className="admin-vendor-performance__value">{vendor.menu_item_count}</span>
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
                <span>{vendor.operating_hours}</span>
              </div>
              <div className="admin-vendor-info__row admin-vendor-info__row--muted">
                <span>Est. prep time</span>
                <span>{vendor.estimated_prep_minutes}</span>
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
              {TOP_ITEMS.map((item, index) => (
                <li key={item.name} className="admin-vendor-top-items__item">
                  <span className="admin-vendor-top-items__rank">{index + 1}</span>
                  <div className="admin-vendor-top-items__image">
                    <img src={item.image} alt={item.name} />
                  </div>
                  <div className="admin-vendor-top-items__body">
                    <span className="admin-vendor-top-items__name">{item.name}</span>
                    <span className="admin-vendor-top-items__meta">{item.orders} orders</span>
                  </div>
                  <span className="admin-vendor-top-items__revenue">{formatCurrency(item.revenue)}</span>
                </li>
              ))}
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
            {RECENT_ACTIVITY.map((item, index) => (
              <li key={index} className="admin-vendor-activity__item">
                <span className={`admin-vendor-activity__icon admin-vendor-activity__icon--${item.icon}`}>
                  {item.icon === 'check' && <IconCheck size={12} stroke={2.5} />}
                  {item.icon === 'arrow' && <IconTrendingUp size={12} stroke={2} />}
                  {item.icon === 'edit' && <IconEdit size={12} stroke={2} />}
                </span>
                <div className="admin-vendor-activity__content">
                  <span className="admin-vendor-activity__message">{item.message}</span>
                  {item.meta && <span className="admin-vendor-activity__meta">{item.meta}</span>}
                </div>
                <span className="admin-vendor-activity__time">{item.time}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
