import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  IconBuilding,
  IconBuildingStore,
  IconCheck,
  IconClipboardCheck,
  IconClock,
  IconMapPin,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react';
import Pagination from '../../components/ui/Pagination.jsx';
import { useAdminLocations } from '../../hooks/useAdminLocations.js';
import { uploadAdminAsset } from '../../services/adminApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import SkeletonCard from '../../components/ui/SkeletonCard.jsx';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.png';

const VIEW_TABS = [
  { id: 'sites', label: 'Sites' },
  { id: 'buildings', label: 'Buildings' },
  { id: 'collection-points', label: 'Collection points' },
];

function StatusPill({ active }) {
  return <span className={`admin-status admin-status--${active ? 'success' : 'info'}`}>{active ? 'Active' : 'Inactive'}</span>;
}

function SiteCard({ site }) {
  return (
    <Link to={`/admin/cafeterias/${site.id}`} className="admin-site-card">
      <div className="admin-site-card__cover admin-site-card__cover--plain">
        {site.cover_image_url ? <img src={site.cover_image_url} alt={site.name} /> : <IconMapPin size={34} stroke={1.4} />}
        <span className="admin-site-card__code">{site.code || 'SITE'}</span>
      </div>
      <div className="admin-site-card__body">
        <div className="admin-site-card__head"><h3 className="admin-site-card__name">{site.name}</h3><StatusPill active={site.is_active} /></div>
        <p className="admin-site-card__address"><IconMapPin size={12} stroke={1.8} />{site.address || 'No address recorded'}</p>
        <div className="admin-site-card__stats">
          <div className="admin-site-card__stat"><span className="admin-site-card__stat-value">{site.building_count || 0}</span><span className="admin-site-card__stat-label">Buildings</span></div>
          <div className="admin-site-card__stat"><span className="admin-site-card__stat-value">{site.vendor_count || 0}</span><span className="admin-site-card__stat-label">Vendors</span></div>
          <div className="admin-site-card__stat"><span className="admin-site-card__stat-value">{site.collection_point_count || 0}</span><span className="admin-site-card__stat-label">Pickup points</span></div>
        </div>
        <div className="admin-site-card__foot"><span className="admin-site-card__revenue">Timezone</span><strong className="admin-site-card__price">{site.timezone || '—'}</strong></div>
      </div>
    </Link>
  );
}

function BuildingCard({ building }) {
  return (
    <Link to={`/admin/cafeterias/${building.id}`} className="admin-building-card">
      <div className="admin-building-card__media">{building.cover_image_url ? <img src={building.cover_image_url} alt={building.name} /> : <div className="admin-building-card__placeholder"><IconBuilding size={22} stroke={1.4} /></div>}</div>
      <div className="admin-building-card__body">
        <div className="admin-building-card__head"><span className="admin-building-card__code">{building.code || 'BUILDING'}</span><StatusPill active={building.is_active} /></div>
        <h4 className="admin-building-card__name">{building.name}</h4>
        <p className="admin-building-card__site"><IconMapPin size={10} stroke={1.8} />{building.site_name || 'Site unavailable'}</p>
        <div className="admin-building-card__stats"><span><strong>{building.floor_count || 0}</strong> floors</span><span><strong>{building.collection_point_count || 0}</strong> pickup</span></div>
      </div>
    </Link>
  );
}

function CollectionPointRow({ point }) {
  return (
    <li className="admin-cp-row">
      <div className="admin-cp-row__icon"><IconClipboardCheck size={18} stroke={1.8} /></div>
      <div className="admin-cp-row__body">
        <div className="admin-cp-row__head"><span className="admin-cp-row__name">{point.name}</span><span className={`admin-cp-row__express${point.is_express ? ' admin-cp-row__express--yes' : ' admin-cp-row__express--no'}`}>{point.is_express ? 'Express' : 'Catering'}</span><StatusPill active={point.is_active} /></div>
        <span className="admin-cp-row__loc"><IconMapPin size={11} stroke={1.8} />{point.building_name || 'Building unavailable'} · {point.site_name || 'Site unavailable'}</span>
        <p className="admin-cp-row__instr">{point.instructions || 'No collection instructions recorded.'}</p>
      </div>
    </li>
  );
}

