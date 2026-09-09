import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IconBuilding, IconBuildingStore, IconCheck, IconChevronLeft, IconClipboardCheck, IconEdit, IconMapPin, IconPlus, IconPower } from '@tabler/icons-react';
import Breadcrumb from '../../components/ui/Breadcrumb.jsx';
import SkeletonTable from '../../components/ui/SkeletonTable.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import {
  createBuilding, createCollectionPoint, createDeliveryLocation, createFloor, getBuilding, getSite, listBuildings, listBuildingVendors, listCollectionPoints, listDeliveryLocations, listFloors, updateBuilding, updateCollectionPoint, updateDeliveryLocation, updateFloor, updateSite, uploadAdminAsset,
} from '../../services/adminApi.js';
import { buildingFields, collectionPointFields, deliveryFields, floorFields, LocationModal, siteFields } from './LocationForms.jsx';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.png';

function StatusPill({ active }) { return <span className={`admin-status admin-status--${active ? 'success' : 'info'}`}>{active ? 'Active' : 'Inactive'}</span>; }

function normalizePayload(payload) {
  const next = { ...payload };
  ['is_active', 'is_express'].forEach((key) => { if (typeof next[key] === 'string') next[key] = next[key] === 'true'; });
  ['latitude', 'longitude', 'level_number'].forEach((key) => { if (next[key] !== '' && next[key] !== undefined) next[key] = Number(next[key]); });
  if (next.floor_id === '') next.floor_id = null;
  return next;
}

function ChildRows({ items, type, onEdit }) {
  if (!items.length) return <p className="admin-vendor-empty-copy">No {type} configured.</p>;
  return <div className="location-child-list">{items.map((item) => <div className="vendor-managed-row" key={item.id}><div><strong>{item.name}</strong><span>{type === 'floors' ? `Level ${item.level_number ?? '—'}` : item.instructions || item.room_or_venue || item.service_status || 'No additional details'}</span></div><div className="vendor-managed-row__actions"><StatusPill active={item.is_active ?? item.location_is_active} />{onEdit && <button type="button" className="admin-action admin-action--ghost" onClick={() => onEdit(item)}>Edit</button>}</div></div>)}</div>;
}

