import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  IconSearch,
  IconMapPin,
  IconBuilding,
  IconBuildingStore,
  IconClipboardCheck,
  IconChevronRight,
  IconChevronDown,
  IconPlus,
  IconDownload,
  IconCheck,
  IconPower,
  IconClock,
  IconDotsVertical,
} from '@tabler/icons-react';
import Pagination from '../../components/ui/Pagination.jsx';
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
          <StatusPill active={site.is_active} />
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
            <span className="admin-site-card__stat-value">{site.orders_today}</span>
            <span className="admin-site-card__stat-label">Orders today</span>
          </div>
        </div>

        <div className="admin-site-card__foot">
          <span className="admin-site-card__revenue">30d revenue</span>
          <strong className="admin-site-card__price">{formatCurrency(site.order_volume_30d)}</strong>
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
            <IconBuilding size={22} stroke={1.4} />
          </div>
        )}
      </div>
      <div className="admin-building-card__body">
        <div className="admin-building-card__head">
          <span className="admin-building-card__code">{building.code}</span>
          <StatusPill active={building.is_active} />
        </div>
        <h4 className="admin-building-card__name">{building.name}</h4>
        <p className="admin-building-card__site">
          <IconMapPin size={10} stroke={1.8} />
          {building.site_name}
        </p>
        <div className="admin-building-card__stats">
          <span><strong>{building.floor_count}</strong> floors</span>
          <span><strong>{building.collection_point_count}</strong> pickup</span>
          <span><strong>{building.orders_today}</strong> orders</span>
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
          <span className={`admin-cp-row__express${point.is_express ? ' admin-cp-row__express--yes' : ' admin-cp-row__express--no'}`}>
            {point.is_express ? 'Express' : 'Catering'}
          </span>
          <StatusPill active={point.is_active} />
        </div>
        <span className="admin-cp-row__loc">
          <IconMapPin size={11} stroke={1.8} />{point.building_name} · {point.site_name}
        </span>
        <p className="admin-cp-row__instr">{point.instructions}</p>
        <div className="admin-cp-row__stats">
          <span className="admin-cp-row__stat">
            <strong>{point.orders_today}</strong> orders today
          </span>
          <span className="admin-cp-row__stat">
            <strong>{point.avg_pickup_minutes ? `${point.avg_pickup_minutes} min` : '—'}</strong> avg pickup
          </span>
        </div>
      </div>
      <button type="button" className="admin-cp-row__actions" aria-label="Actions">
        <IconDotsVertical size={16} stroke={2} />
      </button>
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

const STATUS_FILTERS = {
  sites: [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'inactive', label: 'Inactive' },
  ],
  buildings: [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'inactive', label: 'Inactive' },
  ],
  'collection-points': [
    { id: 'all', label: 'All' },
    { id: 'express', label: 'Express' },
    { id: 'catering', label: 'Catering' },
  ],
};

