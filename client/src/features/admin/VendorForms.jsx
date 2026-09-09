import { useEffect, useMemo, useState } from 'react';
import { IconArrowLeft, IconArrowRight, IconCheck, IconPlus, IconX } from '@tabler/icons-react';
import { useAdminLocations } from '../../hooks/useAdminLocations.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function emptyHours() {
  return DAYS.map((_, day_of_week) => ({ day_of_week, is_closed: day_of_week === 0 || day_of_week === 6, opens_at: '07:00', closes_at: '17:00' }));
}

function Field({ label, children, full = false }) {
  return <label className={`admin-modal__field${full ? ' admin-modal__field--full' : ''}`}><span>{label}</span>{children}</label>;
}

function LocationFields({ form, setForm }) {
  const {
    sites, buildingsBySite, collectionPointsByBuilding, fetchBuildings, fetchCollectionPoints,
  } = useAdminLocations();
  const buildings = buildingsBySite[form.site_id] || [];
  const collectionPoints = collectionPointsByBuilding[form.building_id] || [];

  useEffect(() => {
    if (form.site_id) fetchBuildings(form.site_id).catch(() => {});
  }, [fetchBuildings, form.site_id]);

  useEffect(() => {
    if (form.building_id) fetchCollectionPoints(form.building_id).catch(() => {});
  }, [fetchCollectionPoints, form.building_id]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="admin-form-grid">
      <Field label="Site">
        <select className="admin-input" value={form.site_id} onChange={(e) => setForm((prev) => ({ ...prev, site_id: e.target.value, building_id: '', collection_point_id: '' }))}>
          <option value="">Select a site</option>
          {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
        </select>
      </Field>
      <Field label="Building">
        <select className="admin-input" value={form.building_id} disabled={!form.site_id} onChange={(e) => setForm((prev) => ({ ...prev, building_id: e.target.value, collection_point_id: '' }))}>
          <option value="">Select a building</option>
          {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
        </select>
      </Field>
      <Field label="Collection point">
        <select className="admin-input" value={form.collection_point_id} disabled={!form.building_id} onChange={(e) => update('collection_point_id', e.target.value)}>
          <option value="">No collection point</option>
          {collectionPoints.map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}
        </select>
      </Field>
      <Field label="Service status">
        <select className="admin-input" value={form.service_status} onChange={(e) => update('service_status', e.target.value)}>
          <option value="closed">Closed</option><option value="open">Open</option><option value="busy">Busy</option><option value="temporarily_unavailable">Temporarily unavailable</option>
        </select>
      </Field>
      <Field label="Estimated prep time (minutes)"><input className="admin-input" type="number" min="1" value={form.estimated_prep_minutes} onChange={(e) => update('estimated_prep_minutes', e.target.value)} /></Field>
      <Field label="Order cutoff (minutes)"><input className="admin-input" type="number" min="0" value={form.order_cutoff_minutes} onChange={(e) => update('order_cutoff_minutes', e.target.value)} /></Field>
      <Field label="Collection instructions" full><textarea className="admin-modal__textarea" value={form.collection_instructions} onChange={(e) => update('collection_instructions', e.target.value)} placeholder="Where should customers collect their orders?" /></Field>
    </div>
  );
}

function HoursFields({ hours, setHours }) {
  return (
    <div className="vendor-hours-grid">
      {hours.map((row) => (
        <div className="vendor-hours-row" key={row.day_of_week}>
          <strong>{DAYS[row.day_of_week]}</strong>
          <label><input type="checkbox" checked={!row.is_closed} onChange={(e) => setHours((prev) => prev.map((item) => item.day_of_week === row.day_of_week ? { ...item, is_closed: !e.target.checked } : item))} /> Open</label>
          <input className="admin-input" type="time" disabled={row.is_closed} value={row.opens_at} onChange={(e) => setHours((prev) => prev.map((item) => item.day_of_week === row.day_of_week ? { ...item, opens_at: e.target.value } : item))} />
          <span>to</span>
          <input className="admin-input" type="time" disabled={row.is_closed} value={row.closes_at} onChange={(e) => setHours((prev) => prev.map((item) => item.day_of_week === row.day_of_week ? { ...item, closes_at: e.target.value } : item))} />
        </div>
      ))}
    </div>
  );
}

export function AddVendorModal({ onClose, onSubmit, submitting = false }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', description: '', logo_url: '', logo_file: null, support_email: '', support_phone: '', corporate_catering_enabled: false, onboarding_key: '', site_id: '', building_id: '', collection_point_id: '', service_status: 'closed', estimated_prep_minutes: '15', order_cutoff_minutes: '0', collection_instructions: '' });
  const [hours, setHours] = useState(emptyHours);

  const steps = useMemo(() => ['Vendor profile', 'Operating location', 'Opening hours'], []);
  const next = () => {
    if (step === 0 && !form.name.trim()) return setError('Vendor name is required.');
    if (step === 1 && (!form.site_id || !form.building_id)) return setError('Select a site and building before continuing.');
    setError(''); setStep((value) => Math.min(value + 1, steps.length - 1));
  };
  const submit = async () => {
    setError('');
    try {
      await onSubmit({
        name: form.name.trim(), description: form.description.trim() || null, logo_url: form.logo_url.trim() || null, logoFile: form.logo_file,
        support_email: form.support_email.trim() || null, support_phone: form.support_phone.trim() || null,
        corporate_catering_enabled: form.corporate_catering_enabled, onboarding_key: form.onboarding_key.trim() || null,
        location: { site_id: form.site_id, building_id: form.building_id, collection_point_id: form.collection_point_id || null, service_status: form.service_status, estimated_prep_minutes: Number(form.estimated_prep_minutes), order_cutoff_minutes: Number(form.order_cutoff_minutes), collection_instructions: form.collection_instructions.trim() || null, hours },
      });
      onClose();
    } catch (err) { setError(err.message || 'Could not create vendor.'); }
  };

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="add-vendor-title">
      <div className="admin-modal__overlay" onClick={onClose} />
      <div className="admin-modal__card vendor-wizard" onClick={(e) => e.stopPropagation()}>
        <header className="admin-modal__head">
          <div className="admin-modal__icon admin-modal__icon--info"><IconPlus size={20} stroke={2} /></div>
          <div><h3 className="admin-modal__title" id="add-vendor-title">Add vendor</h3><p className="admin-modal__sub">Register a vendor and prepare its first operating location.</p></div>
          <button type="button" className="vendor-modal-close" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
        </header>
        <div className="vendor-wizard__steps">{steps.map((label, index) => <span className={index === step ? 'is-active' : index < step ? 'is-complete' : ''} key={label}><b>{index + 1}</b>{label}</span>)}</div>
        {error && <div className="vendor-form-error" role="alert">{error}</div>}
        {step === 0 && <div className="admin-form-grid"><Field label="Vendor name"><input autoFocus className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Riverside Kitchen" /></Field><Field label="Support email"><input className="admin-input" type="email" value={form.support_email} onChange={(e) => setForm({ ...form, support_email: e.target.value })} /></Field><Field label="Support phone"><input className="admin-input" value={form.support_phone} onChange={(e) => setForm({ ...form, support_phone: e.target.value })} /></Field><Field label="Logo image"><input className="admin-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setForm({ ...form, logo_file: e.target.files?.[0] || null })} /></Field><Field label="Logo URL (optional)"><input className="admin-input" type="url" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} /></Field><Field label="Description" full><textarea className="admin-modal__textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} /></Field><Field label="Onboarding key (optional)"><input className="admin-input" value={form.onboarding_key} onChange={(e) => setForm({ ...form, onboarding_key: e.target.value })} /></Field><label className="vendor-checkbox"><input type="checkbox" checked={form.corporate_catering_enabled} onChange={(e) => setForm({ ...form, corporate_catering_enabled: e.target.checked })} /> Corporate catering enabled</label></div>}
        {step === 1 && <LocationFields form={form} setForm={setForm} />}
        {step === 2 && <HoursFields hours={hours} setHours={setHours} />}
        <footer className="admin-modal__foot"><button type="button" className="admin-action" onClick={step === 0 ? onClose : () => setStep((value) => value - 1)}>{step === 0 ? 'Cancel' : <><IconArrowLeft size={14} /> Back</>}</button>{step < 2 ? <button type="button" className="admin-action admin-action--approve" onClick={next}>Continue <IconArrowRight size={14} /></button> : <button type="button" className="admin-action admin-action--approve" onClick={submit} disabled={submitting}><IconCheck size={14} /> {submitting ? 'Creating…' : 'Create vendor'}</button>}</footer>
      </div>
    </div>
  );
}