export default function AdminCafeteriaDetail() {
  const { locationId } = useParams();
  const { session } = useAuth();
  const token = session?.access_token;
  const [kind, setKind] = useState(null);
  const [entity, setEntity] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [floors, setFloors] = useState([]);
  const [collectionPoints, setCollectionPoints] = useState([]);
  const [deliveryLocations, setDeliveryLocations] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [mutating, setMutating] = useState(false);

  const load = async () => {
    if (!token || !locationId) return;
    setLoading(true); setError('');
    try {
      const siteResponse = await getSite(token, locationId);
      setKind('site'); setEntity(siteResponse.site);
      const buildingResponse = await listBuildings(token, locationId, { page: 1, limit: 100 });
      const nextBuildings = buildingResponse.buildings || [];
      setBuildings(nextBuildings);
      const children = await Promise.all(nextBuildings.map(async (building) => {
        const [floorsResponse, pointsResponse, vendorsResponse] = await Promise.all([listFloors(token, building.id, { page: 1, limit: 100 }), listCollectionPoints(token, building.id, { page: 1, limit: 100 }), listBuildingVendors(token, building.id)]);
        return { floors: floorsResponse.floors || [], points: pointsResponse.collectionPoints || [], vendors: vendorsResponse.vendors || [] };
      }));
      setFloors(children.flatMap((child) => child.floors)); setCollectionPoints(children.flatMap((child) => child.points)); setDeliveryLocations([]);
      setVendors(children.flatMap((child) => child.vendors));
    } catch (siteError) {
      try {
        const buildingResponse = await getBuilding(token, locationId);
        setKind('building'); setEntity(buildingResponse.building);
        const [floorsResponse, pointsResponse, deliveryResponse] = await Promise.all([listFloors(token, locationId, { page: 1, limit: 100 }), listCollectionPoints(token, locationId, { page: 1, limit: 100 }), listDeliveryLocations(token, locationId, { page: 1, limit: 100 })]);
        const vendorsResponse = await listBuildingVendors(token, locationId);
        setBuildings([]); setFloors(floorsResponse.floors || []); setCollectionPoints(pointsResponse.collectionPoints || []); setDeliveryLocations(deliveryResponse.deliveryLocations || []); setVendors(vendorsResponse.vendors || []);
      } catch (buildingError) { setError(buildingError.message || siteError.message || 'Location could not be loaded.'); }
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [locationId, token]);

  const mutate = async (operation) => { setMutating(true); try { await operation(); setModal(null); await load(); } finally { setMutating(false); } };
  const title = entity?.name || 'Location';
  if (loading) return <div className="admin-vendor-detail"><Breadcrumb homeLabel="Dashboard" homeTo="/admin" items={[{ label: 'Locations', to: '/admin/cafeterias' }, { label: 'Loading...' }]} /><section className="admin-site-hero"><div className="admin-site-hero__cover admin-site-card__cover--plain"><span className="skeleton" style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)' }} /></div><div className="admin-site-hero__info"><div className="admin-site-hero__head"><span className="skeleton skeleton--kpi-value" style={{ width: 80 }} /></div><div className="skeleton skeleton--title" style={{ width: '35%', marginTop: 8 }} /><div className="skeleton skeleton--text" style={{ width: '50%', marginTop: 8 }} /></div></section><section className="admin-vendor-stats"><div className="admin-vendor-stat"><div className="admin-vendor-stat__body"><span className="admin-vendor-stat__label">Buildings</span><span className="admin-vendor-stat__value"><span className="skeleton skeleton--kpi-value" /></span></div></div><div className="admin-vendor-stat"><div className="admin-vendor-stat__body"><span className="admin-vendor-stat__label">Collection points</span><span className="admin-vendor-stat__value"><span className="skeleton skeleton--kpi-value" /></span></div></div><div className="admin-vendor-stat"><div className="admin-vendor-stat__body"><span className="admin-vendor-stat__label">Delivery locations</span><span className="admin-vendor-stat__value"><span className="skeleton skeleton--kpi-value" /></span></div></div><div className="admin-vendor-stat"><div className="admin-vendor-stat__body"><span className="admin-vendor-stat__label">Vendors</span><span className="admin-vendor-stat__value"><span className="skeleton skeleton--kpi-value" /></span></div></div></section><SkeletonTable rows={4} columns={3} /></div>;
  if (!entity || error) return <div className="admin-empty"><img src={emptyStateAvatar} alt="" className="admin-empty__avatar" /><h3>Location not found</h3><p>{error || 'This site or building may have been removed.'}</p><Link to="/admin/cafeterias" className="admin-action--ghost"><IconChevronLeft size={13} /> Back to locations</Link></div>;

  const isSite = kind === 'site';
  const backLink = '/admin/cafeterias';
  return <div className="admin-order-detail">
    <Breadcrumb homeLabel="Dashboard" homeTo="/admin" items={[{ label: 'Locations', to: backLink }, { label: title }]} />
    <section className={`admin-site-hero${!entity.is_active ? ' admin-site-hero--inactive' : ''}`}><div className="admin-site-hero__cover admin-site-card__cover--plain">{entity.cover_image_url ? <img src={entity.cover_image_url} alt={title} /> : isSite ? <IconMapPin size={48} /> : <IconBuilding size={48} />}</div><div className="admin-site-hero__info"><div className="admin-site-hero__head"><span className="admin-vendor-hero__slug">{entity.code || (isSite ? 'SITE' : 'BUILDING')}</span><StatusPill active={entity.is_active} /></div><h2 className="admin-site-hero__name">{title}</h2><p className="admin-site-hero__addr"><IconMapPin size={14} />{entity.address || 'No address recorded'}</p></div><div className="admin-order-hero__actions"><button type="button" className="admin-action--ghost" onClick={() => setModal('edit')}><IconEdit size={14} /> Edit</button><button type="button" className="admin-action--ghost" onClick={() => mutate(() => isSite ? updateSite(token, entity.id, { is_active: !entity.is_active }) : updateBuilding(token, entity.id, { is_active: !entity.is_active }))}>{entity.is_active ? <><IconPower size={14} /> Deactivate</> : <><IconCheck size={14} /> Activate</>}</button>{isSite ? <button type="button" className="admin-action--ghost" onClick={() => setModal('building')}><IconPlus size={14} /> Add building</button> : <button type="button" className="admin-action--ghost" onClick={() => setModal('collection-point')}><IconPlus size={14} /> Add pickup point</button>}</div></section>
    <section className="admin-vendor-stats"><div className="admin-vendor-stat"><span className="admin-vendor-stat__icon"><IconBuilding /></span><div className="admin-vendor-stat__body"><span className="admin-vendor-stat__label">{isSite ? 'Buildings' : 'Floors'}</span><span className="admin-vendor-stat__value">{isSite ? buildings.length : floors.length}</span><span className="admin-vendor-stat__sub">Configured</span></div></div><div className="admin-vendor-stat"><span className="admin-vendor-stat__icon"><IconClipboardCheck /></span><div className="admin-vendor-stat__body"><span className="admin-vendor-stat__label">Collection points</span><span className="admin-vendor-stat__value">{collectionPoints.length}</span><span className="admin-vendor-stat__sub">Configured</span></div></div><div className="admin-vendor-stat"><span className="admin-vendor-stat__icon"><IconMapPin /></span><div className="admin-vendor-stat__body"><span className="admin-vendor-stat__label">Delivery locations</span><span className="admin-vendor-stat__value">{deliveryLocations.length}</span><span className="admin-vendor-stat__sub">Configured</span></div></div><div className="admin-vendor-stat"><span className="admin-vendor-stat__icon"><IconBuildingStore /></span><div className="admin-vendor-stat__body"><span className="admin-vendor-stat__label">Vendors</span><span className="admin-vendor-stat__value">{vendors.length}</span><span className="admin-vendor-stat__sub">Assigned here</span></div></div></section>
    <div className="admin-order-grid"><div className="admin-order-grid__main">
      {isSite ? <section className="admin-card"><header className="admin-card__head"><div><span className="admin-card__eyebrow">Hierarchy</span><h3 className="admin-card__title">Buildings in {entity.name}</h3></div></header>{buildings.length ? <div className="admin-building-grid">{buildings.map((building) => <div key={building.id}><BuildingPreview building={building} /></div>)}</div> : <p className="admin-vendor-empty-copy">No buildings configured.</p>}</section> : <><section className="admin-card"><header className="admin-card__head"><div><span className="admin-card__eyebrow">Floors</span><h3 className="admin-card__title">Floors in {entity.name}</h3></div><button type="button" className="admin-action--ghost" onClick={() => setModal('floor')}><IconPlus size={13} /> Add floor</button></header><ChildRows items={floors} type="floors" onEdit={(item) => setModal({ type: 'floor', item })} /></section><section className="admin-card"><header className="admin-card__head"><div><span className="admin-card__eyebrow">Collection points</span><h3 className="admin-card__title">Pickup locations</h3></div><button type="button" className="admin-action--ghost" onClick={() => setModal('collection-point')}><IconPlus size={13} /> Add pickup point</button></header><ChildRows items={collectionPoints} type="collection points" onEdit={(item) => setModal({ type: 'collection-point', item })} /></section><section className="admin-card"><header className="admin-card__head"><div><span className="admin-card__eyebrow">Delivery locations</span><h3 className="admin-card__title">Delivery destinations</h3></div><button type="button" className="admin-action--ghost" onClick={() => setModal('delivery')}><IconPlus size={13} /> Add delivery location</button></header><ChildRows items={deliveryLocations} type="delivery locations" onEdit={(item) => setModal({ type: 'delivery', item })} /></section></>}
    </div><aside className="admin-order-grid__side"><section className="admin-card"><header className="admin-card__head"><div><span className="admin-card__eyebrow">Profile</span><h3 className="admin-card__title">{isSite ? 'Site details' : 'Building details'}</h3></div></header><div className="admin-vendor-section"><Info label="Code" value={entity.code || '—'} /><Info label="Name" value={entity.name} /><Info label="Address" value={entity.address || '—'} />{isSite && <Info label="Timezone" value={entity.timezone || '—'} />}</div></section><section className="admin-card"><header className="admin-card__head"><div><span className="admin-card__eyebrow">Vendors</span><h3 className="admin-card__title">Operating here</h3></div></header>{vendors.length ? <ChildRows items={vendors} type="vendors" /> : <p className="admin-vendor-empty-copy">No vendors assigned.</p>}</section></aside></div>
    {modal === 'edit' && <LocationModal title={isSite ? 'Edit site' : 'Edit building'} initial={entity} fields={isSite ? siteFields : buildingFields} onClose={() => setModal(null)} onSubmit={(payload) => mutate(async () => { const { cover_file: coverFile, ...entityPayload } = payload; if (isSite) await updateSite(token, entity.id, normalizePayload(entityPayload)); else await updateBuilding(token, entity.id, normalizePayload(entityPayload)); if (coverFile) await uploadAdminAsset(token, isSite ? 'site' : 'building', entity.id, coverFile); })} submitting={mutating} />}
    {modal === 'building' && <LocationModal title="Add building" fields={buildingFields} onClose={() => setModal(null)} onSubmit={(payload) => mutate(() => createBuilding(token, entity.id, normalizePayload(payload)))} submitting={mutating} />}
    {modal === 'floor' && <LocationModal title="Add floor" fields={floorFields} onClose={() => setModal(null)} onSubmit={(payload) => mutate(() => createFloor(token, entity.id, normalizePayload(payload)))} submitting={mutating} />}
    {modal?.type === 'floor' && <LocationModal title="Edit floor" initial={modal.item} fields={floorFields} onClose={() => setModal(null)} onSubmit={(payload) => mutate(() => updateFloor(token, modal.item.id, normalizePayload(payload)))} submitting={mutating} />}
    {modal === 'collection-point' && <LocationModal title="Add collection point" fields={collectionPointFields} onClose={() => setModal(null)} onSubmit={(payload) => mutate(() => createCollectionPoint(token, entity.id, normalizePayload(payload)))} submitting={mutating} />}
    {modal?.type === 'collection-point' && <LocationModal title="Edit collection point" initial={modal.item} fields={collectionPointFields} onClose={() => setModal(null)} onSubmit={(payload) => mutate(() => updateCollectionPoint(token, modal.item.id, normalizePayload(payload)))} submitting={mutating} />}
    {modal === 'delivery' && <LocationModal title="Add delivery location" fields={deliveryFields} onClose={() => setModal(null)} onSubmit={(payload) => mutate(() => createDeliveryLocation(token, entity.id, normalizePayload(payload)))} submitting={mutating} />}
    {modal?.type === 'delivery' && <LocationModal title="Edit delivery location" initial={modal.item} fields={deliveryFields} onClose={() => setModal(null)} onSubmit={(payload) => mutate(() => updateDeliveryLocation(token, modal.item.id, normalizePayload(payload)))} submitting={mutating} />}
  </div>;
}

function Info({ label, value }) { return <div className="admin-vendor-info-row"><span className="admin-vendor-info-row__label">{label}</span><span className="admin-vendor-info-row__value">{value}</span></div>; }
function BuildingPreview({ building }) { return <Link to={`/admin/cafeterias/${building.id}`} className="admin-building-card"><div className="admin-building-card__media">{building.cover_image_url ? <img src={building.cover_image_url} alt={building.name} /> : <div className="admin-building-card__placeholder"><IconBuilding size={22} /></div>}</div><div className="admin-building-card__body"><div className="admin-building-card__head"><span className="admin-building-card__code">{building.code || 'BUILDING'}</span><StatusPill active={building.is_active} /></div><h4 className="admin-building-card__name">{building.name}</h4><p className="admin-building-card__site"><IconMapPin size={10} />{building.address || 'No address recorded'}</p><div className="admin-building-card__stats"><span><strong>{building.floor_count || 0}</strong> floors</span><span><strong>{building.collection_point_count || 0}</strong> pickup</span></div></div></Link>; }
