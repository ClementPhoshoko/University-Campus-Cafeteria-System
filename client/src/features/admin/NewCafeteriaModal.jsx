import { useState } from 'react';
import {
  IconBuilding,
  IconX,
  IconPlus,
  IconUpload,
} from '@tabler/icons-react';
import useObjectPreview from '../../hooks/useObjectPreview.js';
import { uploadAdminAsset } from '../../services/adminApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useAdminLocations } from '../../hooks/useAdminLocations.js';
import ModalProgressOverlay from './ModalProgressOverlay.jsx';
import AdminDropdown from '../../components/ui/AdminDropdown.jsx';

export default function NewCafeteriaModal({ initial, onClose, onSubmit, submitting }) {
  const editing = !!initial;
  const [form, setForm] = useState(() => initial ? {
    name: initial.name || '',
    code: initial.code || '',
    category: initial.category || 'dining',
    description: initial.description || '',
    image_url: initial.image_url || '',
    status: initial.status || 'closed',
    walk_time: initial.walk_time || '',
    estimated_prep_minutes: initial.estimated_prep_minutes ?? '',
    site_id: initial.site_id || '',
    is_active: initial.is_active ?? true,
    cover_file: null,
  } : {
    name: '',
    code: '',
    category: 'dining',
    description: '',
    image_url: '',
    status: 'closed',
    walk_time: '',
    estimated_prep_minutes: '',
    site_id: '',
    is_active: true,
    cover_file: null,
  });
  const [coverPreview, setCoverPreview] = useObjectPreview(initial?.image_url || null);
  const [error, setError] = useState('');
  const { session } = useAuth();
  const { sites } = useAdminLocations();
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    if (!form.name.trim()) return setError('Cafeteria name is required.');
    if (!form.site_id) return setError('Site is required.');
    try {
      const { cover_file: coverFile, ...cafeteriaPayload } = form;
      const response = await onSubmit(cafeteriaPayload);
      if (coverFile && response?.cafeteria?.id) {
        await uploadAdminAsset(session?.access_token, 'cafeteria', response.cafeteria.id, coverFile);
      }
      onClose();
    } catch (err) {
      setError(err.message || `Could not ${editing ? 'update' : 'create'} cafeteria.`);
    }
  };

  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <div className="admin-modal__overlay" onClick={onClose} />
      <div className="admin-modal__card admin-modal__card--lg">
        <header className="admin-modal__head">
          <div className="admin-modal__icon admin-modal__icon--info">
            <IconPlus size={20} />
          </div>
          <div>
            <h3 className="admin-modal__title">{editing ? 'Edit cafeteria' : 'Register new cafeteria'}</h3>
            <p className="admin-modal__sub">{editing ? 'Update the cafeteria information and image.' : 'Add a cafeteria to the employee directory.'}</p>
          </div>
        </header>
        {error && <div className="vendor-form-error">{error}</div>}
        <div className="admin-modal__body">
          <div className="admin-modal__left">
            <div className="admin-modal__row">
              <label className="admin-modal__field">
                <span>Cafeteria name *</span>
                <input autoFocus className="admin-input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Main Campus Cafe" disabled={submitting} />
              </label>
              <label className="admin-modal__field">
                <span>Code</span>
                <input className="admin-input" value={form.code} onChange={(e) => update('code', e.target.value)} placeholder="MP-CAFE" disabled={submitting} />
              </label>
            </div>
            <div className="admin-modal__row">
              <AdminDropdown
                label="Category"
                options={[{ value: 'dining', label: 'Dining' }, { value: 'seafood', label: 'Seafood' }, { value: 'cafe', label: 'Cafe' }]}
                value={form.category}
                onChange={(val) => update('category', val)}
                placeholder="Select category..."
                loading={submitting}
              />
              <AdminDropdown
                label="Status"
                options={[{ value: 'open', label: 'Open' }, { value: 'busy', label: 'Busy' }, { value: 'closed', label: 'Closed' }, { value: 'temporarily_unavailable', label: 'Temporarily Unavailable' }]}
                value={form.status}
                onChange={(val) => update('status', val)}
                placeholder="Select status..."
                loading={submitting}
              />
            </div>
            <div className="admin-modal__row">
              <AdminDropdown
                label="Site *"
                options={sites.map((s) => ({ value: s.id, label: s.name }))}
                value={form.site_id}
                onChange={(val) => update('site_id', val)}
                placeholder="Select a site..."
                loading={submitting}
              />
              <label className="admin-modal__field">
                <span>Walk time</span>
                <input className="admin-input" value={form.walk_time} onChange={(e) => update('walk_time', e.target.value)} placeholder="6 min" disabled={submitting} />
              </label>
            </div>
            <div className="admin-modal__row">
              <label className="admin-modal__field">
                <span>Est. prep time (min)</span>
                <input type="number" className="admin-input" value={form.estimated_prep_minutes} onChange={(e) => update('estimated_prep_minutes', e.target.value)} placeholder="15" disabled={submitting} />
              </label>
              <label className="admin-modal__field">
                <span>Status</span>
                <AdminDropdown
                  options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]}
                  value={form.is_active ? true : false}
                  onChange={(val) => update('is_active', val)}
                  placeholder="Select..."
                  loading={submitting}
                />
              </label>
            </div>
            <label className="admin-modal__field">
              <span>Description</span>
              <textarea className="admin-modal__textarea" value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Brief description..." rows={3} disabled={submitting} />
            </label>
          </div>
          <div className="admin-modal__right">
            <div className="admin-modal__image-area admin-modal__image-area--sm">
              {coverPreview ? (
                <img src={coverPreview} alt="Cafeteria preview" />
              ) : (
                <>
                  <IconUpload size={24} stroke={1.5} className="admin-modal__image-icon" />
                  <span className="admin-modal__image-text">Click to upload image</span>
                  <span className="admin-modal__image-hint">JPEG, PNG or WebP</span>
                </>
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0] || null; update('cover_file', file); setCoverPreview(file); }} disabled={submitting} />
            </div>
          </div>
        </div>
        <footer className="admin-modal__foot">
          <button type="button" className="admin-action" onClick={onClose}>Cancel</button>
          <button type="button" className="admin-action admin-action--approve" onClick={submit} disabled={submitting}>
            {submitting ? (editing ? 'Saving…' : 'Registering…') : (editing ? 'Save changes' : 'Register cafeteria')}
          </button>
        </footer>
        <ModalProgressOverlay active={submitting} messages={editing ? ['Updating cafeteria details...', 'Saving your changes...', 'Almost there...'] : ['Creating this cafeteria...', 'Configuring details...', 'Almost there...']} />
      </div>
    </div>
  );
}
