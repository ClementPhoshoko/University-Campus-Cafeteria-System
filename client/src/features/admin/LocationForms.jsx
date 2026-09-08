import { useState } from 'react';

function Field({ label, children, full = false }) {
  return <label className={`admin-modal__field${full ? ' admin-modal__field--full' : ''}`}><span>{label}</span>{children}</label>;
}

export function LocationModal({ title, initial = {}, fields, onClose, onSubmit, submitting }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = async () => { try { await onSubmit(form); onClose(); } catch (err) { setError(err.message || 'Could not save changes.'); } };
  return <div className="admin-modal" role="dialog" aria-modal="true"><div className="admin-modal__overlay" onClick={onClose} /><div className="admin-modal__card admin-modal__card--lg"><header className="admin-modal__head"><div><h3 className="admin-modal__title">{title}</h3><p className="admin-modal__sub">Update the location data stored by the platform.</p></div></header>{error && <div className="vendor-form-error">{error}</div>}<div className="admin-form-grid">{fields.map((field) => <Field key={field.key} label={field.label} full={field.full}>{field.type === 'file' ? <input className="admin-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => update(field.key, e.target.files?.[0] || null)} /> : field.type === 'textarea' ? <textarea className="admin-modal__textarea" rows={3} value={form[field.key] || ''} onChange={(e) => update(field.key, e.target.value)} /> : field.type === 'select' ? <select className="admin-input" value={String(form[field.key] ?? '')} onChange={(e) => update(field.key, e.target.value)}>{field.options.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select> : <input className="admin-input" type={field.type || 'text'} step={field.type === 'number' ? 'any' : undefined} value={form[field.key] ?? ''} onChange={(e) => update(field.key, e.target.value)} />}</Field>)}</div><footer className="admin-modal__foot"><button type="button" className="admin-action" onClick={onClose}>Cancel</button><button type="button" className="admin-action admin-action--approve" onClick={submit} disabled={submitting}>{submitting ? 'Saving…' : 'Save changes'}</button></footer></div></div>;
}

export const siteFields = [
  { key: 'name', label: 'Site name' }, { key: 'code', label: 'Site code' }, { key: 'address', label: 'Address', full: true },
  { key: 'latitude', label: 'Latitude', type: 'number' }, { key: 'longitude', label: 'Longitude', type: 'number' }, { key: 'timezone', label: 'Timezone' },
  { key: 'is_active', label: 'Status', type: 'select', options: [{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }] }, { key: 'cover_file', label: 'Cover image', type: 'file' },
];

export const buildingFields = [
  { key: 'name', label: 'Building name' }, { key: 'code', label: 'Building code' }, { key: 'address', label: 'Address', full: true },
  { key: 'latitude', label: 'Latitude', type: 'number' }, { key: 'longitude', label: 'Longitude', type: 'number' },
  { key: 'is_active', label: 'Status', type: 'select', options: [{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }] }, { key: 'cover_file', label: 'Cover image', type: 'file' },
];

export const floorFields = [
  { key: 'name', label: 'Floor name' }, { key: 'level_number', label: 'Level number', type: 'number' },
  { key: 'is_active', label: 'Status', type: 'select', options: [{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }] },
];

export const collectionPointFields = [
  { key: 'name', label: 'Collection point name' }, { key: 'floor_id', label: 'Floor ID' }, { key: 'instructions', label: 'Instructions', type: 'textarea', full: true },
  { key: 'is_express', label: 'Type', type: 'select', options: [{ value: true, label: 'Express' }, { value: false, label: 'Catering' }] },
  { key: 'is_active', label: 'Status', type: 'select', options: [{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }] },
];

export const deliveryFields = [
  { key: 'name', label: 'Delivery location name' }, { key: 'floor_id', label: 'Floor ID' }, { key: 'room_or_venue', label: 'Room or venue', full: true },
  { key: 'instructions', label: 'Instructions', type: 'textarea', full: true }, { key: 'is_active', label: 'Status', type: 'select', options: [{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }] },
];
