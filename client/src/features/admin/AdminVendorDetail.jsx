import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  IconBuildingStore,
  IconChevronLeft,
  IconMapPin,
  IconClock,
  IconMail,
  IconPhone,
  IconUser,
  IconReceipt,
  IconStarFilled,
  IconShieldCheck,
  IconFileText,
  IconBriefcase,
  IconList,
  IconChartLine,
  IconAlertTriangle,
  IconCheck,
  IconBan,
  IconEdit,
  IconPower,
} from '@tabler/icons-react';
import { ACTIVE_VENDORS, PENDING_VENDOR_APPROVALS, formatCurrency } from './adminMockData.js';

const RECENT_ORDERS = [
  { id: '#48211', when: 'Today · 12:48', total: 142.5, status: 'Completed', items: 3 },
  { id: '#48208', when: 'Today · 12:32', total: 86.0, status: 'Ready', items: 2 },
  { id: '#48201', when: 'Today · 12:18', total: 215.0, status: 'Preparing', items: 6 },
  { id: '#48195', when: 'Today · 12:04', total: 64.5, status: 'Completed', items: 2 },
  { id: '#48190', when: 'Today · 11:48', total: 132.0, status: 'Completed', items: 4 },
];

const TOP_ITEMS = [
  { name: 'Chicken Wrap & Salad', orders: 142, revenue: 6390 },
  { name: 'House Cappuccino', orders: 124, revenue: 3720 },
  { name: 'Grilled Chicken & Rice', orders: 96, revenue: 4704 },
  { name: 'Vegetable Pasta', orders: 88, revenue: 3520 },
  { name: 'Berry Scone', orders: 76, revenue: 2128 },
];

