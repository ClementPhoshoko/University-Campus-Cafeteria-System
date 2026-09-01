import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  IconSearch,
  IconMapPin,
  IconBuilding,
  IconBuildingStore,
  IconClipboardCheck,
  IconChevronRight,
  IconPlus,
  IconDownload,
  IconCheck,
  IconPower,
  IconClock,
} from '@tabler/icons-react';
import {
  ADMIN_SITES,
  ADMIN_BUILDINGS,
  ADMIN_COLLECTION_POINTS,
  formatCurrency,
} from './adminMockData.js';

const VIEW_TABS = [
  { id: 'sites', label: 'Sites', count: ADMIN_SITES.length },
  { id: 'buildings', label: 'Buildings', count: ADMIN_BUILDINGS.length },
  { id: 'collection-points', label: 'Collection points', count: ADMIN_COLLECTION_POINTS.length },
];

function StatusPill({ active }) {
  return (
    <span className={`admin-status admin-status--${active ? 'success' : 'info'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function SiteCard({ site, buildingCount, vendorCount, cpCount }) {
  return (
    <Link to={`/admin/cafeterias/${site.id}`} className="admin-site-card">
      <div className="admin-site-card__cover">
        <img src={site.image} alt="" />
        <div className="admin-site-card__cover-fade" />
        <span className="admin-site-card__code">{site.code}</span>
      </div>

      <div className="admin-site-card__body">
        <div className="admin-site-card__head">
          <h3 className="admin-site-card__name">{site.name}</h3>
          <StatusPill active={site.isActive} />
        </div>
        <p className="admin-site-card__address">
          <IconMapPin size={12} stroke={1.8} />
          {site.address}
        </p>

        <div className="admin-site-card__stats">
          <div className="admin-site-card__stat">
            <span className="admin-site-card__stat-value">{buildingCount}</span>
            <span className="admin-site-card__stat-label">Buildings</span>
          </div>
          <div className="admin-site-card__stat">
            <span className="admin-site-card__stat-value">{vendorCount}</span>
            <span className="admin-site-card__stat-label">Vendors</span>
          </div>
          <div className="admin-site-card__stat">
            <span className="admin-site-card__stat-value">{cpCount}</span>
            <span className="admin-site-card__stat-label">Pickup points</span>
          </div>
          <div className="admin-site-card__stat">
            <span className="admin-site-card__stat-value">{site.ordersToday}</span>
            <span className="admin-site-card__stat-label">Orders today</span>
          </div>
        </div>

        <div className="admin-site-card__foot">
          <span className="admin-site-card__revenue">
            30d revenue <strong>{formatCurrency(site.orderVolume30d)}</strong>
          </span>
          <span className="admin-link-cta">
            Manage <IconChevronRight size={13} stroke={2} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function BuildingCard({ building }) {
  return (
    <Link to={`/admin/cafeterias/${building.id}`} className="admin-building-card">
      <div className="admin-building-card__media">
        {building.images?.length > 0 ? (
          <img src={building.images[0]} alt="" />
        ) : (
          <div className="admin-building-card__placeholder">
            <IconBuilding size={28} stroke={1.4} />
          </div>
        )}
      </div>
      <div className="admin-building-card__body">
        <div className="admin-building-card__head">
          <span className="admin-building-card__code">{building.code}</span>
          <StatusPill active={building.isActive} />
        </div>
        <h4 className="admin-building-card__name">{building.name}</h4>
        <p className="admin-building-card__site">
          <IconMapPin size={11} stroke={1.8} />
          {building.siteName}
        </p>

        <div className="admin-building-card__stats">
          <span><strong>{building.floors}</strong> floors</span>
          <span><strong>{building.collectionPoints}</strong> pickup</span>
          <span><strong>{building.vendors}</strong> vendors</span>
          <span><strong>{building.ordersToday}</strong> orders</span>
        </div>
      </div>
    </Link>
  );
}

function CollectionPointRow({ point }) {
  return (
    <li className="admin-cp-row">
      <div className="admin-cp-row__icon">
        <IconClipboardCheck size={18} stroke={1.8} />
      </div>
      <div className="admin-cp-row__body">
        <div className="admin-cp-row__head">
          <span className="admin-cp-row__name">{point.name}</span>
          <span className={`admin-cp-row__express${point.isExpress ? ' admin-cp-row__express--yes' : ' admin-cp-row__express--no'}`}>
            {point.isExpress ? 'Express' : 'Catering'}
          </span>
        </div>
        <span className="admin-cp-row__loc">
          <IconMapPin size={11} stroke={1.8} /> {point.buildingName} · {point.siteName}
        </span>
        <p className="admin-cp-row__instr">{point.instructions}</p>
      </div>
      <div className="admin-cp-row__meta">
        <span className="admin-cp-row__stat">
          <strong>{point.ordersToday}</strong>
          <small>orders today</small>
        </span>
        <span className="admin-cp-row__stat">
          <strong>{point.avgPickupMins ? `${point.avgPickupMins} min` : '—'}</strong>
          <small>avg pickup</small>
        </span>
        <StatusPill active={point.isActive} />
      </div>
    </li>
  );
}

function NewSiteModal({ onClose }) {
  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <div className="admin-modal__overlay" onClick={onClose} />
      <div className="admin-modal__card admin-modal__card--lg">
        <header className="admin-modal__head">
          <div className="admin-modal__icon admin-modal__icon--info">
            <IconPlus size={20} stroke={2} />
          </div>
          <div>
            <h3 className="admin-modal__title">Register new site</h3>
            <p className="admin-modal__sub">Add a new campus / site to the platform.</p>
          </div>
        </header>

        <p className="admin-modal__copy">
          Sites are top-level locations. Once approved you can add buildings, floors and collection points.
        </p>

        <div className="admin-form-grid">
          <label className="admin-modal__field">
            <span>Site name</span>
            <input type="text" className="admin-input" placeholder="e.g. Merchant Place · Riverside" />
          </label>
          <label className="admin-modal__field">
            <span>Site code</span>
            <input type="text" className="admin-input" placeholder="e.g. MP-RIVERSIDE" />
          </label>
          <label className="admin-modal__field admin-modal__field--full">
            <span>Address</span>
            <input type="text" className="admin-input" placeholder="Street, building, suburb, city, postal" />
          </label>
          <label className="admin-modal__field">
            <span>Latitude</span>
            <input type="text" className="admin-input" placeholder="-26.1076" />
          </label>
          <label className="admin-modal__field">
            <span>Longitude</span>
            <input type="text" className="admin-input" placeholder="28.0567" />
          </label>
          <label className="admin-modal__field">
            <span>Timezone</span>
            <input type="text" className="admin-input" placeholder="Africa/Johannesburg" defaultValue="Africa/Johannesburg" />
          </label>
          <label className="admin-modal__field">
            <span>Pilot code (optional)</span>
            <input type="text" className="admin-input" placeholder="Pilot config key" />
          </label>
        </div>

        <footer className="admin-modal__foot">
          <button type="button" className="admin-action" onClick={onClose}>Cancel</button>
          <button type="button" className="admin-action admin-action--approve">
            <IconCheck size={13} stroke={2} />
            Register site
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function AdminCafeteriaList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get('view') || 'sites';
  const initialSite = searchParams.get('site') || 'all';
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState('');
  const [showNew, setShowNew] = useState(false);

  const handleView = (next) => {
    setView(next);
    setSearchParams({ view: next });
  };

  const filteredSites = useMemo(() => {
    if (!query) return ADMIN_SITES;
    const q = query.toLowerCase();
    return ADMIN_SITES.filter((s) =>
      `${s.name} ${s.code} ${s.address}`.toLowerCase().includes(q)
    );
  }, [query]);

  const filteredBuildings = useMemo(() => {
    if (!query) return ADMIN_BUILDINGS;
    const q = query.toLowerCase();
    return ADMIN_BUILDINGS.filter((b) =>
      `${b.name} ${b.code} ${b.siteName} ${b.address}`.toLowerCase().includes(q)
    );
  }, [query]);

  const filteredCollectionPoints = useMemo(() => {
    let list = ADMIN_COLLECTION_POINTS;
    if (initialSite !== 'all') {
      list = list.filter((cp) => cp.buildingId && ADMIN_BUILDINGS.find((b) => b.id === cp.buildingId)?.siteId === initialSite);
    }
    if (!query) return list;
    const q = query.toLowerCase();
    return list.filter((cp) => `${cp.name} ${cp.buildingName} ${cp.siteName}`.toLowerCase().includes(q));
  }, [query, initialSite]);

  const activeSites = ADMIN_SITES.filter((s) => s.isActive).length;
  const activeBuildings = ADMIN_BUILDINGS.filter((b) => b.isActive).length;
  const activeCollectionPoints = ADMIN_COLLECTION_POINTS.filter((cp) => cp.isActive).length;

  const renderBuildingsFor = (siteId) =>
    ADMIN_BUILDINGS.filter((b) => b.siteId === siteId);

  return (
    <div className="admin-orders">
      <header className="admin-vendors__header">
        <div>
          <span className="admin-card__eyebrow">Locations</span>
          <h2 className="admin-vendors__title">Cafeterias</h2>
          <p className="admin-vendors__sub">
            Register and manage the campus sites where food orders are placed, prepared, and collected.
          </p>
        </div>
        <div className="admin-vendors__actions">
          <button type="button" className="admin-action">
            <IconDownload size={13} stroke={2} />
            Export
          </button>
          <button type="button" className="admin-action admin-action--approve" onClick={() => setShowNew(true)}>
            <IconPlus size={13} stroke={2} />
            New site
          </button>
        </div>
      </header>

      <section className="admin-kpis" aria-label="Location metrics">
        <div className="admin-kpi admin-kpi--blue">
          <span className="admin-kpi__label">Active sites</span>
          <span className="admin-kpi__value">{activeSites} / {ADMIN_SITES.length}</span>
          <span className="admin-kpi__sub">across the pilot</span>
        </div>
        <div className="admin-kpi admin-kpi--green">
          <span className="admin-kpi__label">Buildings</span>
          <span className="admin-kpi__value">{activeBuildings}</span>
          <span className="admin-kpi__sub">active buildings</span>
        </div>
        <div className="admin-kpi admin-kpi--blue">
          <span className="admin-kpi__label">Collection points</span>
          <span className="admin-kpi__value">{activeCollectionPoints}</span>
          <span className="admin-kpi__sub">live pickup locations</span>
        </div>
        <div className="admin-kpi admin-kpi--amber">
          <span className="admin-kpi__label">Inactive</span>
          <span className="admin-kpi__value">
            {ADMIN_SITES.length - activeSites + ADMIN_BUILDINGS.length - activeBuildings + ADMIN_COLLECTION_POINTS.length - activeCollectionPoints}
          </span>
          <span className="admin-kpi__sub">awaiting activation</span>
        </div>
      </section>

      <div className="admin-vendors__tabs" role="tablist">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            className={`admin-vendors__tab${view === tab.id ? ' admin-vendors__tab--active' : ''}`}
            onClick={() => handleView(tab.id)}
          >
            {tab.id === 'sites' && <IconMapPin size={16} stroke={1.8} />}
            {tab.id === 'buildings' && <IconBuilding size={16} stroke={1.8} />}
            {tab.id === 'collection-points' && <IconClipboardCheck size={16} stroke={1.8} />}
            {tab.label}
            <span className="admin-vendors__tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="admin-orders__filters">
        <div className="admin-vendors__search admin-orders__search">
          <IconSearch size={16} stroke={1.8} />
          <input
            type="search"
            placeholder={`Search ${view === 'sites' ? 'sites' : view === 'buildings' ? 'buildings' : 'collection points'}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search"
          />
        </div>
        {view === 'collection-points' && (
          <select
            className="admin-orders__vendor-select"
            value={initialSite}
            onChange={(e) => {
              const v = e.target.value;
              setSearchParams(v === 'all' ? { view: 'collection-points' } : { view: 'collection-points', site: v });
            }}
            aria-label="Filter by site"
          >
            <option value="all">All sites</option>
            {ADMIN_SITES.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {view === 'sites' && (
        <div className="admin-site-grid">
          {filteredSites.map((site) => {
            const buildingCount = renderBuildingsFor(site.id).length;
            const vendorCount = renderBuildingsFor(site.id).reduce((s, b) => s + b.vendors, 0);
            const cpCount = renderBuildingsFor(site.id).reduce((s, b) => s + b.collectionPoints, 0);
            return (
              <SiteCard
                key={site.id}
                site={site}
                buildingCount={buildingCount}
                vendorCount={vendorCount}
                cpCount={cpCount}
              />
            );
          })}
        </div>
      )}

      {view === 'buildings' && (
        <div className="admin-building-grid">
          {filteredBuildings.map((b) => (
            <BuildingCard key={b.id} building={b} />
          ))}
        </div>
      )}

      {view === 'collection-points' && (
        <div className="admin-cp-list">
          {filteredCollectionPoints.length > 0 ? (
            <ul className="admin-cp-rows">
              {filteredCollectionPoints.map((cp) => (
                <CollectionPointRow key={cp.id} point={cp} />
              ))}
            </ul>
          ) : (
            <div className="admin-empty">
              <IconClipboardCheck size={32} stroke={1.4} />
              <h3>No pickup points found</h3>
              <p>Try adjusting the search or site filter.</p>
            </div>
          )}
        </div>
      )}

      {showNew && <NewSiteModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