function NewSiteModal({ onClose, onSubmit, submitting }) {
  const [form, setForm] = useState({ name: '', code: '', address: '', latitude: '', longitude: '', timezone: 'Africa/Johannesburg', is_active: true, cover_file: null });
  const [error, setError] = useState('');
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: key === 'code' ? value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') : value }));
  const submit = async () => {
    if (!form.name.trim()) return setError('Site name is required.');
    try {
      await onSubmit({ ...form, name: form.name.trim(), code: form.code.trim() || null, address: form.address.trim() || null, latitude: form.latitude === '' ? undefined : Number(form.latitude), longitude: form.longitude === '' ? undefined : Number(form.longitude) });
      onClose();
    } catch (err) { setError(err.message || 'Could not create site.'); }
  };
  return (
    <div className="admin-modal" role="dialog" aria-modal="true"><div className="admin-modal__overlay" onClick={onClose} /><div className="admin-modal__card admin-modal__card--lg">
      <header className="admin-modal__head"><div className="admin-modal__icon admin-modal__icon--info"><IconPlus size={20} /></div><div><h3 className="admin-modal__title">Register new site</h3><p className="admin-modal__sub">Add a top-level campus location.</p></div></header>
      {error && <div className="vendor-form-error">{error}</div>}
      <div className="admin-form-grid">
        <label className="admin-modal__field"><span>Site name</span><input autoFocus className="admin-input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Merchant Place Riverside" /></label>
        <label className="admin-modal__field"><span>Site code</span><input className="admin-input" value={form.code} onChange={(e) => update('code', e.target.value)} placeholder="MP-RIVERSIDE" maxLength={50} /><span className="admin-modal__hint">Uppercase, digits, hyphens, or underscores only</span></label>
        <label className="admin-modal__field admin-modal__field--full"><span>Address</span><input className="admin-input" value={form.address} onChange={(e) => update('address', e.target.value)} /></label>
        <label className="admin-modal__field"><span>Latitude</span><input className="admin-input" type="number" step="any" value={form.latitude} onChange={(e) => update('latitude', e.target.value)} /></label>
        <label className="admin-modal__field"><span>Longitude</span><input className="admin-input" type="number" step="any" value={form.longitude} onChange={(e) => update('longitude', e.target.value)} /></label>
        <label className="admin-modal__field"><span>Timezone</span><input className="admin-input" value={form.timezone} onChange={(e) => update('timezone', e.target.value)} /></label><label className="admin-modal__field"><span>Cover image</span><input className="admin-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => update('cover_file', e.target.files?.[0] || null)} /></label>
        <label className="vendor-checkbox"><input type="checkbox" checked={form.is_active} onChange={(e) => update('is_active', e.target.checked)} /> Active site</label>
      </div>
      <footer className="admin-modal__foot"><button type="button" className="admin-action" onClick={onClose}>Cancel</button><button type="button" className="admin-action admin-action--approve" onClick={submit} disabled={submitting}>{submitting ? 'Registering…' : 'Register site'}</button></footer>
    </div></div>
  );
}

