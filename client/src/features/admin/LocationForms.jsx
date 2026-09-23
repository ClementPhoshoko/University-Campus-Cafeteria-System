import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import AddressAutocomplete from '../../components/ui/AddressAutocomplete.jsx';
import AdminDropdown from '../../components/ui/AdminDropdown.jsx';
import { IconBuilding, IconUpload } from '@tabler/icons-react';
import ModalProgressOverlay from './ModalProgressOverlay.jsx';

function Field({ label, children, full = false, renderLabel = true }) {
  return <label className={`admin-modal__field${full ? ' admin-modal__field--full' : ''}`}>{renderLabel && <span>{label}</span>}{children}</label>;
}

const roundCoord = (value) => (value === undefined || value === null || value === '' ? value : Number(Number(value).toFixed(6)));

export function LocationModal({ title, initial = {}, fields, rows, onClose, onSubmit, submitting }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(initial.cover_image_url || '');
  const { session } = useAuth();
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const resolvedFields = typeof fields === 'function' ? fields(form) : fields;

  const handleAddressSelect = (locationData) => {
    setForm((prev) => ({
      ...prev,
      address: locationData.formatted_address || prev.address,
      street_address: locationData.street_address || prev.street_address,
      city: locationData.city || prev.city,
      province: locationData.province || prev.province,
      postal_code: locationData.postal_code || prev.postal_code,
      country: locationData.country_code || prev.country,
      place_id: locationData.place_id || prev.place_id,
      latitude: roundCoord(locationData.latitude),
      longitude: roundCoord(locationData.longitude),
      timezone: locationData.timezone || prev.timezone,
    }));
  };

  const submit = async () => { try { await onSubmit(form); onClose(); } catch (err) { setError(err.message || 'Could not save changes.'); } };

  const fileFields = resolvedFields.filter((f) => f.type === 'file');
  const otherFields = resolvedFields.filter((f) => f.type !== 'file');
  const leftFields = otherFields.filter((f) => f.col !== 'right');
  const rightFields = otherFields.filter((f) => f.col === 'right');
  const hasRightColumn = fileFields.length > 0 || rightFields.length > 0;

  const renderField = (field) => {
    if (field.type === 'address') {
      return <AddressAutocomplete value={form[field.key] || ''} onChange={(val) => update(field.key, val)} onSelect={handleAddressSelect} token={session?.access_token} placeholder="Search for an address..." />;
    }
    if (field.type === 'textarea') {
      return <textarea className="admin-modal__textarea" rows={3} value={form[field.key] || ''} onChange={(e) => update(field.key, e.target.value)} />;
    }
    if (field.type === 'select') {
      return <AdminDropdown label={field.label} options={field.options} value={form[field.key] ?? ''} onChange={(val) => update(field.key, val)} placeholder={field.placeholder || 'Select...'} loading={field.loading} />;
    }
    return <input className="admin-input" type={field.type || 'text'} step={field.type === 'number' ? 'any' : undefined} placeholder={field.placeholder || ''} value={form[field.key] ?? ''} onChange={(e) => update(field.key, e.target.value)} />;
  };

  return <div className="admin-modal" role="dialog" aria-modal="true"><div className="admin-modal__overlay" onClick={onClose} /><div className="admin-modal__card admin-modal__card--lg"><header className="admin-modal__head"><div><h3 className="admin-modal__title">{title}</h3><p className="admin-modal__sub">Update the location data stored by the platform.</p></div></header>{error && <div className="vendor-form-error">{error}</div>}<div className="admin-modal__body{(hasRightColumn ? '' : ' admin-modal__body--single')}"><div className="admin-modal__left">{(rows && rows.length ? rows.map((group) => { const rowFields = group.map((key) => leftFields.find((f) => f.key === key)).filter(Boolean); return rowFields.length === 1 ? <Field key={rowFields[0].key} label={rowFields[0].label} renderLabel={rowFields[0].type !== 'select'}>{renderField(rowFields[0])}</Field> : <div className="admin-modal__row" key={group.join('-')}>{rowFields.map((field) => <Field key={field.key} label={field.label} renderLabel={field.type !== 'select'}>{renderField(field)}</Field>)}</div>; }) : leftFields.map((field) => <Field key={field.key} label={field.label} full={field.full} renderLabel={field.type !== 'select'}>{renderField(field)}</Field>))}</div>{hasRightColumn && <div className="admin-modal__right">{fileFields.length > 0 ? fileFields.map((field) => <Field key={field.key} label={field.label} full><div className={`admin-modal__image-area admin-modal__image-area--sm${preview ? ' admin-modal__image-area--has-image' : ''}`}>{preview ? <img src={preview} alt="Cover preview" /> : <><IconUpload size={24} stroke={1.5} className="admin-modal__image-icon" /><span className="admin-modal__image-text">Click to upload cover image</span><span className="admin-modal__image-hint">JPEG, PNG or WebP</span></>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0] || null; update(field.key, file); setPreview(file ? URL.createObjectURL(file) : (initial.cover_image_url || '')); }} /></div></Field>) : rightFields.map((field) => <Field key={field.key} label={field.label} full={field.full} renderLabel={field.type !== 'select'}>{renderField(field)}</Field>)}</div>}</div><footer className="admin-modal__foot"><button type="button" className="admin-action" onClick={onClose}>Cancel</button><button type="button" className="admin-action admin-action--approve" onClick={submit} disabled={submitting}>{submitting ? 'Saving…' : 'Save changes'}</button></footer></div><ModalProgressOverlay active={submitting} messages={['Saving your changes...', 'Updating platform records...', 'Almost there...']} /></div>;
}

