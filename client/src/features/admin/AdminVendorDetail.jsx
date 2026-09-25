import { useEffect, useRef, useState } from 'react';
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
  IconHeartbeat,
  IconShieldCheck,
  IconMenu2,
  IconCreditCard,
  IconClipboardCheck,
  IconX,
} from '@tabler/icons-react';
import Breadcrumb from '../../components/ui/Breadcrumb.jsx';
import { addVendorUser, adminRequest, createVendorLocation, listMenuItems, listVendorCategories, createMenuItem, updateMenuItem, deleteMenuItem, createVendorCategory, updateVendorCategory, deleteVendorCategory, removeVendorUser, updateVendor, updateVendorApproval, updateVendorLocation, uploadAdminAsset } from '../../services/adminApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.png';
import { StaffModal, VendorLocationModal, VendorProfileModal, MenuItemModal, CategoryModal } from './VendorForms.jsx';
import SmartImage from '../../components/ui/SmartImage.jsx';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ITEM_NAME_MAX = 21;

function truncate(text, max) {
  if (!text) return text;
  const value = String(text);
  return value.length > max ? `${value.slice(0, max - 1)}\u2026` : value;
}

function getRatingGrade(rating, count) {
  if (count <= 0) return { label: 'No reviews yet', tone: 'none' };
  if (rating >= 4.5) return { label: 'Excellent', tone: 'great' };
  if (rating >= 4.0) return { label: 'Very good', tone: 'great' };
  if (rating >= 3.0) return { label: 'Good', tone: 'fair' };
  if (rating >= 2.0) return { label: 'Fair', tone: 'fair' };
  return { label: 'Poor', tone: 'poor' };
}

const LOCATION_STATUS_META = {
  open: { label: 'Open', tone: 'open' },
  busy: { label: 'Busy', tone: 'busy' },
  closed: { label: 'Closed', tone: 'closed' },
  temporarily_unavailable: { label: 'Unavailable', tone: 'unavailable' },
};

function formatOperatingHours(hours) {
  if (!hours || hours.length === 0) return null;
  const byDay = {};
  hours.forEach((h) => { byDay[h.day_of_week] = h; });
  return DAY_LABELS.map((label, i) => {
    const h = byDay[i];
    const closed = !h || h.is_closed;
    return { label, time: closed ? null : `${h.opens_at}\u2009\u2013\u2009${h.closes_at}`, closed };
  });
}