function StatBlock({ icon: Icon, label, value, sub }) {
  return (
    <div className="admin-vendor-stat">
      <span className="admin-vendor-stat__icon">
        <Icon size={16} stroke={1.8} />
      </span>
      <div className="admin-vendor-stat__body">
        <span className="admin-vendor-stat__label">{label}</span>
        <span className="admin-vendor-stat__value">{value}</span>
        {sub && <span className="admin-vendor-stat__sub">{sub}</span>}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, mono }) {
  return (
    <div className="admin-vendor-info-row">
      <span className="admin-vendor-info-row__icon">
        <Icon size={14} stroke={1.8} />
      </span>
      <div className="admin-vendor-info-row__text">
        <span className="admin-vendor-info-row__label">{label}</span>
        <span className={`admin-vendor-info-row__value${mono ? ' admin-vendor-info-row__value--mono' : ''}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

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
        <IconBuildingStore size={32} stroke={1.4} />
        <h3>Vendor not found</h3>
        <p>The vendor you are looking for may have been removed.</p>
        <Link to="/admin/vendors" className="admin-action admin-action--approve">
          <IconChevronLeft size={13} stroke={2} />
          Back to all vendors
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-vendor-detail">
      <Link to="/admin/vendors" className="admin-back-link">
        <IconChevronLeft size={14} stroke={2} />
        Back to vendors
      </Link>

      {/* Hero / identity */}
      <section className={`admin-vendor-hero${vendor.isPending ? ' admin-vendor-hero--pending' : ''}`}>
        <div className="admin-vendor-hero__logo">
          <img src={vendor.logo_url} alt={vendor.name} />
        </div>
        <div className="admin-vendor-hero__info">
          <div className="admin-vendor-hero__head">
            <span className="admin-vendor-hero__slug">/{vendor.slug}</span>
            {vendor.isPending ? (
              <span className="admin-status admin-status--pending">
                <IconAlertTriangle size={12} stroke={2} /> Pending approval
              </span>
            ) : (
              <span className={`admin-status admin-status--${vendor.status}`}>{vendor.status}</span>
            )}
          </div>
          <h2 className="admin-vendor-hero__name">{vendor.name}</h2>
          <p className="admin-vendor-hero__desc">{vendor.description}</p>

          <div className="admin-vendor-hero__tags">
            {vendor.categories.map((cat) => (
              <span key={cat} className="admin-tag admin-tag--blue">{cat}</span>
            ))}
            {vendor.cateringEnabled && (
              <span className="admin-tag admin-tag--success">Corporate catering</span>
            )}
          </div>
        </div>
        <div className="admin-vendor-hero__actions">
          {vendor.isPending ? (
            <>
              <button type="button" className="admin-action admin-action--reject">
                <IconBan size={14} stroke={2} /> Reject
              </button>
              <button type="button" className="admin-action admin-action--approve">
                <IconCheck size={14} stroke={2} /> Approve vendor
              </button>
            </>
          ) : (
            <>
              <button type="button" className="admin-action">
                <IconEdit size={14} stroke={2} /> Edit profile
              </button>
              <button type="button" className="admin-action admin-action--reject">
                <IconPower size={14} stroke={2} /> Deactivate
              </button>
            </>
          )}
        </div>
      </section>

      {/* KPI strip */}
      {!vendor.isPending && (
        <section className="admin-vendor-stats">
          <StatBlock
            icon={IconReceipt}
            label="Orders today"
            value={vendor.ordersToday}
            sub="vs 184 yesterday"
          />
          <StatBlock
            icon={IconChartLine}
            label="30-day revenue"
            value={formatCurrency(vendor.revenue30d)}
            sub="+8.2% vs prev period"
          />
          <StatBlock
            icon={IconStarFilled}
            label="Average rating"
            value={vendor.rating.toFixed(1)}
            sub={`${vendor.ratingCount} reviews`}
          />
          <StatBlock
            icon={IconList}
            label="Menu items"
            value={vendor.menuItems}
            sub="3 sold out today"
          />
        </section>
      )}

      <div className="admin-vendor-grid">
        {/* Left column — info */}
        <section className="admin-card">
          <header className="admin-card__head">
            <div>
              <span className="admin-card__eyebrow">Location & contact</span>
              <h3 className="admin-card__title">Vendor profile</h3>
            </div>
            {vendor.isPending && (
              <span className="admin-card__chip admin-card__chip--warning">
                Awaiting review
              </span>
            )}
          </header>

          <div className="admin-vendor-section">
            <h4 className="admin-vendor-section__heading">Campus & building</h4>
            <InfoRow icon={IconMapPin} label="Campus" value={vendor.campus} />
            <InfoRow icon={IconMapPin} label="Building / location" value={vendor.building} />
            <InfoRow icon={IconClock} label="Operating hours" value={vendor.operatingHours} />
            <InfoRow icon={IconClock} label="Estimated prep" value={vendor.estimatedPrep} />
          </div>

          <div className="admin-vendor-section">
            <h4 className="admin-vendor-section__heading">Contact & management</h4>
            <InfoRow icon={IconUser} label="Onsite manager" value={vendor.manager || vendor.contactName || '—'} />
            <InfoRow icon={IconMail} label="Support email" value={vendor.contactEmail || vendor.support_email} />
            <InfoRow icon={IconPhone} label="Support phone" value={vendor.contactPhone || '—'} />
            {vendor.contactName && (
              <InfoRow icon={IconBriefcase} label="Applicant" value={vendor.contactName} />
            )}
          </div>

          <div className="admin-vendor-section">
            <h4 className="admin-vendor-section__heading">Documents on file</h4>
            <ul className="admin-vendor-docs">
              {(vendor.documents || ['business-registration.pdf', 'health-certificate.pdf', 'menu.pdf']).map((doc) => (
                <li key={doc}>
                  <IconFileText size={14} stroke={1.8} />
                  <span>{doc}</span>
                  <button type="button" className="admin-link-cta">View</button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Right column — performance */}
        {!vendor.isPending && (
          <div className="admin-vendor-grid__right">
            <section className="admin-card">
              <header className="admin-card__head">
                <div>
                  <span className="admin-card__eyebrow">Top sellers</span>
                  <h3 className="admin-card__title">Best performing items</h3>
                </div>
              </header>
              <ul className="admin-vendor-items">
                {TOP_ITEMS.map((item, index) => (
                  <li key={item.name} className="admin-vendor-item">
                    <span className="admin-vendor-item__rank">#{index + 1}</span>
                    <div className="admin-vendor-item__body">
                      <span className="admin-vendor-item__name">{item.name}</span>
                      <span className="admin-vendor-item__meta">
                        {item.orders} orders · {formatCurrency(item.revenue)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="admin-card">
              <header className="admin-card__head">
                <div>
                  <span className="admin-card__eyebrow">Live orders</span>
                  <h3 className="admin-card__title">Recent activity</h3>
                </div>
                <Link to="/admin/orders" className="admin-card__link">
                  View all <IconChevronLeft size={13} stroke={2} style={{ transform: 'rotate(180deg)' }} />
                </Link>
              </header>
              <ul className="admin-vendor-orders">
                {RECENT_ORDERS.map((order) => (
                  <li key={order.id} className="admin-vendor-order">
                    <div className="admin-vendor-order__head">
                      <span className="admin-vendor-order__id">{order.id}</span>
                      <span className="admin-vendor-order__total">{formatCurrency(order.total)}</span>
                    </div>
                    <div className="admin-vendor-order__meta">
                      <span>{order.when}</span>
                      <span>·</span>
                      <span>{order.items} items</span>
                      <span>·</span>
                      <span className={`admin-vendor-order__status admin-vendor-order__status--${order.status.toLowerCase()}`}>
                        {order.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {/* For pending vendors, show the application review panel */}
        {vendor.isPending && (
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Onboarding</span>
                <h3 className="admin-card__title">Application review checklist</h3>
              </div>
              <span className="admin-card__chip admin-card__chip--warning">
                <IconShieldCheck size={13} stroke={2} /> Review required
              </span>
            </header>
            <ul className="admin-vendor-checklist">
              <li className="admin-vendor-checklist__item admin-vendor-checklist__item--done">
                <IconCheck size={14} stroke={2} />
                Business registration verified
              </li>
              <li className="admin-vendor-checklist__item admin-vendor-checklist__item--done">
                <IconCheck size={14} stroke={2} />
                Health certificate on file
              </li>
              <li className="admin-vendor-checklist__item admin-vendor-checklist__item--done">
                <IconCheck size={14} stroke={2} />
                Insurance details confirmed
              </li>
              <li className="admin-vendor-checklist__item admin-vendor-checklist__item--done">
                <IconCheck size={14} stroke={2} />
                Menu reviewed for allergen labelling
              </li>
              <li className="admin-vendor-checklist__item">
                <IconAlertTriangle size={14} stroke={2} />
                Payment provider pending
              </li>
              <li className="admin-vendor-checklist__item">
                <IconAlertTriangle size={14} stroke={2} />
                Final operational sign-off
              </li>
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