export function VendorProfileModal({ vendor, onClose, onSubmit, submitting = false }) {
  const [form, setForm] = useState({ name: vendor.name || '', description: vendor.description || '', logo_url: vendor.logo_url || '', logo_file: null, support_email: vendor.support_email || '', support_phone: vendor.support_phone || '', corporate_catering_enabled: !!vendor.corporate_catering_enabled });
  return <div className="admin-modal" role="dialog" aria-modal="true"><div className="admin-modal__overlay" onClick={onClose} /><div className="admin-modal__card admin-modal__card--lg"><header className="admin-modal__head"><div><h3 className="admin-modal__title">Edit vendor profile</h3><p className="admin-modal__sub">Update the information shown to internal teams.</p></div></header><div className="admin-form-grid"><Field label="Vendor name"><input className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Support email"><input className="admin-input" type="email" value={form.support_email} onChange={(e) => setForm({ ...form, support_email: e.target.value })} /></Field><Field label="Support phone"><input className="admin-input" value={form.support_phone} onChange={(e) => setForm({ ...form, support_phone: e.target.value })} /></Field><Field label="Logo image"><input className="admin-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setForm({ ...form, logo_file: e.target.files?.[0] || null })} /></Field><Field label="Logo URL"><input className="admin-input" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} /></Field><Field label="Description" full><textarea className="admin-modal__textarea" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field><label className="vendor-checkbox"><input type="checkbox" checked={form.corporate_catering_enabled} onChange={(e) => setForm({ ...form, corporate_catering_enabled: e.target.checked })} /> Corporate catering enabled</label></div><footer className="admin-modal__foot"><button type="button" className="admin-action" onClick={onClose}>Cancel</button><button type="button" className="admin-action admin-action--approve" disabled={submitting} onClick={() => onSubmit(form)}>{submitting ? 'Saving…' : 'Save changes'}</button></footer></div></div>;
}