function StatusPill({ status }) {
  return <span className={`admin-status admin-status--${status}`}>{status}</span>;
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
      .join(' \u00b7 ') || 'No location assigned',
    categories: vendor.categories || [],
    corporate_catering_enabled: vendor.corporate_catering_enabled || false,
    manager_name: manager?.full_name || '\u2014',
    support_email: vendor.support_email || '',
    support_phone: vendor.support_phone || '',
    operating_hours: location?.hours || [],
    estimated_prep_minutes: location?.estimated_prep_minutes || 0,
    average_rating: vendor.average_rating || 0,
    rating_count: vendor.rating_count || 0,
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
  const [creating, setCreating] = useState(false);
  const [loadMsg, setLoadMsg] = useState(0);
  const loadTimerRef = useRef(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [approvalError, setApprovalError] = useState('');

  const LOAD_MESSAGES = [
    'Processing approval decision...',
    'Updating vendor status...',
    'Syncing account settings...',
    'Almost there...',
  ];

  const PAGE_SIZE = 5;

  const [locationsVisibleCount, setLocationsVisibleCount] = useState(PAGE_SIZE);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const locationsBottomRef = useRef(null);

  const [staffVisibleCount, setStaffVisibleCount] = useState(PAGE_SIZE);
  const [staffLoading, setStaffLoading] = useState(false);
  const staffBottomRef = useRef(null);

  const [categoriesVisibleCount, setCategoriesVisibleCount] = useState(PAGE_SIZE);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const categoriesBottomRef = useRef(null);

  const [menuItemsVisibleCount, setMenuItemsVisibleCount] = useState(PAGE_SIZE);
  const [menuItemsPageLoading, setMenuItemsPageLoading] = useState(false);
  const menuItemsBottomRef = useRef(null);

  useEffect(() => {
    if (!creating) { setLoadMsg(0); return; }
    loadTimerRef.current = setInterval(() => setLoadMsg((i) => (i + 1) % LOAD_MESSAGES.length), 1800);
    return () => clearInterval(loadTimerRef.current);
  }, [creating]);

  useEffect(() => {
    if (!vendorId || !token) return;
    const fetchVendor = async () => {
      try {
        const response = await adminRequest(`/admin/vendors/${vendorId}`, { token });
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

  const refreshMenuCategories = async () => {
    if (!token || !vendorId) return;
    try {
      const catsRes = await listVendorCategories(token, vendorId);
      setMenuCategories(catsRes.categories || []);
    } catch (err) { console.error('Failed to refresh menu categories:', err); }
  };

  const loadMoreLocations = () => {
    setLocationsLoading(true);
    setTimeout(() => {
      setLocationsVisibleCount((prev) => prev + PAGE_SIZE);
      setLocationsLoading(false);
      locationsBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 400);
  };

  const loadMoreStaff = () => {
    setStaffLoading(true);
    setTimeout(() => {
      setStaffVisibleCount((prev) => prev + PAGE_SIZE);
      setStaffLoading(false);
      staffBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 400);
  };

  const loadMoreCategories = () => {
    setCategoriesLoading(true);
    setTimeout(() => {
      setCategoriesVisibleCount((prev) => prev + PAGE_SIZE);
      setCategoriesLoading(false);
      categoriesBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 400);
  };

  const loadMoreMenuItems = () => {
    setMenuItemsPageLoading(true);
    setTimeout(() => {
      setMenuItemsVisibleCount((prev) => prev + PAGE_SIZE);
      setMenuItemsPageLoading(false);
      menuItemsBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 400);
  };

  const handleApproval = async (decision, reason) => {
    if (!token || !vendorId || creating) return;
    setCreating(true);
    setRejectError('');
    setApprovalError('');
    try {
      await updateVendorApproval(token, vendorId, {
        decision,
        ...(reason?.trim() ? { reason: reason.trim() } : {}),
      });
      const refreshed = await adminRequest(`/admin/vendors/${vendorId}`, { token });
      if (refreshed.vendor) setVendor(getVendorDetails(refreshed.vendor));
      setRejectModal(false);
      setRejectReason('');
    } catch (err) {
      const msg = err?.message || 'Action failed. Please try again.';
      if (decision === 'reject') setRejectError(msg);
      else setApprovalError(msg);
    } finally { setCreating(false); }
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
      const { image_file: imageFile, ...itemPayload } = payload;
      const response = await createMenuItem(token, vendorId, itemPayload);
      if (imageFile && response?.menuItem?.id) await uploadAdminAsset(token, 'menu_item', response.menuItem.id, imageFile);
      await refreshMenuItems();
      setModal(null);
    } catch (err) {
      console.error('Failed to create menu item:', err);
    } finally { setActionLoading(false); }
  };

  const handleMenuItemUpdate = async (itemId, payload) => {
    setActionLoading(true);
    try {
      const { image_file: imageFile, ...itemPayload } = payload;
      await updateMenuItem(token, itemId, itemPayload);
      if (imageFile) await uploadAdminAsset(token, 'menu_item', itemId, imageFile);
      await refreshMenuItems();
      setModal(null);
    } catch (err) {
      console.error('Failed to update menu item:', err);
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

  const handleCategoryCreate = async (payload) => {
    setActionLoading(true);
    try {
      await createVendorCategory(token, vendorId, payload);
      await refreshMenuCategories();
      setModal(null);
    } finally { setActionLoading(false); }
  };

  const handleCategoryUpdate = async (categoryId, payload) => {
    setActionLoading(true);
    try {
      await updateVendorCategory(token, categoryId, payload);
      await refreshMenuCategories();
      setModal(null);
    } finally { setActionLoading(false); }
  };

  const handleCategoryDelete = async (categoryId) => {
    if (!window.confirm('Delete this category? Items in it will become uncategorized.')) return;
    setActionLoading(true);
    try {
      await deleteVendorCategory(token, categoryId);
      setMenuCategories((prev) => prev.filter((cat) => cat.id !== categoryId));
    } finally { setActionLoading(false); }
  };

  /* ── Loading State ── */
  if (loading) {
    return (
      <div className="vd">
        <Breadcrumb homeLabel="Dashboard" homeTo="/admin" items={[{ label: 'Vendors', to: '/admin/vendors' }, { label: 'Loading...' }]} />
        <div className="vd-hero">
          <div className="vd-hero__cover"><span className="skeleton" style={{ display: 'block', width: '100%', height: '100%', borderRadius: 0 }} /></div>
          <div className="vd-hero__info">
            <div className="vd-hero__top">
              <span className="skeleton" style={{ width: 80, height: 22, borderRadius: 'var(--radius-full)' }} />
              <span className="skeleton" style={{ width: 60, height: 14, borderRadius: 4 }} />
            </div>
            <div className="skeleton" style={{ width: '35%', height: 28, borderRadius: 'var(--radius-xs)', marginTop: 8 }} />
            <div className="skeleton" style={{ width: '55%', height: 14, borderRadius: 'var(--radius-xs)', marginTop: 8 }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <span className="skeleton" style={{ width: 70, height: 20, borderRadius: 'var(--radius-full)' }} />
              <span className="skeleton" style={{ width: 90, height: 20, borderRadius: 'var(--radius-full)' }} />
            </div>
          </div>
          <div className="vd-hero__actions">
            <span className="skeleton" style={{ width: 90, height: 34, borderRadius: 'var(--radius-xs)' }} />
            <span className="skeleton" style={{ width: 80, height: 34, borderRadius: 'var(--radius-xs)' }} />
          </div>
        </div>
        <div className="vd-metrics">
          <div className="vd-metric">
            <div className="skeleton" style={{ width: '62%', height: 12, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: '46%', height: 20, borderRadius: 4, marginTop: 10 }} />
            <div className="skeleton" style={{ width: '36%', height: 10, borderRadius: 4, marginTop: 10 }} />
          </div>
          <div className="vd-metric">
            <div className="skeleton" style={{ width: '62%', height: 12, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: '32%', height: 20, borderRadius: 4, marginTop: 10 }} />
            <div className="skeleton" style={{ width: '42%', height: 10, borderRadius: 4, marginTop: 10 }} />
          </div>
        </div>
        <div className="vd-grid">
          <div className="vd-grid__main">
            <div className="vd-panel">
              <div className="skeleton" style={{ width: 120, height: 12, borderRadius: 4, marginBottom: 16 }} />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < 5 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                  <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 'var(--radius-xs)', flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div className="skeleton" style={{ width: '40%', height: 10, borderRadius: 4 }} />
                    <div className="skeleton" style={{ width: '70%', height: 14, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="vd-grid__side">
            <div className="vd-panel">
              <div className="skeleton" style={{ width: 80, height: 12, borderRadius: 4, marginBottom: 16 }} />
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 3 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div className="skeleton" style={{ width: 100, height: 14, borderRadius: 4 }} />
                    <div className="skeleton" style={{ width: 70, height: 10, borderRadius: 4 }} />
                  </div>
                  <div className="skeleton" style={{ width: 60, height: 28, borderRadius: 'var(--radius-xs)' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Empty State ── */
  if (!vendor) {
    return (
      <div className="vd">
        <Breadcrumb homeLabel="Dashboard" homeTo="/admin" items={[{ label: 'Vendors', to: '/admin/vendors' }, { label: 'Not found' }]} />
        <div className="vd-empty">
          <img src={emptyStateAvatar} alt="" className="vd-empty__img" />
          <h3 className="vd-empty__title">Vendor not found</h3>
          <p className="vd-empty__copy">The vendor you are looking for may have been removed.</p>
          <Link to="/admin/vendors" className="admin-action admin-action--ghost">
            <IconChevronLeft size={13} stroke={2} /> Back to all vendors
          </Link>
        </div>
      </div>
    );
  }

  const statusLabel = vendor.isPending ? 'Pending approval' : vendor.status;
  const statusClass = vendor.isPending ? 'pending' : vendor.status;
  const hours = formatOperatingHours(vendor.operating_hours);

  const rating = Number(vendor.average_rating || 0);
  const ratingPct = Math.min(100, Math.max(0, (rating / 5) * 100));
  const ratingGrade = getRatingGrade(rating, vendor.rating_count);
  const locationStatuses = Object.entries(LOCATION_STATUS_META)
    .map(([key, meta]) => ({ key, ...meta, count: vendor.locations.filter((loc) => loc.service_status === key).length }))
    .filter((item) => item.count > 0);

  return (
    <div className="vd">
      <Breadcrumb
        homeLabel="Dashboard"
        homeTo="/admin"
        items={[{ label: 'Vendors', to: '/admin/vendors' }, { label: vendor.name }]}
      />

      {/* ── Hero Header ── */}
      <header className="vd-hero">
        <div className="vd-hero__cover">
          {vendor.logo_url ? (
            <SmartImage src={vendor.logo_url} alt={vendor.name} eager width={240} height={240} />
          ) : (
            <div className="vd-hero__placeholder"><IconBuildingStore size={44} stroke={1.2} /></div>
          )}
        </div>
        <div className="vd-hero__info">
          <div className="vd-hero__top">
            <StatusPill status={statusClass} />
            <span className="vd-hero__slug">/{vendor.slug}</span>
          </div>
          <h1 className="vd-hero__name">{vendor.name}</h1>
          {vendor.description && <p className="vd-hero__desc">{vendor.description}</p>}
          <div className="vd-hero__tags">
            {vendor.categories.map((cat) => (
              <span key={cat} className="admin-tag">{cat}</span>
            ))}
            {vendor.corporate_catering_enabled && (
              <span className="admin-tag admin-tag--success">Corporate catering</span>
            )}
          </div>
        </div>
        <div className="vd-hero__actions">
          {approvalError && <div className="vendor-form-error" role="alert">{approvalError}</div>}
          {vendor.isPending ? (
            <>
              <button type="button" className="admin-action admin-action--ghost" onClick={() => { setRejectModal(true); setRejectError(''); }} disabled={creating || actionLoading}>
                <IconBan size={14} stroke={2} /> Reject
              </button>
              <button type="button" className="admin-action admin-action--ghost admin-action--ghost-success" onClick={() => handleApproval('approve')} disabled={creating || actionLoading}>
                <IconCheck size={14} stroke={2} /> Approve
              </button>
            </>
          ) : (
            <>
              <button type="button" className="admin-action admin-action--ghost" onClick={() => setModal('edit')}>
                <IconEdit size={14} stroke={2} /> Edit profile
              </button>
              <button type="button" className="admin-action admin-action--ghost admin-action--destructive" onClick={() => handleApproval(vendor.status === 'approved' ? 'suspend' : 'activate')} disabled={creating || actionLoading}>
                <IconPower size={14} stroke={2} /> {vendor.status === 'approved' ? 'Suspend' : 'Activate'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Metrics ── */}
      {!vendor.isPending && (
        <div className="vd-metrics">
          <div className="vd-metric">
            <div className="vd-metric__head">
              <div className="vd-metric__icon vd-metric__icon--warning">
                <IconStarFilled size={15} stroke={0} />
              </div>
              <span className="vd-metric__label">Average rating</span>
              <span className={`vd-metric__pill vd-metric__pill--${ratingGrade.tone}`}>{ratingGrade.label}</span>
            </div>
            <div className="vd-metric__main">
              <span className="vd-metric__value">{rating.toFixed(1)}</span>
              <span className="vd-metric__value-max">/ 5</span>
              <span className="vd-metric__stars" role="img" aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
                <span className="vd-metric__stars-track">
                  {[...Array(5)].map((_, i) => <IconStarFilled key={i} size={14} stroke={0} />)}
                </span>
                <span className="vd-metric__stars-fill" style={{ width: `${ratingPct}%` }} aria-hidden="true">
                  {[...Array(5)].map((_, i) => <IconStarFilled key={i} size={14} stroke={0} />)}
                </span>
              </span>
            </div>
            <span className="vd-metric__footnote">{vendor.rating_count || 0} reviews</span>
          </div>
          <div className="vd-metric">
            <div className="vd-metric__head">
              <div className="vd-metric__icon vd-metric__icon--info">
                <IconMapPin size={15} stroke={2} />
              </div>
              <span className="vd-metric__label">Operating locations</span>
            </div>
            <div className="vd-metric__main">
              <span className="vd-metric__value">{vendor.locations.length}</span>
              <span className="vd-metric__value-max">{vendor.locations.length === 1 ? 'site' : 'sites'}</span>
              {locationStatuses.length > 0 ? (
                <span className="vd-metric__statuses">
                  {locationStatuses.map((s) => (
                    <span key={s.key} className={`vd-metric__pill vd-metric__pill--${s.tone}`}>
                      {s.count} {s.label.toLowerCase()}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="vd-metric__pill vd-metric__pill--unavailable">No locations</span>
              )}
            </div>
            <span className="vd-metric__footnote">Configured locations</span>
          </div>
        </div>
      )}

      {/* ── Pending Checklist ── */}
      {vendor.isPending && (
        <section className="vd-checklist">
          <div className="vd-checklist__header">
            <div>
              <h3 className="vd-checklist__title">Application review</h3>
              <p className="vd-checklist__sub">Verify the following before approving this vendor.</p>
            </div>
            <div className="vd-checklist__actions">
              <span className="vd-checklist__badge">Review required</span>
              <button type="button" className="admin-action admin-action--ghost" onClick={() => setModal('location')}>Add location</button>
            </div>
          </div>
          <ul className="vd-checklist__list">
            <li className="vd-checklist__item vd-checklist__item--done">
              <IconBuildingStore size={15} stroke={2} />
              <span>Business registration verified</span>
            </li>
            <li className="vd-checklist__item vd-checklist__item--done">
              <IconHeartbeat size={15} stroke={2} />
              <span>Health certificate on file</span>
            </li>
            <li className="vd-checklist__item vd-checklist__item--done">
              <IconShieldCheck size={15} stroke={2} />
              <span>Insurance details confirmed</span>
            </li>
            <li className="vd-checklist__item vd-checklist__item--done">
              <IconMenu2 size={15} stroke={2} />
              <span>Menu reviewed for allergen labelling</span>
            </li>
            <li className="vd-checklist__item vd-checklist__item--pending">
              <IconCreditCard size={15} stroke={2} />
              <span>Payment provider pending</span>
            </li>
            <li className="vd-checklist__item vd-checklist__item--pending">
              <IconClipboardCheck size={15} stroke={2} />
              <span>Final operational sign-off</span>
            </li>
          </ul>
        </section>
      )}

      {/* ── Content Grid ── */}
      {!vendor.isPending && (
        <div className="vd-grid">
          {/* Left Column */}
          <div className="vd-grid__main">
            {/* Vendor Information */}
            <section className="vd-panel">
              <h3 className="vd-panel__heading">Vendor information</h3>
              <div className="vd-info">
                <div className="vd-info__row">
                  <div className="vd-info__icon"><IconMapPin size={15} stroke={1.8} /></div>
                  <div className="vd-info__field">
                    <span className="vd-info__label">Location</span>
                    <span className="vd-info__value">{vendor.vendor_location_name}</span>
                  </div>
                </div>

                <div className="vd-info__row vd-info__row--block">
                  <div className="vd-info__icon"><IconClock size={15} stroke={1.8} /></div>
                  <div className="vd-info__field">
                    <span className="vd-info__label">Operating hours</span>
                    {hours ? (
                      <div className="vd-hours">
                        {DAY_LABELS.map((label, i) => {
                          const day = hours[i];
                          return (
                            <div key={i} className={`vd-hours__day${day.closed ? ' vd-hours__day--closed' : ''}`}>
                              <span className="vd-hours__label">{label}</span>
                              <span className="vd-hours__time">{day.closed ? 'Closed' : day.time}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="vd-info__value">Not set</span>
                    )}
                    <span className="vd-info__muted">Est. prep time: {vendor.estimated_prep_minutes || 0} min</span>
                  </div>
                </div>

                <div className="vd-info__row">
                  <div className="vd-info__icon"><IconUser size={15} stroke={1.8} /></div>
                  <div className="vd-info__field">
                    <span className="vd-info__label">Contact person</span>
                    <span className="vd-info__value">{vendor.manager_name}</span>
                  </div>
                </div>

                <div className="vd-info__row">
                  <div className="vd-info__icon"><IconMail size={15} stroke={1.8} /></div>
                  <div className="vd-info__field">
                    <span className="vd-info__label">Email</span>
                    {vendor.support_email
                      ? <a href={`mailto:${vendor.support_email}`} className="vd-info__link">{vendor.support_email}</a>
                      : <span className="vd-info__value">\u2014</span>}
                  </div>
                </div>

                <div className="vd-info__row">
                  <div className="vd-info__icon"><IconPhone size={15} stroke={1.8} /></div>
                  <div className="vd-info__field">
                    <span className="vd-info__label">Phone</span>
                    <span className="vd-info__value">{vendor.support_phone || '\u2014'}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Operating Locations */}
            <section className="vd-panel">
              <div className="vd-panel__header">
                <h3 className="vd-panel__heading">Operating locations</h3>
                <button type="button" className="admin-action admin-action--ghost" onClick={() => setModal('location')}>
                  <IconPlus size={14} /> Add location
                </button>
              </div>
              {vendor.locations.length === 0 ? (
                <p className="vd-panel__empty">No operating locations have been assigned.</p>
              ) : (
                <div className="vd-list-wrap">
                  <div className="vd-locations">
                    {vendor.locations.slice(0, locationsVisibleCount).map((location) => (
                      <div className="vd-locations__row" key={location.id}>
                        <div className="vd-locations__info">
                          <span className="vd-locations__name">
                            {[location.site_name, location.building_name, location.collection_point_name].filter(Boolean).join(' \u00b7 ')}
                          </span>
                          <span className="vd-locations__meta">
                            {location.service_status}{' \u00b7 '}{location.estimated_prep_minutes || '\u2014'} min prep
                          </span>
                        </div>
                        <div className="vd-locations__actions">
                          <StatusPill status={location.service_status} />
                          <button type="button" className="admin-action admin-action--ghost" onClick={() => setModal({ type: 'location', location })}>Edit</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {locationsLoading && (
                    <div className="vd-loading-skeleton">
                      <div className="skeleton skeleton--text" style={{ width: '100%', height: 20 }} />
                      <div className="skeleton skeleton--text" style={{ width: '100%', height: 20 }} />
                    </div>
                  )}
                  <div ref={locationsBottomRef} />
                  {vendor.locations.length > locationsVisibleCount && !locationsLoading && (
                    <button type="button" className="vd-load-more" onClick={loadMoreLocations}>
                      Load more ({vendor.locations.length - locationsVisibleCount} remaining)
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* Right Column */}
          <div className="vd-grid__side">
            {/* Staff */}
            <section className="vd-panel">
              <div className="vd-panel__header">
                <h3 className="vd-panel__heading">Staff</h3>
                <button type="button" className="admin-action admin-action--ghost" onClick={() => setModal('staff')}>
                  <IconPlus size={14} /> Add staff
                </button>
              </div>
              {vendor.staff.length === 0 ? (
                <p className="vd-panel__empty">No staff members assigned.</p>
              ) : (
                <div className="vd-list-wrap">
                  <div className="vd-staff">
                    {vendor.staff.slice(0, staffVisibleCount).map((member) => (
                      <div className="vd-staff__row" key={member.user_id}>
                        <div className="vd-staff__info">
                          <span className="vd-staff__name">{member.full_name || member.email || member.user_id}</span>
                          <span className="vd-staff__meta">{member.role} · {member.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                        <button type="button" className="admin-action admin-action--ghost-danger" onClick={() => handleStaffRemove(member.user_id)} disabled={actionLoading}>Remove</button>
                      </div>
                    ))}
                  </div>
                  {staffLoading && (
                    <div className="vd-loading-skeleton">
                      <div className="skeleton skeleton--text" style={{ width: '100%', height: 20 }} />
                      <div className="skeleton skeleton--text" style={{ width: '100%', height: 20 }} />
                    </div>
                  )}
                  <div ref={staffBottomRef} />
                  {vendor.staff.length > staffVisibleCount && !staffLoading && (
                    <button type="button" className="vd-load-more" onClick={loadMoreStaff}>
                      Load more ({vendor.staff.length - staffVisibleCount} remaining)
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Menu Categories */}
            <section className="vd-panel">
              <div className="vd-panel__header">
                <h3 className="vd-panel__heading">Menu categories</h3>
                <button type="button" className="admin-action admin-action--ghost" onClick={() => setModal('category')}>
                  <IconPlus size={14} /> Add category
                </button>
              </div>
              {menuItemsLoading ? (
                <div className="vd-loading-skeleton">
                  <div className="skeleton skeleton--text" style={{ width: '100%', height: 20 }} />
                  <div className="skeleton skeleton--text" style={{ width: '100%', height: 20 }} />
                  <div className="skeleton skeleton--text" style={{ width: '100%', height: 20 }} />
                </div>
              ) : menuCategories.length === 0 ? (
                <p className="vd-panel__empty">No categories defined.</p>
              ) : (
                <div className="vd-list-wrap">
                  <div className="admin-menu-items-table">
                    <div className="admin-menu-items-table__head">
                      <span>Name</span><span>Sort</span><span>Items</span><span /><span>Actions</span></div>
                    {menuCategories.slice(0, categoriesVisibleCount).map((cat) => (
                      <div className="admin-menu-items-table__row" key={cat.id}>
                        <div className="admin-menu-items-table__name"><strong>{truncate(cat.name, ITEM_NAME_MAX)}</strong></div>
                        <span>{cat.sort_order ?? 0}</span>
                        <span>{menuItems.filter((item) => item.category_id === cat.id).length}</span>
                        <span />
                        <div className="vendor-managed-row__actions">
                          <button type="button" className="admin-action admin-action--ghost" onClick={() => setModal({ type: 'category', category: cat })}>Edit</button>
                          <button type="button" className="admin-action admin-action--ghost-danger" onClick={() => handleCategoryDelete(cat.id)} disabled={actionLoading}><IconTrash size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {categoriesLoading && (
                    <div className="vd-loading-skeleton">
                      <div className="skeleton skeleton--text" style={{ width: '100%', height: 20 }} />
                      <div className="skeleton skeleton--text" style={{ width: '100%', height: 20 }} />
                    </div>
                  )}
                  <div ref={categoriesBottomRef} />
                  {menuCategories.length > categoriesVisibleCount && !categoriesLoading && (
                    <button type="button" className="vd-load-more" onClick={loadMoreCategories}>
                      Load more ({menuCategories.length - categoriesVisibleCount} remaining)
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Menu Items */}
            <section className="vd-panel">
              <div className="vd-panel__header">
                <h3 className="vd-panel__heading">Menu items</h3>
                <button type="button" className="admin-action admin-action--ghost" onClick={() => setModal('menuItem')}>
                  <IconPlus size={14} /> Add item
                </button>
              </div>
              {menuItemsLoading ? (
                <div className="vd-loading-skeleton">
                  <div className="skeleton skeleton--text" style={{ width: '100%', height: 20 }} />
                  <div className="skeleton skeleton--text" style={{ width: '100%', height: 20 }} />
                  <div className="skeleton skeleton--text" style={{ width: '100%', height: 20 }} />
                </div>
              ) : menuItems.length === 0 ? (
                <p className="vd-panel__empty">No menu items have been added.</p>
              ) : (
                <div className="vd-list-wrap">
                  <div className="admin-menu-items-table">
                    <div className="admin-menu-items-table__head">
                      <span>Name</span><span>Category</span><span>Price</span><span>Status</span><span>Actions</span></div>
                    {menuItems.slice(0, menuItemsVisibleCount).map((item) => (
                      <div className="admin-menu-items-table__row" key={item.id}>
                        <div className="admin-menu-items-table__name">
                          <strong>{truncate(item.name, ITEM_NAME_MAX)}</strong>
                          {item.description && <span>{truncate(item.description, 50)}</span>}
                        </div>
                        <span>{truncate(item.menu_categories?.name, ITEM_NAME_MAX) || '\u2014'}</span>
                        <span>R {Number(item.base_price).toFixed(2)}</span>
                        <span className={`admin-status admin-status--${item.status === 'available' ? 'approved' : item.status === 'sold_out' ? 'rejected' : 'pending'}`}>{item.status}</span>
                        <div className="vendor-managed-row__actions">
                          <button type="button" className="admin-action admin-action--ghost" onClick={() => setModal({ type: 'menuItem', item })}>Edit</button>
                          <button type="button" className="admin-action admin-action--ghost-danger" onClick={() => handleMenuItemDelete(item.id)} disabled={actionLoading}><IconTrash size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {menuItemsPageLoading && (
                    <div className="vd-loading-skeleton">
                      <div className="skeleton skeleton--text" style={{ width: '100%', height: 20 }} />
                      <div className="skeleton skeleton--text" style={{ width: '100%', height: 20 }} />
                    </div>
                  )}
                  <div ref={menuItemsBottomRef} />
                  {menuItems.length > menuItemsVisibleCount && !menuItemsPageLoading && (
                    <button type="button" className="vd-load-more" onClick={loadMoreMenuItems}>
                      Load more ({menuItems.length - menuItemsVisibleCount} remaining)
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {modal === 'edit' && <VendorProfileModal vendor={vendor} onClose={() => setModal(null)} onSubmit={handleProfileUpdate} submitting={actionLoading} />}
      {modal === 'location' && <VendorLocationModal onClose={() => setModal(null)} onSubmit={handleLocationCreate} submitting={actionLoading} />}
      {modal?.type === 'location' && <VendorLocationModal key={modal.location.id} location={modal.location} onClose={() => setModal(null)} onSubmit={(payload) => handleLocationUpdate(modal.location.id, payload)} submitting={actionLoading} />}
      {modal === 'staff' && <StaffModal onClose={() => setModal(null)} onSubmit={handleStaffAdd} submitting={actionLoading} />}
      {modal === 'menuItem' && <MenuItemModal categories={menuCategories} onClose={() => setModal(null)} onSubmit={handleMenuItemCreate} submitting={actionLoading} />}
      {modal?.type === 'menuItem' && <MenuItemModal key={modal.item.id} item={modal.item} categories={menuCategories} onClose={() => setModal(null)} onSubmit={(payload) => handleMenuItemUpdate(modal.item.id, payload)} submitting={actionLoading} />}
      {modal === 'category' && <CategoryModal onClose={() => setModal(null)} onSubmit={handleCategoryCreate} submitting={actionLoading} />}
      {modal?.type === 'category' && <CategoryModal key={modal.category.id} category={modal.category} onClose={() => setModal(null)} onSubmit={(payload) => handleCategoryUpdate(modal.category.id, payload)} submitting={actionLoading} />}

      {/* ── Approval Loading Overlay ── */}
      {creating && (
        <div className="vendor-creating-overlay">
          <div className="vendor-creating-card">
            <div className="vendor-creating-spinner" />
            <p className="vendor-creating-msg">{LOAD_MESSAGES[loadMsg]}</p>
            <div className="vendor-creating-bar"><div className="vendor-creating-bar__fill" /></div>
            <p className="vendor-creating-hint">Hang tight, this won't take long.</p>
          </div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {rejectModal && (
        <div className="admin-modal" role="dialog" aria-modal="true">
          <div className="admin-modal__overlay" onClick={() => { if (!creating) { setRejectModal(false); setRejectReason(''); setRejectError(''); } }} />
          <div className="admin-modal__card">
            <header className="admin-modal__head">
              <div className="admin-modal__icon admin-modal__icon--error"><IconX size={20} stroke={2} /></div>
              <div>
                <h3 className="admin-modal__title">Reject application?</h3>
                <p className="admin-modal__sub">{vendor.name}</p>
              </div>
            </header>
            <p className="admin-modal__copy">The vendor will be notified that their application was not accepted at this time. They will not appear in the active vendor list.</p>
            {rejectError && <div className="vendor-form-error" role="alert">{rejectError}</div>}
            <label className="admin-modal__field">
              <span>Reason (will be sent to applicant)</span>
              <textarea
                className="admin-modal__textarea"
                placeholder="Briefly explain why this application was rejected..."
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </label>
            <footer className="admin-modal__foot">
              <button type="button" className="admin-action admin-action--ghost" onClick={() => { setRejectModal(false); setRejectReason(''); setRejectError(''); }} disabled={creating}>Cancel</button>
              <button type="button" className="admin-action admin-action--reject" onClick={() => handleApproval('reject', rejectReason)} disabled={creating || !rejectReason.trim()}>
                <IconBan size={13} stroke={2} /> Confirm rejection
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