export function BuildingModal({ initial = {}, onClose, onSubmit, submitting }) {
  const editing = !!initial?.id;
  const [form, setForm] = useState(() => ({
    name: initial.name || '',
    code: initial.code || '',
    address: initial.address || '',
    street_address: initial.street_address || '',
    city: initial.city || '',
    province: initial.province || '',
    postal_code: initial.postal_code || '',
    country: initial.country || 'ZA',
    place_id: initial.place_id || '',
    latitude: initial.latitude ?? '',
    longitude: initial.longitude ?? '',
    is_active: initial.is_active ?? true,
    cover_file: null,
  }));
  const [preview, setPreview] = useState(initial.cover_image_url || '');
  const [error, setError] = useState('');
  const { session } = useAuth();
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleAddressSelect = (locationData) => {
    setForm((prev) => ({
      ...prev,
      address: locationData.formatted_address || prev.address,
      street_address: locationData.street_address || prev.street_address,
      city: locationData.city || prev.city,
      province: locationData.province || prev.province,
      postal_code: locationData.postal_code || prev.postal_code,
      country: locationData.country_code || prev.country,
      place_id: locationData.place_id || prev.place_id,
      latitude: roundCoord(locationData.latitude),
      longitude: roundCoord(locationData.longitude),
    }));
  };

  const submit = async () => {
    if (!form.name.trim()) return setError('Building name is required.');
    setError('');
    try {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        latitude: form.latitude === '' ? undefined : roundCoord(Number(form.latitude)),
        longitude: form.longitude === '' ? undefined : roundCoord(Number(form.longitude)),
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'Could not save the building.');
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return <div className="admin-modal" role="dialog" aria-modal="true">
    <div className="admin-modal__overlay" onClick={onClose} />
    <div className="admin-modal__card admin-modal__card--lg">
      <header className="admin-modal__head">
        <div className="admin-modal__icon admin-modal__icon--info"><IconBuilding size={20} /></div>
        <div>
          <h3 className="admin-modal__title">{editing ? 'Edit building' : 'Add building'}</h3>
          <p className="admin-modal__sub">{editing ? 'Update the building information and cover image.' : 'Add a building to this site to manage pickup and delivery points.'}</p>
        </div>
      </header>
      {error && <div className="vendor-form-error">{error}</div>}
      <div className="admin-modal__body">
        <div className="admin-modal__left">
          <div className="admin-modal__row">
            <Field label="Building name"><input autoFocus className="admin-input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Merchant Riverside Building" /></Field>
            <Field label="Building code"><input className="admin-input" value={form.code} onChange={(e) => update('code', e.target.value)} placeholder="MP-RIVERSIDE-B1" /></Field>
          </div>
          <Field label="Search address"><AddressAutocomplete value={form.address} onChange={(val) => update('address', val)} onSelect={handleAddressSelect} token={session?.access_token} placeholder="Search for an address..." /></Field>
          <div className="admin-modal__row">
            <Field label="Street address"><input className="admin-input" value={form.street_address} onChange={(e) => update('street_address', e.target.value)} placeholder="Auto-filled from search" /></Field>
            <Field label="City"><input className="admin-input" value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Auto-filled from search" /></Field>
          </div>
          <div className="admin-modal__row">
            <Field label="Province"><input className="admin-input" value={form.province} onChange={(e) => update('province', e.target.value)} placeholder="Auto-filled from search" /></Field>
            <Field label="Postal code"><input className="admin-input" value={form.postal_code} onChange={(e) => update('postal_code', e.target.value)} placeholder="Auto-filled from search" /></Field>
          </div>
          <div className="admin-modal__row">
            <Field label="Country"><input className="admin-input" value={form.country} onChange={(e) => update('country', e.target.value)} placeholder="ZA" /></Field>
            <Field label="Status"><AdminDropdown label="Status" options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} value={form.is_active ?? ''} onChange={(val) => update('is_active', val)} placeholder="Select..." /></Field>
          </div>
        </div>
        <div className="admin-modal__right">
          <Field label="Cover image" full>
            <div className={`admin-modal__image-area admin-modal__image-area--sm${preview ? ' admin-modal__image-area--has-image' : ''}`}>
              {preview ? <img src={preview} alt="Cover preview" /> : <><IconUpload size={24} stroke={1.5} className="admin-modal__image-icon" /><span className="admin-modal__image-text">Click to upload cover image</span><span className="admin-modal__image-hint">JPEG, PNG or WebP</span></>}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0] || null; update('cover_file', file); setPreview(file ? URL.createObjectURL(file) : (initial.cover_image_url || '')); }} />
            </div>
          </Field>
        </div>
      </div>
      <footer className="admin-modal__foot">
        <button type="button" className="admin-action" onClick={onClose}>Cancel</button>
        <button type="button" className="admin-action admin-action--approve" onClick={submit} disabled={submitting}>{submitting ? 'Saving…' : 'Save changes'}</button>
      </footer>
    </div>
    <ModalProgressOverlay active={submitting} messages={editing ? ['Updating building details...', 'Saving your changes...', 'Almost there...'] : ['Creating this building...', 'Configuring location details...', 'Almost there...']} />
  </div>;
}

