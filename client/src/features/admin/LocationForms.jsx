import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import AddressAutocomplete from '../../components/ui/AddressAutocomplete.jsx';
import { FileInput } from './AdminCafeteriaList.jsx';
import { IconUpload } from '@tabler/icons-react';

function Field({ label, children, full = false }) {
  return <label className={`admin-modal__field${full ? ' admin-modal__field--full' : ''}`}><span>{label}</span>{children}</label>;
}

export function LocationModal({ title, initial = {}, fields, onClose, onSubmit, submitting }) {
  const [form, setForm] = useState(initial);
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
      latitude: locationData.latitude ?? prev.latitude,
      longitude: locationData.longitude ?? prev.longitude,
      timezone: locationData.timezone || prev.timezone,
    }));
  };

  const submit = async () => { try { await onSubmit(form); onClose(); } catch (err) { setError(err.message || 'Could not save changes.'); } };

  const fileFields = fields.filter((f) => f.type === 'file');
  const otherFields = fields.filter((f) => f.type !== 'file');

  const renderField = (field) => {
    if (field.type === 'address') {
      return <AddressAutocomplete value={form[field.key] || ''} onChange={(val) => update(field.key, val)} onSelect={handleAddressSelect} token={session?.access_token} placeholder="Search for an address..." />;
    }
    if (field.type === 'textarea') {
      return <textarea className="admin-modal__textarea" rows={3} value={form[field.key] || ''} onChange={(e) => update(field.key, e.target.value)} />;
    }
    if (field.type === 'select') {
      return <select className="admin-input" value={String(form[field.key] ?? '')} onChange={(e) => update(field.key, e.target.value)}>{field.options.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select>;
    }
    return <input className="admin-input" type={field.type || 'text'} step={field.type === 'number' ? 'any' : undefined} value={form[field.key] ?? ''} onChange={(e) => update(field.key, e.target.value)} />;
  };

  return <div className="admin-modal" role="dialog" aria-modal="true"><div className="admin-modal__overlay" onClick={onClose} /><div className="admin-modal__card admin-modal__card--lg"><header className="admin-modal__head"><div><h3 className="admin-modal__title">{title}</h3><p className="admin-modal__sub">Update the location data stored by the platform.</p></div></header>{error && <div className="vendor-form-error">{error}</div>}<div className="admin-modal__body"><div className="admin-modal__left">{otherFields.map((field) => <Field key={field.key} label={field.label} full={field.full}>{renderField(field)}</Field>)}</div><div className="admin-modal__right">{fileFields.length > 0 ? fileFields.map((field) => <Field key={field.key} label={field.label} full><FileInput value={form[field.key]} onChange={(file) => update(field.key, file)} /></Field>) : <div className="admin-modal__image-area"><IconUpload size={32} stroke={1.5} className="admin-modal__image-icon" /><span className="admin-modal__image-text">Click to upload cover image</span><span className="admin-modal__image-hint">JPEG, PNG or WebP</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => update('cover_file', e.target.files?.[0] || null)} /></div>}</div></div><footer className="admin-modal__foot"><button type="button" className="admin-action" onClick={onClose}>Cancel</button><button type="button" className="admin-action admin-action--approve" onClick={submit} disabled={submitting}>{submitting ? 'Saving…' : 'Save changes'}</button></footer></div></div>;
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
  { key: 'street_address', label: 'Street address' },
  { key: 'city', label: 'City' },
  { key: 'province', label: 'Province' },
  { key: 'postal_code', label: 'Postal code' },
  { key: 'country', label: 'Country' },
  { key: 'latitude', label: 'Latitude', type: 'number' },
  { key: 'longitude', label: 'Longitude', type: 'number' },
  { key: 'is_active', label: 'Status', type: 'select', options: [{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }] },
  { key: 'cover_file', label: 'Cover image', type: 'file' },
];

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

export function collectionPointFields(floors = []) {
  return [
    { key: 'name', label: 'Collection point name' },
    { key: 'floor_id', label: 'Floor', type: 'select', options: floorOptions(floors) },
    { key: 'instructions', label: 'Instructions', type: 'textarea', full: true },
    { key: 'is_express', label: 'Type', type: 'select', options: [{ value: true, label: 'Express' }, { value: false, label: 'Catering' }] },
    { key: 'is_active', label: 'Status', type: 'select', options: [{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }] },
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
