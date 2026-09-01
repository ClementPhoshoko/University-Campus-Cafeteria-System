import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  IconChevronLeft,
  IconMapPin,
  IconBuilding,
  IconBuildingStore,
  IconClipboardCheck,
  IconCheck,
  IconPower,
  IconEdit,
  IconPlus,
  IconClock,
  IconUsers,
  IconReceipt,
  IconInfoCircle,
} from '@tabler/icons-react';
import {
  ADMIN_SITES,
  ADMIN_BUILDINGS,
  ADMIN_COLLECTION_POINTS,
  ACTIVE_VENDORS,
  formatCurrency,
} from './adminMockData.js';

function StatusPill({ active }) {
  return (
    <span className={`admin-status admin-status--${active ? 'success' : 'info'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="admin-vendor-info-row">
      <span className="admin-vendor-info-row__icon">
        <Icon size={14} stroke={1.8} />
      </span>
      <div className="admin-vendor-info-row__text">
        <span className="admin-vendor-info-row__label">{label}</span>
        <span className="admin-vendor-info-row__value">{value}</span>
      </div>
    </div>
  );
}

function VendorMiniRow({ vendor }) {
  return (
    <li className="admin-cp-vendor">
      <span className="admin-cp-vendor__logo">
        <img src={vendor.logo_url} alt="" />
      </span>
      <div className="admin-cp-vendor__body">
        <Link to={`/admin/vendors/${vendor.id}`} className="admin-cp-vendor__name">
          {vendor.name}
        </Link>
        <span className="admin-cp-vendor__cats">{vendor.categories.join(' · ')}</span>
      </div>
      <div className="admin-cp-vendor__meta">
        <StatusPill active={vendor.service_status === 'open'} />
        <span>{vendor.orders_today} orders today</span>
      </div>
    </li>
  );
}

function BuildingRow({ building, vendors, collectionPoints }) {
  return (
    <li className="admin-cp-building">
      <div className="admin-cp-building__head">
        <span className="admin-cp-building__icon">
          {building.images?.length > 0 ? (
            <img src={building.images[0]} alt="" />
          ) : (
            <IconBuilding size={22} stroke={1.4} />
          )}
        </span>
        <div className="admin-cp-building__id">
          <Link to={`/admin/cafeterias/${building.id}`} className="admin-cp-building__name">
            {building.name}
          </Link>
          <span className="admin-cp-building__code">{building.code}</span>
        </div>
        <StatusPill active={building.is_active} />
      </div>
      <p className="admin-cp-building__address">
        <IconMapPin size={12} stroke={1.8} /> {building.address}
      </p>
      <div className="admin-cp-building__stats">
        <span><strong>{building.floor_count}</strong> floors</span>
        <span><strong>{collectionPoints.length}</strong> pickup</span>
        <span><strong>{vendors.length}</strong> vendors</span>
        <span><strong>{building.orders_today}</strong> orders today</span>
      </div>

      {vendors.length > 0 && (
        <div className="admin-cp-building__vendors">
          <span className="admin-vendor-section__heading">
            <IconBuildingStore size={13} stroke={1.8} /> Active vendors
          </span>
          <ul className="admin-cp-vendor-list">
            {vendors.map((v) => (
              <VendorMiniRow key={v.id} vendor={v} />
            ))}
          </ul>
        </div>
      )}

      {collectionPoints.length > 0 && (
        <div className="admin-cp-building__cps">
          <span className="admin-vendor-section__heading">
            <IconClipboardCheck size={13} stroke={1.8} /> Collection points ({collectionPoints.length})
          </span>
          <ul className="admin-cp-points">
            {collectionPoints.map((cp) => (
              <li key={cp.id} className="admin-cp-mini">
                <div className="admin-cp-mini__head">
                  <span className="admin-cp-mini__name">{cp.name}</span>
                  <span className={`admin-cp-mini__express${cp.is_express ? ' admin-cp-mini__express--yes' : ' admin-cp-mini__express--no'}`}>
                    {cp.is_express ? 'Express' : 'Catering'}
                  </span>
                </div>
                <span className="admin-cp-mini__instr">{cp.instructions}</span>
                <div className="admin-cp-mini__meta">
                  <span><strong>{cp.orders_today}</strong> orders today</span>
                  <span><strong>{cp.avg_pickup_minutes ? `${cp.avg_pickup_minutes} min` : '—'}</strong> avg pickup</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function BuildingDetail({ building }) {
  // ... handled in render
}

export default function AdminCafeteriaDetail() {
  const { locationId } = useParams();

  const { kind, entity } = useMemo(() => {
    const site = ADMIN_SITES.find((s) => s.id === locationId);
    if (site) return { kind: 'site', entity: site };
    const building = ADMIN_BUILDINGS.find((b) => b.id === locationId);
    if (building) return { kind: 'building', entity: building };
    return { kind: 'unknown', entity: null };
  }, [locationId]);

  if (!entity) {
    return (
      <div className="admin-empty">
        <IconMapPin size={32} stroke={1.4} />
        <h3>Location not found</h3>
        <p>This site or building may have been removed.</p>
        <Link to="/admin/cafeterias" className="admin-action admin-action--approve">
          <IconChevronLeft size={13} stroke={2} />
          Back to locations
        </Link>
      </div>
    );
  }

  const backLink = `/admin/cafeterias${kind === 'building' && entity.site_id ? `?site=${entity.site_id}` : ''}`;

  if (kind === 'site') {
    const site = entity;
    const buildings = ADMIN_BUILDINGS.filter((b) => b.site_id === site.id);
    const buildingIds = buildings.map((b) => b.id);
    const cps = ADMIN_COLLECTION_POINTS.filter((cp) => buildingIds.includes(cp.building_id));
    const vendorIds = new Set();
    cps.forEach((cp) => {
      // attach all vendors that operate at this building
      ACTIVE_VENDORS
        .filter((v) => buildings.some((b) => b.id === buildingIds.find((bid) => bid === cp.building_id)))
        .forEach((v) => vendorIds.add(v.id));
    });
    // All vendors whose vendorId matches any buildings in this site (matches by id string)
    const siteVendors = ACTIVE_VENDORS.filter((v) =>
      buildings.some((b) => b.id === v.vendor_location_id)
    );

    return (
      <div className="admin-order-detail">
        <Link to="/admin/cafeterias" className="admin-back-link">
          <IconChevronLeft size={14} stroke={2} />
          Back to locations
        </Link>

        {/* Hero */}
        <section className={`admin-site-hero${!site.is_active ? ' admin-site-hero--inactive' : ''}`}>
          <div className="admin-site-hero__cover">
            <img src={site.image} alt="" />
          </div>
          <div className="admin-site-hero__info">
            <div className="admin-site-hero__head">
              <span className="admin-vendor-hero__slug">{site.code}</span>
              <StatusPill active={site.is_active} />
            </div>
            <h2 className="admin-site-hero__name">{site.name}</h2>
            <p className="admin-site-hero__addr">
              <IconMapPin size={14} stroke={1.8} />
              {site.address}
            </p>
            <div className="admin-site-hero__tags">
              <span className="admin-tag">{site.timezone}</span>
              <span className="admin-tag admin-tag--blue">
                {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
              </span>
              <span className="admin-tag">Joined {site.created_at}</span>
            </div>
          </div>
          <div className="admin-order-hero__actions">
            <button type="button" className="admin-action">
              <IconEdit size={14} stroke={2} />
              Edit
            </button>
            {site.is_active ? (
              <button type="button" className="admin-action admin-action--reject">
                <IconPower size={14} stroke={2} />
                Deactivate
              </button>
            ) : (
              <button type="button" className="admin-action admin-action--approve">
                <IconCheck size={14} stroke={2} />
                Activate
              </button>
            )}
            <button type="button" className="admin-action admin-action--approve">
              <IconPlus size={14} stroke={2} />
              Add building
            </button>
          </div>
        </section>

        {/* Stats */}
        <section className="admin-vendor-stats">
          <div className="admin-vendor-stat">
            <span className="admin-vendor-stat__icon"><IconBuilding size={16} stroke={1.8} /></span>
            <div className="admin-vendor-stat__body">
              <span className="admin-vendor-stat__label">Buildings</span>
              <span className="admin-vendor-stat__value">{buildings.length}</span>
              <span className="admin-vendor-stat__sub">{buildings.filter((b) => b.is_active).length} active</span>
            </div>
          </div>
          <div className="admin-vendor-stat">
            <span className="admin-vendor-stat__icon"><IconBuildingStore size={16} stroke={1.8} /></span>
            <div className="admin-vendor-stat__body">
              <span className="admin-vendor-stat__label">Vendors</span>
              <span className="admin-vendor-stat__value">{siteVendors.length}</span>
              <span className="admin-vendor-stat__sub">{siteVendors.filter((v) => v.service_status === 'open').length} open now</span>
            </div>
          </div>
          <div className="admin-vendor-stat">
            <span className="admin-vendor-stat__icon"><IconClipboardCheck size={16} stroke={1.8} /></span>
            <div className="admin-vendor-stat__body">
              <span className="admin-vendor-stat__label">Pickup points</span>
              <span className="admin-vendor-stat__value">{cps.length}</span>
              <span className="admin-vendor-stat__sub">{cps.filter((cp) => cp.is_active).length} active</span>
            </div>
          </div>
          <div className="admin-vendor-stat">
            <span className="admin-vendor-stat__icon"><IconReceipt size={16} stroke={1.8} /></span>
            <div className="admin-vendor-stat__body">
              <span className="admin-vendor-stat__label">30-day revenue</span>
              <span className="admin-vendor-stat__value">{formatCurrency(site.order_volume_30d)}</span>
              <span className="admin-vendor-stat__sub">{site.orders_today} orders today</span>
            </div>
          </div>
        </section>

        <div className="admin-order-grid">
          <div className="admin-order-grid__main">
            <section className="admin-card">
              <header className="admin-card__head">
                <div>
                  <span className="admin-card__eyebrow">Hierarchy</span>
                  <h3 className="admin-card__title">Buildings in {site.name}</h3>
                </div>
                <span className="admin-card__chip">{buildings.length} total</span>
              </header>
              <ul className="admin-cp-building-list">
                {buildings.map((b) => (
                  <BuildingRow
                    key={b.id}
                    building={b}
                    vendors={ACTIVE_VENDORS.filter((v) => v.vendorId === b.id)}
                    collectionPoints={ADMIN_COLLECTION_POINTS.filter((cp) => cp.building_id === b.id)}
                  />
                ))}
              </ul>
            </section>
          </div>

          <div className="admin-order-grid__side">
            <section className="admin-card">
              <header className="admin-card__head">
                <div>
                  <span className="admin-card__eyebrow">Profile</span>
                  <h3 className="admin-card__title">Site details</h3>
                </div>
              </header>

              <div className="admin-vendor-section">
                <h4 className="admin-vendor-section__heading">Identity</h4>
                <InfoRow icon={IconMapPin} label="Site code" value={site.code} />
                <InfoRow icon={IconMapPin} label="Site name" value={site.name} />
                <InfoRow icon={IconClock} label="Timezone" value={site.timezone} />
                <InfoRow icon={IconUsers} label="Registered" value={site.created_at} />
              </div>

              <div className="admin-vendor-section">
                <h4 className="admin-vendor-section__heading">Coordinates</h4>
                <InfoRow icon={IconMapPin} label="Latitude" value={site.latitude.toFixed(6)} />
                <InfoRow icon={IconMapPin} label="Longitude" value={site.longitude.toFixed(6)} />
                <InfoRow icon={IconInfoCircle} label="Geofence radius" value="75 m" />
              </div>
            </section>

            <section className="admin-card">
              <header className="admin-card__head">
                <div>
                  <span className="admin-card__eyebrow">Pilot config</span>
                  <h3 className="admin-card__title">Feature flags</h3>
                </div>
              </header>
              <ul className="admin-feature-flags">
                <li>
                  <span>Express pickup</span>
                  <span className="admin-status admin-status--success">
                    <IconCheck size={11} stroke={2.5} /> On
                  </span>
                </li>
                <li>
                  <span>Corporate catering</span>
                  <span className={`admin-status ${site.id !== 'site-pilot-sandton' ? 'admin-status--success' : 'admin-status--info'}`}>
                    <IconCheck size={11} stroke={2.5} /> {site.id !== 'site-pilot-sandton' ? 'On' : 'Off'}
                  </span>
                </li>
                <li>
                  <span>Subsidy / meal benefits</span>
                  <span className="admin-status admin-status--success">
                    <IconCheck size={11} stroke={2.5} /> On
                  </span>
                </li>
                <li>
                  <span>Real-time slots</span>
                  <span className="admin-status admin-status--success">
                    <IconCheck size={11} stroke={2.5} /> On
                  </span>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // Building detail
  const building = entity;
  const cps = ADMIN_COLLECTION_POINTS.filter((cp) => cp.building_id === building.id);
  const vendors = ACTIVE_VENDORS.filter((v) => v.vendor_location_id === building.id);

  return (
    <div className="admin-order-detail">
      <Link to="/admin/cafeterias" className="admin-back-link">
        <IconChevronLeft size={14} stroke={2} />
        Back to locations
      </Link>

      <section className={`admin-site-hero${!building.is_active ? ' admin-site-hero--inactive' : ''}`}>
        <div className="admin-site-hero__cover">
          {building.images?.length > 0 ? (
            <img src={building.images[0]} alt="" />
          ) : (
            <div className="admin-site-hero__placeholder">
              <IconBuilding size={64} stroke={1.4} />
            </div>
          )}
        </div>
        <div className="admin-site-hero__info">
          <div className="admin-site-hero__head">
            <span className="admin-vendor-hero__slug">{building.code} · {building.site_name}</span>
            <StatusPill active={building.is_active} />
          </div>
          <h2 className="admin-site-hero__name">{building.name}</h2>
          <p className="admin-site-hero__addr">
            <IconMapPin size={14} stroke={1.8} />
            {building.address}
          </p>
        </div>
        <div className="admin-order-hero__actions">
          <button type="button" className="admin-action">
            <IconEdit size={14} stroke={2} />
            Edit
          </button>
          <button type="button" className="admin-action admin-action--approve">
            <IconPlus size={14} stroke={2} />
            Add pickup point
          </button>
        </div>
      </section>

      <section className="admin-vendor-stats">
        <div className="admin-vendor-stat">
          <span className="admin-vendor-stat__icon"><IconBuilding size={16} stroke={1.8} /></span>
          <div className="admin-vendor-stat__body">
            <span className="admin-vendor-stat__label">Floors</span>
            <span className="admin-vendor-stat__value">{building.floor_count}</span>
            <span className="admin-vendor-stat__sub">{building.floor_count - 1} occupied</span>
          </div>
        </div>
        <div className="admin-vendor-stat">
          <span className="admin-vendor-stat__icon"><IconBuildingStore size={16} stroke={1.8} /></span>
          <div className="admin-vendor-stat__body">
            <span className="admin-vendor-stat__label">Vendors</span>
            <span className="admin-vendor-stat__value">{vendors.length}</span>
              <span className="admin-vendor-stat__sub">{vendors.filter((v) => v.service_status === 'open').length} open now</span>
          </div>
        </div>
        <div className="admin-vendor-stat">
          <span className="admin-vendor-stat__icon"><IconClipboardCheck size={16} stroke={1.8} /></span>
          <div className="admin-vendor-stat__body">
            <span className="admin-vendor-stat__label">Pickup points</span>
            <span className="admin-vendor-stat__value">{cps.length}</span>
              <span className="admin-vendor-stat__sub">{cps.filter((cp) => cp.is_active).length} active</span>
          </div>
        </div>
        <div className="admin-vendor-stat">
          <span className="admin-vendor-stat__icon"><IconReceipt size={16} stroke={1.8} /></span>
          <div className="admin-vendor-stat__body">
            <span className="admin-vendor-stat__label">30-day volume</span>
              <span className="admin-vendor-stat__value">{building.orders_today * 30}</span>
              <span className="admin-vendor-stat__sub">{building.orders_today} orders today</span>
          </div>
        </div>
      </section>

      <div className="admin-order-grid">
        <div className="admin-order-grid__main">
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Collection points</span>
                <h3 className="admin-card__title">Pickup locations in {building.name}</h3>
              </div>
              <span className="admin-card__chip">{cps.length} configured</span>
            </header>
            {cps.length > 0 ? (
              <ul className="admin-cp-rows">
                {cps.map((cp) => (
                  <li key={cp.id} className="admin-cp-row">
                    <div className="admin-cp-row__icon">
                      <IconClipboardCheck size={18} stroke={1.8} />
                    </div>
                    <div className="admin-cp-row__body">
                      <div className="admin-cp-row__head">
                        <span className="admin-cp-row__name">{cp.name}</span>
                        <span className={`admin-cp-row__express${cp.is_express ? ' admin-cp-row__express--yes' : ' admin-cp-row__express--no'}`}>
                          {cp.is_express ? 'Express' : 'Catering'}
                        </span>
                      </div>
                      <p className="admin-cp-row__instr">{cp.instructions}</p>
                    </div>
                    <div className="admin-cp-row__meta">
                      <span className="admin-cp-row__stat">
                        <strong>{cp.orders_today}</strong>
                        <small>orders today</small>
                      </span>
                      <span className="admin-cp-row__stat">
                        <strong>{cp.avg_pickup_minutes ? `${cp.avg_pickup_minutes} min` : '—'}</strong>
                        <small>avg pickup</small>
                      </span>
                      <StatusPill active={cp.is_active} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="admin-empty">
                <IconClipboardCheck size={32} stroke={1.4} />
                <h3>No pickup points yet</h3>
                <p>Add a collection point so customers know where to collect their orders.</p>
                <button type="button" className="admin-action admin-action--approve">
                  <IconPlus size={13} stroke={2} /> Add pickup point
                </button>
              </div>
            )}
          </section>

          {vendors.length > 0 && (
            <section className="admin-card">
              <header className="admin-card__head">
                <div>
                  <span className="admin-card__eyebrow">Tenants</span>
                  <h3 className="admin-card__title">Vendors operating here</h3>
                </div>
                <span className="admin-card__chip">{vendors.length} vendors</span>
              </header>
              <ul className="admin-cp-vendor-list">
                {vendors.map((v) => <VendorMiniRow key={v.id} vendor={v} />)}
              </ul>
            </section>
          )}
        </div>

        <div className="admin-order-grid__side">
          <section className="admin-card">
            <header className="admin-card__head">
              <div>
                <span className="admin-card__eyebrow">Profile</span>
                <h3 className="admin-card__title">Building details</h3>
              </div>
            </header>

            <div className="admin-vendor-section">
              <h4 className="admin-vendor-section__heading">Identity</h4>
              <InfoRow icon={IconBuilding} label="Building code" value={building.code} />
              <InfoRow icon={IconBuilding} label="Building name" value={building.name} />
              <InfoRow icon={IconMapPin} label="Site" value={building.site_name} />
              <InfoRow icon={IconMapPin} label="Address" value={building.address} />
            </div>

            <div className="admin-vendor-section">
              <h4 className="admin-vendor-section__heading">Capacity</h4>
              <InfoRow icon={IconBuilding} label="Floors" value={building.floor_count} />
              <InfoRow icon={IconBuildingStore} label="Vendor tenants" value={vendors.length} />
              <InfoRow icon={IconClipboardCheck} label="Pickup points" value={cps.length} />
              <InfoRow icon={IconReceipt} label="Daily orders" value={building.orders_today} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