export const siteFields = [
  { key: 'name', label: 'Site name' },
  { key: 'code', label: 'Site code' },
  { key: 'address', label: 'Search address', type: 'address', full: true },
  { key: 'street_address', label: 'Street address' },
  { key: 'city', label: 'City' },
  { key: 'province', label: 'Province' },
  { key: 'postal_code', label: 'Postal code' },
  { key: 'country', label: 'Country' },
  { key: 'latitude', label: 'Latitude', type: 'number' },
  { key: 'longitude', label: 'Longitude', type: 'number' },
  { key: 'timezone', label: 'Timezone' },
  { key: 'is_active', label: 'Status', type: 'select', options: [{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }] },
  { key: 'cover_file', label: 'Cover image', type: 'file' },
];

export const buildingFields = [
  { key: 'name', label: 'Building name' },
  { key: 'code', label: 'Building code' },
  { key: 'address', label: 'Search address', type: 'address', full: true },
  { key: 'street_address', label: 'Street address', placeholder: 'Auto-filled from search' },
  { key: 'city', label: 'City', placeholder: 'Auto-filled from search' },
  { key: 'province', label: 'Province', placeholder: 'Auto-filled from search' },
  { key: 'postal_code', label: 'Postal code', placeholder: 'Auto-filled from search' },
  { key: 'country', label: 'Country', placeholder: 'Auto-filled from search' },
  { key: 'is_active', label: 'Status', type: 'select', options: [{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }] },
  { key: 'cover_file', label: 'Cover image', type: 'file' },
];

export const buildingFieldRows = [
  ['name', 'code'],
  ['address'],
  ['street_address', 'city'],
  ['province', 'postal_code'],
  ['country', 'is_active'],
];

export const newBuildingDefaults = {
  name: '',
  code: '',
  address: '',
  street_address: '',
  city: '',
  province: '',
  postal_code: '',
  country: 'ZA',
  place_id: '',
  latitude: '',
  longitude: '',
  is_active: true,
  cover_file: null,
};

export const floorFields = [
  { key: 'name', label: 'Floor name' }, { key: 'level_number', label: 'Level number', type: 'number' },
  { key: 'is_active', label: 'Status', type: 'select', options: [{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }] },
];

function floorOptions(floors) {
  return [
    { value: '', label: 'None (unassigned)' },
    ...floors.map((f) => ({ value: f.id, label: f.name + (f.level_number != null ? ` — Level ${f.level_number}` : '') })),
  ];
}

function buildingOptions(buildings) {
  return [
    { value: '', label: 'Select a building' },
    ...buildings.map((b) => ({ value: b.id, label: b.site_name ? `${b.name} (${b.site_name})` : b.name })),
  ];
}

export function collectionPointFields(floors = [], buildings = [], floorsByBuilding = {}, selectedBuildingId = '') {
  const availableFloors = selectedBuildingId ? (floorsByBuilding[selectedBuildingId] || []) : floors;
  return [
    { key: 'building_id', label: 'Building', type: 'select', options: buildingOptions(buildings) },
    { key: 'name', label: 'Collection point name' },
    { key: 'floor_id', label: 'Floor', type: 'select', options: floorOptions(availableFloors), col: 'right' },
    { key: 'instructions', label: 'Instructions', type: 'textarea', col: 'right' },
    { key: 'is_express', label: 'Type', type: 'select', options: [{ value: true, label: 'Express' }, { value: false, label: 'Catering' }] },
    { key: 'is_active', label: 'Status', type: 'select', options: [{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }], col: 'right' },
  ];
}

export function deliveryFields(floors = []) {
  return [
    { key: 'name', label: 'Delivery location name' },
    { key: 'floor_id', label: 'Floor', type: 'select', options: floorOptions(floors) },
    { key: 'room_or_venue', label: 'Room or venue', full: true },
    { key: 'instructions', label: 'Instructions', type: 'textarea', full: true },
    { key: 'is_active', label: 'Status', type: 'select', options: [{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }] },
  ];
}
