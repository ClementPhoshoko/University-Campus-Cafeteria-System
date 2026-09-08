import { useEffect, useState } from 'react';
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
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import Breadcrumb from '../../components/ui/Breadcrumb.jsx';
import { addVendorUser, adminRequest, createVendorLocation, listMenuItems, listVendorCategories, createMenuItem, updateMenuItem, deleteMenuItem, removeVendorUser, updateVendor, updateVendorApproval, updateVendorLocation, uploadAdminAsset } from '../../services/adminApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.png';
import { StaffModal, VendorLocationModal, VendorProfileModal, MenuItemModal } from './VendorForms.jsx';

function StatusPill({ status }) {
  return <span className={`admin-status admin-status--${status}`}>{status}</span>;
}

function VendorLogo({ src, alt }) {
  return (
    <div className="admin-vendor-detail__logo">
      <img src={src} alt={alt || ''} />
    </div>
  );
}

function getVendorDetails(vendor) {
  const location = vendor.locations?.[0];
  const manager = vendor.staff?.find((member) => member.role === 'manager' && member.is_active)
    || vendor.staff?.find((member) => member.is_active);
  return {
    id: vendor.id,
    name: vendor.name,
    slug: vendor.slug,
    description: vendor.description,
    logo_url: vendor.logo_url,
    status: vendor.status,
    isPending: vendor.status === 'pending',
    vendor_location_name: [location?.site_name, location?.building_name, location?.collection_point_name]
      .filter(Boolean)
      .join(' · ') || 'No location assigned',
    categories: vendor.categories || [],
    corporate_catering_enabled: vendor.corporate_catering_enabled || false,
    manager_name: manager?.full_name || '—',
    support_email: vendor.support_email || '',
    support_phone: vendor.support_phone || '',
    operating_hours: location?.hours || [],
    estimated_prep_minutes: location?.estimated_prep_minutes || 0,
    revenue_30d: null,
    average_rating: vendor.average_rating || 0,
    rating_count: vendor.rating_count || 0,
    menu_item_count: null,
    orders_today: null,
    locations: vendor.locations || [],
    staff: vendor.staff || [],
  };
}