export default function AdminCafeteriaList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState(searchParams.get('view') || 'sites');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPageState] = useState(() => parseInt(searchParams.get('page')) || 1);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const itemsPerPage = 12;
  const { session } = useAuth();
  const { sites, allBuildings, allCollectionPoints, buildingsBySite, collectionPointsByBuilding, fetchAllBuildings, fetchAllCollectionPoints, addSite, loading, errors } = useAdminLocations();
  const [loaded, setLoaded] = useState(false);
  const fetchStartedRef = useRef(false);

  useEffect(() => {
    if (loading.sites) fetchStartedRef.current = true;
    if (!loading.sites && fetchStartedRef.current && !loaded) setLoaded(true);
  }, [loading.sites]);

  useEffect(() => {
    const urlPage = parseInt(searchParams.get('page')) || 1;
    if (urlPage !== currentPage) setCurrentPageState(urlPage);
  }, [searchParams]);

  const setPage = (value) => {
    setCurrentPageState(value);
    setSearchParams((prev) => {
      if (value === 1 || value === undefined) prev.delete('page');
      else prev.set('page', String(value));
      return prev;
    });
  };

  useEffect(() => { setPage(1); }, [query, statusFilter, view]);

  const buildingsFetchedRef = useRef(false);
  const collectionPointsFetchedRef = useRef(false);

  useEffect(() => {
    if (view === 'buildings' && !buildingsFetchedRef.current && sites.length > 0) {
      buildingsFetchedRef.current = true;
      fetchAllBuildings({ page: 1, limit: 1000 }).catch(() => {});
    }
  }, [view, sites.length, fetchAllBuildings]);

  useEffect(() => {
    if (view === 'collection-points' && !collectionPointsFetchedRef.current && sites.length > 0) {
      collectionPointsFetchedRef.current = true;
      fetchAllCollectionPoints({ page: 1, limit: 1000 }).catch(() => {});
    }
  }, [view, sites.length, fetchAllCollectionPoints]);

  const buildings = useMemo(() => allBuildings.map((building) => ({ ...building, site_name: sites.find((site) => site.id === building.site_id)?.name || 'Unknown site' })), [allBuildings, sites]);
  const collectionPoints = useMemo(() => allCollectionPoints.map((point) => { const building = buildings.find((item) => item.id === point.building_id); return { ...point, building_name: building?.name, site_name: building?.site_name }; }), [allCollectionPoints, buildings]);
  const filteredSites = useMemo(() => sites.filter((site) => (statusFilter === 'all' || (statusFilter === 'active' ? site.is_active : !site.is_active)) && (!query || `${site.name} ${site.code || ''} ${site.address || ''}`.toLowerCase().includes(query.toLowerCase()))), [query, sites, statusFilter]);
  const filteredBuildings = useMemo(() => buildings.filter((building) => (statusFilter === 'all' || (statusFilter === 'active' ? building.is_active : !building.is_active)) && (!query || `${building.name} ${building.code || ''} ${building.site_name}`.toLowerCase().includes(query.toLowerCase()))), [buildings, query, statusFilter]);
  const filteredPoints = useMemo(() => collectionPoints.filter((point) => (!query || `${point.name} ${point.building_name || ''} ${point.site_name || ''}`.toLowerCase().includes(query.toLowerCase()))), [collectionPoints, query]);
  const currentItems = view === 'sites' ? filteredSites : view === 'buildings' ? filteredBuildings : filteredPoints;
  const paginatedItems = currentItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const counts = { sites: sites.length, buildings: buildings.length, 'collection-points': collectionPoints.length };
  const activeSites = sites.filter((site) => site.is_active).length;
  const activeBuildings = buildings.filter((building) => building.is_active).length;
  const activePoints = collectionPoints.filter((point) => point.is_active).length;
  const handleView = (next) => { setView(next); setStatusFilter('all'); setSearchParams((prev) => { prev.set('view', next); prev.delete('page'); return prev; }); };
  const handleCreate = async (payload) => { setSubmitting(true); try { const { cover_file: coverFile, ...sitePayload } = payload; const response = await addSite(sitePayload); if (coverFile && response.site?.id) await uploadAdminAsset(session?.access_token, 'site', response.site.id, coverFile); } finally { setSubmitting(false); } };

  return <div className="admin-orders">
    <header className="admin-vendors__header"><div><span className="admin-card__eyebrow">Locations</span><p className="admin-vendors__sub">Register and manage the sites where food orders are placed, prepared, and collected.</p></div><div className="admin-vendors__actions"><button type="button" className="admin-action--ghost" onClick={() => setShowNew(true)}><IconPlus size={13} /> New site</button></div></header>
    <section className="admin-cafeterias__kpis"><div className="admin-cafeterias__kpi"><div className="admin-cafeterias__kpi-icon"><IconMapPin size={24} /></div><div className="admin-cafeterias__kpi-body"><span className="admin-cafeterias__kpi-label">Active sites</span><span className="admin-cafeterias__kpi-value">{!loaded ? <span className="skeleton skeleton--kpi-value" /> : <>{activeSites} / {sites.length}</>}</span></div></div><div className="admin-cafeterias__kpi"><div className="admin-cafeterias__kpi-icon"><IconBuilding size={24} /></div><div className="admin-cafeterias__kpi-body"><span className="admin-cafeterias__kpi-label">Active buildings</span><span className="admin-cafeterias__kpi-value">{!loaded ? <span className="skeleton skeleton--kpi-value" /> : activeBuildings}</span></div></div><div className="admin-cafeterias__kpi"><div className="admin-cafeterias__kpi-icon"><IconClipboardCheck size={24} /></div><div className="admin-cafeterias__kpi-body"><span className="admin-cafeterias__kpi-label">Active collection points</span><span className="admin-cafeterias__kpi-value">{!loaded ? <span className="skeleton skeleton--kpi-value" /> : activePoints}</span></div></div><div className="admin-cafeterias__kpi"><div className="admin-cafeterias__kpi-icon"><IconClock size={24} /></div><div className="admin-cafeterias__kpi-body"><span className="admin-cafeterias__kpi-label">Loaded records</span><span className="admin-cafeterias__kpi-value">{!loaded ? <span className="skeleton skeleton--kpi-value" /> : sites.length + buildings.length + collectionPoints.length}</span></div></div></section>
    <div className="admin-vendors__tabs" role="tablist">{VIEW_TABS.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={view === tab.id} className={`admin-vendors__tab${view === tab.id ? ' admin-vendors__tab--active' : ''}`} onClick={() => handleView(tab.id)}>{tab.id === 'sites' ? <IconMapPin size={16} /> : tab.id === 'buildings' ? <IconBuilding size={16} /> : <IconClipboardCheck size={16} />}{tab.label}<span className="admin-vendors__tab-count">{counts[tab.id]}</span></button>)}</div>
    <div className="admin-orders__filters"><div className="admin-vendors__search admin-orders__search"><IconSearch size={16} /><input type="search" placeholder={`Search ${view}`} value={query} onChange={(e) => setQuery(e.target.value)} /></div>{view !== 'collection-points' && <div className="admin-vendors__chips"><button type="button" className={`admin-vendors__chip${statusFilter === 'all' ? ' admin-vendors__chip--active' : ''}`} onClick={() => setStatusFilter('all')}>All</button><button type="button" className={`admin-vendors__chip${statusFilter === 'active' ? ' admin-vendors__chip--active' : ''}`} onClick={() => setStatusFilter('active')}>Active</button><button type="button" className={`admin-vendors__chip${statusFilter === 'inactive' ? ' admin-vendors__chip--active' : ''}`} onClick={() => setStatusFilter('inactive')}>Inactive</button></div>}</div>
    {!loaded && sites.length === 0 ? view === 'sites' ? <div className="admin-site-grid">{Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} lines={2} badges={1} />)}</div> : view === 'buildings' ? <div className="admin-building-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="admin-building-card" style={{ pointerEvents: 'none' }}><div className="admin-building-card__media"><div className="admin-building-card__placeholder"><span className="skeleton" style={{ width: 22, height: 22, borderRadius: 'var(--radius-sm)' }} /></div></div><div className="admin-building-card__body"><div className="admin-building-card__head"><span className="skeleton skeleton--badge" style={{ width: 60 }} /></div><div className="skeleton skeleton--title" style={{ width: '70%', marginTop: 6 }} /><div className="skeleton skeleton--text" style={{ width: '50%', marginTop: 4 }} /></div></div>)}</div> : <ul className="admin-cp-rows">{Array.from({ length: 5 }, (_, i) => <li key={i} className="admin-cp-row" style={{ pointerEvents: 'none' }}><div className="admin-cp-row__icon"><span className="skeleton" style={{ width: 18, height: 18, borderRadius: 'var(--radius-sm)' }} /></div><div className="admin-cp-row__body"><div className="admin-cp-row__head"><span className="skeleton skeleton--badge" style={{ width: 100 }} /><span className="skeleton skeleton--badge" style={{ width: 50 }} /></div><div className="skeleton skeleton--text" style={{ width: '60%', marginTop: 4 }} /></div></li>)}</ul> : errors.sites ? <div className="admin-empty"><h3>Could not load locations</h3><p>{errors.sites}</p></div> : paginatedItems.length === 0 ? <div className="admin-empty"><img src={emptyStateAvatar} alt="" className="admin-empty__avatar" /><h3>No locations found</h3><p>Try changing your search or filters.</p></div> : view === 'sites' ? <div className="admin-site-grid">{paginatedItems.map((site) => <SiteCard key={site.id} site={site} />)}</div> : view === 'buildings' ? <div className="admin-building-grid">{paginatedItems.map((building) => <BuildingCard key={building.id} building={building} />)}</div> : <div className="admin-cp-list"><ul className="admin-cp-rows">{paginatedItems.map((point) => <CollectionPointRow key={point.id} point={point} />)}</ul></div>}
    {currentItems.length > itemsPerPage && <Pagination currentPage={currentPage} totalPages={Math.ceil(currentItems.length / itemsPerPage)} totalItems={currentItems.length} itemsPerPage={itemsPerPage} label={view} onPageChange={setPage} />}
    {showNew && <NewSiteModal onClose={() => setShowNew(false)} onSubmit={handleCreate} submitting={submitting} />}
  </div>;
}