export function StaffModal({ onClose, onSubmit, submitting = false }) {
  const [form, setForm] = useState({ email: '', role: 'staff' });
  return <div className="admin-modal" role="dialog" aria-modal="true"><div className="admin-modal__overlay" onClick={onClose} /><div className="admin-modal__card"><header className="admin-modal__head"><div><h3 className="admin-modal__title">Add vendor staff</h3><p className="admin-modal__sub">The user must already have a platform profile.</p></div></header><div className="admin-form-grid"><Field label="User email" full><input autoFocus className="admin-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field><Field label="Vendor role"><select className="admin-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="staff">Staff</option><option value="manager">Manager</option></select></Field></div><footer className="admin-modal__foot"><button type="button" className="admin-action" onClick={onClose}>Cancel</button><button type="button" className="admin-action admin-action--approve" disabled={submitting || !form.email.trim()} onClick={() => onSubmit(form)}>{submitting ? 'Adding…' : 'Add staff member'}</button></footer></div></div>;
}

export function VendorLocationModal({ location, onClose, onSubmit, submitting = false }) {
  const [form, setForm] = useState({ site_id: location?.site_id || '', building_id: location?.building_id || '', collection_point_id: location?.collection_point_id || '', service_status: location?.service_status || 'closed', estimated_prep_minutes: String(location?.estimated_prep_minutes || 15), order_cutoff_minutes: String(location?.order_cutoff_minutes || 0), collection_instructions: location?.collection_instructions || '' });
  const [hours, setHours] = useState(location?.hours?.length ? location.hours : emptyHours);
  const editing = !!location;
  return <div className="admin-modal" role="dialog" aria-modal="true"><div className="admin-modal__overlay" onClick={onClose} /><div className="admin-modal__card vendor-wizard"><header className="admin-modal__head"><div><h3 className="admin-modal__title">{editing ? 'Edit operating location' : 'Add operating location'}</h3><p className="admin-modal__sub">{editing ? 'Update service settings and weekly hours.' : 'Connect this vendor to an active campus location.'}</p></div></header><LocationFields form={form} setForm={setForm} /><details className="vendor-hours-details" open={editing}><summary>Configure weekly hours</summary><HoursFields hours={hours} setHours={setHours} /></details><footer className="admin-modal__foot"><button type="button" className="admin-action" onClick={onClose}>Cancel</button><button type="button" className="admin-action admin-action--approve" disabled={submitting || !form.site_id || !form.building_id} onClick={() => onSubmit({ ...form, estimated_prep_minutes: Number(form.estimated_prep_minutes), order_cutoff_minutes: Number(form.order_cutoff_minutes), collection_point_id: form.collection_point_id || null, collection_instructions: form.collection_instructions.trim() || null, hours })}>{submitting ? 'Saving…' : editing ? 'Save location' : 'Add location'}</button></footer></div></div>;
}