export default function AdminVendorDetail() {
  const { vendorId } = useParams();
  const { session } = useAuth();
  const token = session?.access_token;
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [menuCategories, setMenuCategories] = useState([]);
  const [menuItemsLoading, setMenuItemsLoading] = useState(true);

  useEffect(() => {
    if (!vendorId || !token) return;
    const fetchVendor = async () => {
      try {
        const response = await adminRequest(`/admin/vendors/${vendorId}`, {
          token,
        });
        setVendor(getVendorDetails(response.vendor));
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch vendor:', err);
        setLoading(false);
      }
    };

    fetchVendor();
  }, [vendorId, token]);

  useEffect(() => {
    if (!vendorId || !token || !vendor || vendor.isPending) return;
    let cancelled = false;
    const fetchMenuData = async () => {
      try {
        const [itemsRes, catsRes] = await Promise.all([
          listMenuItems(token, vendorId, { limit: 100 }),
          listVendorCategories(token, vendorId),
        ]);
        if (!cancelled) {
          setMenuItems(itemsRes.menuItems || []);
          setMenuCategories(catsRes.categories || []);
        }
      } catch (err) {
        console.error('Failed to fetch menu data:', err);
      } finally {
        if (!cancelled) setMenuItemsLoading(false);
      }
    };
    fetchMenuData();
    return () => { cancelled = true; };
  }, [vendorId, token, vendor?.isPending]);

  const refreshMenuItems = async () => {
    if (!token || !vendorId) return;
    try {
      const itemsRes = await listMenuItems(token, vendorId, { limit: 100 });
      setMenuItems(itemsRes.menuItems || []);
    } catch (err) { console.error('Failed to refresh menu items:', err); }
  };

  const handleApproval = async (decision) => {
    if (!token || !vendorId || actionLoading) return;
    const reason = decision === 'reject' ? window.prompt('Reason for rejection:') : undefined;
    if (decision === 'reject' && !reason?.trim()) return;

    setActionLoading(true);
    try {
      const response = await updateVendorApproval(token, vendorId, {
        decision,
        ...(reason?.trim() ? { reason: reason.trim() } : {}),
      });
      const refreshed = await adminRequest(`/admin/vendors/${vendorId}`, { token });
      if (refreshed.vendor) setVendor(getVendorDetails(refreshed.vendor));
    } catch (err) {
      console.error('Failed to update vendor approval:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleProfileUpdate = async (payload) => {
    setActionLoading(true);
    try {
      const { logo_file: logoFile, ...vendorPayload } = payload;
      await updateVendor(token, vendorId, vendorPayload);
      if (logoFile) await uploadAdminAsset(token, 'vendor', vendorId, logoFile);
      const refreshed = await adminRequest(`/admin/vendors/${vendorId}`, { token });
      if (refreshed.vendor) setVendor(getVendorDetails(refreshed.vendor));
      setModal(null);
    } finally { setActionLoading(false); }
  };

  const handleLocationCreate = async (payload) => {
    setActionLoading(true);
    try {
      await createVendorLocation(token, vendorId, payload);
      const refreshed = await adminRequest(`/admin/vendors/${vendorId}`, { token });
      if (refreshed.vendor) setVendor(getVendorDetails(refreshed.vendor));
      setModal(null);
    } finally { setActionLoading(false); }
  };

  const handleLocationUpdate = async (locationId, payload) => {
    setActionLoading(true);
    try {
      await updateVendorLocation(token, locationId, payload);
      const refreshed = await adminRequest(`/admin/vendors/${vendorId}`, { token });
      if (refreshed.vendor) setVendor(getVendorDetails(refreshed.vendor));
      setModal(null);
    } finally { setActionLoading(false); }
  };

  const handleStaffAdd = async (payload) => {
    setActionLoading(true);
    try {
      await addVendorUser(token, vendorId, payload);
      const refreshed = await adminRequest(`/admin/vendors/${vendorId}`, { token });
      if (refreshed.vendor) setVendor(getVendorDetails(refreshed.vendor));
      setModal(null);
    } finally { setActionLoading(false); }
  };

  const handleStaffRemove = async (userId) => {
    if (!window.confirm('Remove this staff member from the vendor?')) return;
    setActionLoading(true);
    try {
      await removeVendorUser(token, vendorId, userId);
      setVendor((current) => ({ ...current, staff: current.staff.filter((member) => member.user_id !== userId) }));
    } finally { setActionLoading(false); }
  };

  const handleMenuItemCreate = async (payload) => {
    setActionLoading(true);
    try {
      await createMenuItem(token, vendorId, payload);
      await refreshMenuItems();
      setModal(null);
    } finally { setActionLoading(false); }
  };

  const handleMenuItemUpdate = async (itemId, payload) => {
    setActionLoading(true);
    try {
      await updateMenuItem(token, itemId, payload);
      await refreshMenuItems();
      setModal(null);
    } finally { setActionLoading(false); }
  };

  const handleMenuItemDelete = async (itemId) => {
    if (!window.confirm('Delete this menu item? This cannot be undone.')) return;
    setActionLoading(true);
    try {
      await deleteMenuItem(token, itemId);
      setMenuItems((prev) => prev.filter((item) => item.id !== itemId));
    } finally { setActionLoading(false); }
  };

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
                <button type="button" className="admin-action admin-action--ghost" onClick={() => handleApproval('reject')} disabled={actionLoading}>
                <IconBan size={14} stroke={2} /> Reject
              </button>
              <button type="button" className="admin-action admin-action--approve" onClick={() => handleApproval('approve')} disabled={actionLoading}>
                <IconCheck size={14} stroke={2} /> Approve
              </button>
            </>
          ) : (
            <>
              <button type="button" className="admin-action admin-action--ghost" onClick={() => setModal('edit')}>
                <IconEdit size={14} stroke={2} /> Edit profile
              </button>
              <button type="button" className="admin-action admin-action--ghost admin-action--destructive" onClick={() => handleApproval(vendor.status === 'approved' ? 'suspend' : 'activate')} disabled={actionLoading}>
                <IconPower size={14} stroke={2} /> {vendor.status === 'approved' ? 'Suspend' : 'Activate'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Performance Strip */}
      {!vendor.isPending && (
        <section className="admin-vendor-performance">
          <div className="admin-vendor-performance__metric">
            <span className="admin-vendor-performance__label">Average rating</span>
            <span className="admin-vendor-performance__value">
              {Number(vendor.average_rating || 0).toFixed(1)}
              <IconStarFilled size={16} stroke={0} className="admin-vendor-performance__star" />
            </span>
            <span className="admin-vendor-performance__sub">{vendor.rating_count || 0} reviews</span>
          </div>
          <div className="admin-vendor-performance__metric">
            <span className="admin-vendor-performance__label">Operating locations</span>
            <span className="admin-vendor-performance__value">
              {vendor.locations.length}
            </span>
            <span className="admin-vendor-performance__sub">Configured locations</span>
          </div>
        </section>
      )}

      {/* Pending Application Review */}
      {vendor.isPending && (
        <section className="admin-vendor-checklist">
          <div className="admin-vendor-checklist__header">
            <h3 className="admin-vendor-checklist__title">Application review</h3>
            <div className="admin-vendor-checklist__actions"><span className="admin-vendor-checklist__badge">Review required</span><button type="button" className="admin-action admin-action--ghost" onClick={() => setModal('location')}>Add location</button></div>
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
                <span>{vendor.operating_hours.length > 0 ? vendor.operating_hours.map((h) => `${h.day_of_week}: ${h.opens_at}-${h.closes_at}`).join(', ') : 'Not set'}</span>
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
                  {vendor.support_email ? <a href={`mailto:${vendor.support_email}`}>{vendor.support_email}</a> : <span>—</span>}
              </div>
              <div className="admin-vendor-info__row">
                <IconPhone size={14} stroke={1.8} />
                <span>{vendor.support_phone || '—'}</span>
              </div>
            </div>
          </section>

          <section className="admin-vendor-info admin-vendor-management-card">
            <div className="admin-vendor-top-items__header"><h3 className="admin-vendor-info__heading">Operating locations</h3><button type="button" className="admin-action admin-action--ghost" onClick={() => setModal('location')}><IconPlus size={14} /> Add location</button></div>
            {vendor.locations.length === 0 ? <p className="admin-vendor-empty-copy">No operating locations have been assigned.</p> : vendor.locations.map((location) => <div className="vendor-managed-row" key={location.id}><div><strong>{[location.site_name, location.building_name, location.collection_point_name].filter(Boolean).join(' · ')}</strong><span>{location.service_status} · {location.estimated_prep_minutes || '—'} min prep</span></div><div className="vendor-managed-row__actions"><StatusPill status={location.service_status} /><button type="button" className="admin-action admin-action--ghost" onClick={() => setModal({ type: 'location', location })}>Edit</button></div></div>)}
          </section>

          <section className="admin-vendor-info admin-vendor-management-card">
            <div className="admin-vendor-top-items__header"><h3 className="admin-vendor-info__heading">Vendor staff</h3><button type="button" className="admin-action admin-action--ghost" onClick={() => setModal('staff')}><IconPlus size={14} /> Add staff</button></div>
            {vendor.staff.length === 0 ? <p className="admin-vendor-empty-copy">No staff members assigned.</p> : vendor.staff.map((member) => <div className="vendor-managed-row" key={member.user_id}><div><strong>{member.full_name || member.email || member.user_id}</strong><span>{member.role} · {member.is_active ? 'Active' : 'Inactive'}</span></div><button type="button" className="admin-action admin-action--ghost-danger" onClick={() => handleStaffRemove(member.user_id)} disabled={actionLoading}>Remove</button></div>)}
          </section>

          <section className="admin-vendor-info admin-vendor-management-card">
            <div className="admin-vendor-top-items__header"><h3 className="admin-vendor-info__heading">Menu items</h3><button type="button" className="admin-action admin-action--ghost" onClick={() => setModal('menuItem')}><IconPlus size={14} /> Add item</button></div>
            {menuItemsLoading ? <p className="admin-vendor-empty-copy">Loading menu items...</p> : menuItems.length === 0 ? <p className="admin-vendor-empty-copy">No menu items have been added.</p> : (
              <div className="admin-menu-items-table">
                <div className="admin-menu-items-table__head"><span>Name</span><span>Category</span><span>Price</span><span>Status</span><span /></div>
                {menuItems.map((item) => (
                  <div className="admin-menu-items-table__row" key={item.id}>
                    <div className="admin-menu-items-table__name"><strong>{item.name}</strong>{item.description && <span>{item.description.slice(0, 60)}{item.description.length > 60 ? '...' : ''}</span>}</div>
                    <span>{item.menu_categories?.name || '—'}</span>
                    <span>R {Number(item.base_price).toFixed(2)}</span>
                    <span className={`admin-status admin-status--${item.status === 'available' ? 'approved' : item.status === 'sold_out' ? 'rejected' : 'pending'}`}>{item.status}</span>
                    <div className="vendor-managed-row__actions">
                      <button type="button" className="admin-action admin-action--ghost" onClick={() => setModal({ type: 'menuItem', item })}>Edit</button>
                      <button type="button" className="admin-action admin-action--ghost-danger" onClick={() => handleMenuItemDelete(item.id)} disabled={actionLoading}><IconTrash size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
      {modal === 'edit' && <VendorProfileModal vendor={vendor} onClose={() => setModal(null)} onSubmit={handleProfileUpdate} submitting={actionLoading} />}
      {modal === 'location' && <VendorLocationModal onClose={() => setModal(null)} onSubmit={handleLocationCreate} submitting={actionLoading} />}
      {modal?.type === 'location' && <VendorLocationModal key={modal.location.id} location={modal.location} onClose={() => setModal(null)} onSubmit={(payload) => handleLocationUpdate(modal.location.id, payload)} submitting={actionLoading} />}
      {modal === 'staff' && <StaffModal onClose={() => setModal(null)} onSubmit={handleStaffAdd} submitting={actionLoading} />}
      {modal === 'menuItem' && <MenuItemModal categories={menuCategories} onClose={() => setModal(null)} onSubmit={handleMenuItemCreate} submitting={actionLoading} />}
      {modal?.type === 'menuItem' && <MenuItemModal key={modal.item.id} item={modal.item} categories={menuCategories} onClose={() => setModal(null)} onSubmit={(payload) => handleMenuItemUpdate(modal.item.id, payload)} submitting={actionLoading} />}
    </div>
  );
}