export default function AdminCafeteriaList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get('view') || 'sites';
  const initialSite = searchParams.get('site') || 'all';
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [siteDropdownOpen, setSiteDropdownOpen] = useState(false);
  const itemsPerPage = 12;

  const handleView = (next) => {
    setView(next);
    setStatusFilter('all');
    setCurrentPage(1);
    setSiteDropdownOpen(false);
    setSearchParams({ view: next });
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleSiteSelect = (siteId) => {
    setSiteDropdownOpen(false);
    setSearchParams(siteId === 'all' ? { view: 'collection-points' } : { view: 'collection-points', site: siteId });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (siteDropdownOpen && !e.target.closest('.admin-orders__vendor-select-wrapper')) {
        setSiteDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [siteDropdownOpen]);

  const getCounts = () => {
    return {
      sites: {
        all: ADMIN_SITES.length,
        active: ADMIN_SITES.filter((s) => s.is_active).length,
        inactive: ADMIN_SITES.filter((s) => !s.is_active).length,
      },
      buildings: {
        all: ADMIN_BUILDINGS.length,
        active: ADMIN_BUILDINGS.filter((b) => b.is_active).length,
        inactive: ADMIN_BUILDINGS.filter((b) => !b.is_active).length,
      },
      'collection-points': {
        all: ADMIN_COLLECTION_POINTS.length,
        express: ADMIN_COLLECTION_POINTS.filter((cp) => cp.is_express).length,
        catering: ADMIN_COLLECTION_POINTS.filter((cp) => !cp.is_express).length,
      },
    };
  };

  const counts = useMemo(() => getCounts(), []);

  const filteredSites = useMemo(() => {
    let list = ADMIN_SITES;
    if (statusFilter === 'active') list = list.filter((s) => s.is_active);
    if (statusFilter === 'inactive') list = list.filter((s) => !s.is_active);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((s) => `${s.name} ${s.code} ${s.address}`.toLowerCase().includes(q));
    }
    return list;
  }, [query, statusFilter]);

  const filteredBuildings = useMemo(() => {
    let list = ADMIN_BUILDINGS;
    if (statusFilter === 'active') list = list.filter((b) => b.is_active);
    if (statusFilter === 'inactive') list = list.filter((b) => !b.is_active);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((b) => `${b.name} ${b.code} ${b.site_name} ${b.address}`.toLowerCase().includes(q));
    }
    return list;
  }, [query, statusFilter]);

  const filteredCollectionPoints = useMemo(() => {
    let list = ADMIN_COLLECTION_POINTS;
    if (initialSite !== 'all') {
      list = list.filter((cp) => cp.building_id && ADMIN_BUILDINGS.find((b) => b.id === cp.building_id)?.site_id === initialSite);
    }
    if (statusFilter === 'express') list = list.filter((cp) => cp.is_express);
    if (statusFilter === 'catering') list = list.filter((cp) => !cp.is_express);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((cp) => `${cp.name} ${cp.building_name} ${cp.site_name}`.toLowerCase().includes(q));
    }
    return list;
  }, [query, initialSite, statusFilter]);

  const activeSites = ADMIN_SITES.filter((s) => s.is_active).length;
  const activeBuildings = ADMIN_BUILDINGS.filter((b) => b.is_active).length;
  const activeCollectionPoints = ADMIN_COLLECTION_POINTS.filter((cp) => cp.is_active).length;

  const renderBuildingsFor = (siteId) =>
    ADMIN_BUILDINGS.filter((b) => b.site_id === siteId);

  const totalSitesPages = Math.ceil(filteredSites.length / itemsPerPage);
  const paginatedSites = filteredSites.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalBuildingsPages = Math.ceil(filteredBuildings.length / itemsPerPage);
  const paginatedBuildings = filteredBuildings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalCpPages = Math.ceil(filteredCollectionPoints.length / itemsPerPage);
  const paginatedCp = filteredCollectionPoints.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="admin-orders">
      <header className="admin-vendors__header">
        <div>
          <span className="admin-card__eyebrow">Locations</span>
          <p className="admin-vendors__sub">
            Register and manage the campus sites where food orders are placed, prepared, and collected.
          </p>
        </div>
        <div className="admin-vendors__actions">
          <button type="button" className="admin-action--ghost">
            <IconDownload size={13} stroke={2} />
            Export
          </button>
          <button type="button" className="admin-action--ghost" onClick={() => setShowNew(true)}>
            <IconPlus size={13} stroke={2} />
            New site
          </button>
        </div>
      </header>

      <section className="admin-cafeterias__kpis" aria-label="Location metrics">
        <div className="admin-cafeterias__kpi">
          <div className="admin-cafeterias__kpi-icon">
            <IconMapPin size={24} stroke={1.6} />
          </div>
          <div className="admin-cafeterias__kpi-body">
            <span className="admin-cafeterias__kpi-label">Active sites</span>
            <span className="admin-cafeterias__kpi-value">{activeSites} / {ADMIN_SITES.length}</span>
          </div>
        </div>
        <div className="admin-cafeterias__kpi">
          <div className="admin-cafeterias__kpi-icon">
            <IconBuilding size={24} stroke={1.6} />
          </div>
          <div className="admin-cafeterias__kpi-body">
            <span className="admin-cafeterias__kpi-label">Buildings</span>
            <span className="admin-cafeterias__kpi-value">{activeBuildings}</span>
          </div>
        </div>
        <div className="admin-cafeterias__kpi">
          <div className="admin-cafeterias__kpi-icon">
            <IconClipboardCheck size={24} stroke={1.6} />
          </div>
          <div className="admin-cafeterias__kpi-body">
            <span className="admin-cafeterias__kpi-label">Collection points</span>
            <span className="admin-cafeterias__kpi-value">{activeCollectionPoints}</span>
          </div>
        </div>
        <div className="admin-cafeterias__kpi">
          <div className="admin-cafeterias__kpi-icon">
            <IconClock size={24} stroke={1.6} />
          </div>
          <div className="admin-cafeterias__kpi-body">
            <span className="admin-cafeterias__kpi-label">Inactive</span>
            <span className="admin-cafeterias__kpi-value">
              {ADMIN_SITES.length - activeSites + ADMIN_BUILDINGS.length - activeBuildings + ADMIN_COLLECTION_POINTS.length - activeCollectionPoints}
            </span>
          </div>
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
        {view !== 'collection-points' && (
          <div className="admin-vendors__chips" role="group" aria-label="Status filter">
            {STATUS_FILTERS[view].map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`admin-vendors__chip${statusFilter === filter.id ? ' admin-vendors__chip--active' : ''}`}
                onClick={() => setStatusFilter(filter.id)}
              >
                {filter.label}
                <span className="admin-vendors__chip-count">{counts[view][filter.id]}</span>
              </button>
            ))}
          </div>
        )}
        {view === 'collection-points' && (
          <div className="admin-orders__vendor-select-wrapper">
            <button
              type="button"
              className="admin-orders__vendor-select"
              onClick={() => setSiteDropdownOpen(!siteDropdownOpen)}
              aria-label="Filter by site"
            >
              {ADMIN_SITES.find((s) => s.id === initialSite)?.name || 'All sites'}
              <IconChevronDown size={14} stroke={2} />
            </button>
            {siteDropdownOpen && (
              <div className="admin-orders__vendor-select-dropdown">
                <button
                  type="button"
                  className={`admin-orders__vendor-select-option${initialSite === 'all' ? ' admin-orders__vendor-select-option--active' : ''}`}
                  onClick={() => handleSiteSelect('all')}
                >
                  All sites
                </button>
                {ADMIN_SITES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`admin-orders__vendor-select-option${initialSite === s.id ? ' admin-orders__vendor-select-option--active' : ''}`}
                    onClick={() => handleSiteSelect(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {view === 'sites' && (
        <>
          <div className="admin-site-grid">
            {paginatedSites.map((site) => {
              const buildingCount = renderBuildingsFor(site.id).length;
              const vendorCount = renderBuildingsFor(site.id).reduce((s, b) => s + b.vendor_count, 0);
              const cpCount = renderBuildingsFor(site.id).reduce((s, b) => s + b.collection_point_count, 0);
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
          {totalSitesPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalSitesPages}
              totalItems={filteredSites.length}
              itemsPerPage={itemsPerPage}
              label="sites"
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}

      {view === 'buildings' && (
        <>
          <div className="admin-building-grid">
            {paginatedBuildings.map((b) => (
              <BuildingCard key={b.id} building={b} />
            ))}
          </div>
          {totalBuildingsPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalBuildingsPages}
              totalItems={filteredBuildings.length}
              itemsPerPage={itemsPerPage}
              label="buildings"
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}

      {view === 'collection-points' && (
        <>
          <div className="admin-cp-list">
            {paginatedCp.length > 0 ? (
              <ul className="admin-cp-rows">
                {paginatedCp.map((cp) => (
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
          {totalCpPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalCpPages}
              totalItems={filteredCollectionPoints.length}
              itemsPerPage={itemsPerPage}
              label="collection points"
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}

      {showNew && <NewSiteModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