export { HoursFields };

export function MenuItemModal({ item, categories, onClose, onSubmit, submitting = false }) {
  const [form, setForm] = useState({
    name: item?.name || '',
    description: item?.description || '',
    category_id: item?.category_id || '',
    base_price: String(item?.base_price ?? ''),
    prep_minutes: String(item?.prep_minutes ?? ''),
    status: item?.status || 'available',
    portion_description: item?.portion_description || '',
    ingredients: Array.isArray(item?.ingredients) ? item.ingredients.join(', ') : '',
  });
  const editing = !!item;

  const submit = () => {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category_id: form.category_id || null,
      base_price: Number(form.base_price),
      prep_minutes: form.prep_minutes ? Number(form.prep_minutes) : null,
      status: form.status,
      portion_description: form.portion_description.trim() || null,
      ingredients: form.ingredients.split(',').map((s) => s.trim()).filter(Boolean),
    };
    onSubmit(payload);
  };

  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <div className="admin-modal__overlay" onClick={onClose} />
      <div className="admin-modal__card admin-modal__card--lg" onClick={(e) => e.stopPropagation()}>
        <header className="admin-modal__head">
          <div><h3 className="admin-modal__title">{editing ? 'Edit menu item' : 'Add menu item'}</h3><p className="admin-modal__sub">{editing ? 'Update the item details and availability.' : 'Add a new item to this vendor\'s menu.'}</p></div>
        </header>
        <div className="admin-form-grid">
          <Field label="Item name" full><input autoFocus className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Classic Chicken Wrap" /></Field>
          <Field label="Category">
            <select className="admin-input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">No category</option>
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </Field>
          <Field label="Base price (ZAR)"><input className="admin-input" type="number" min="0" step="0.01" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} /></Field>
          <Field label="Prep time (min)"><input className="admin-input" type="number" min="1" value={form.prep_minutes} onChange={(e) => setForm({ ...form, prep_minutes: e.target.value })} /></Field>
          <Field label="Status">
            <select className="admin-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="available">Available</option>
              <option value="limited">Limited</option>
              <option value="sold_out">Sold out</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </Field>
          <Field label="Portion description" full><input className="admin-input" value={form.portion_description} onChange={(e) => setForm({ ...form, portion_description: e.target.value })} placeholder="e.g. 300g serving" /></Field>
          <Field label="Ingredients" full><input className="admin-input" value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} placeholder="Comma-separated, e.g. chicken, lettuce, tomato" /></Field>
          <Field label="Description" full><textarea className="admin-modal__textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </div>
        <footer className="admin-modal__foot">
          <button type="button" className="admin-action" onClick={onClose}>Cancel</button>
          <button type="button" className="admin-action admin-action--approve" disabled={submitting || !form.name.trim() || !form.base_price} onClick={submit}>{submitting ? 'Saving…' : editing ? 'Save item' : 'Add item'}</button>
        </footer>
      </div>
    </div>
  );
}

export function CategoryModal({ category, onClose, onSubmit, submitting = false }) {
  const [form, setForm] = useState({
    name: category?.name || '',
    sort_order: String(category?.sort_order ?? 0),
  });
  const editing = !!category;

  const submit = () => {
    onSubmit({ name: form.name.trim(), sort_order: Number(form.sort_order) || 0 });
  };

  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <div className="admin-modal__overlay" onClick={onClose} />
      <div className="admin-modal__card" onClick={(e) => e.stopPropagation()}>
        <header className="admin-modal__head">
          <div><h3 className="admin-modal__title">{editing ? 'Edit category' : 'Add category'}</h3><p className="admin-modal__sub">{editing ? 'Update the category name and sort order.' : 'Create a new menu category for this vendor.'}</p></div>
        </header>
        <div className="admin-form-grid">
          <Field label="Category name" full><input autoFocus className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mains, Drinks, Desserts" /></Field>
          <Field label="Sort order"><input className="admin-input" type="number" min="0" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></Field>
        </div>
        <footer className="admin-modal__foot">
          <button type="button" className="admin-action" onClick={onClose}>Cancel</button>
          <button type="button" className="admin-action admin-action--approve" disabled={submitting || !form.name.trim()} onClick={submit}>{submitting ? 'Saving…' : editing ? 'Save category' : 'Add category'}</button>
        </footer>
      </div>
    </div>
  );
}
