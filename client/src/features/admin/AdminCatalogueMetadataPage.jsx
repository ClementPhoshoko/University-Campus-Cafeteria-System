import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconArchive, IconEdit, IconPlus, IconRefresh } from '@tabler/icons-react';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import { useConfirm } from '../../components/confirmation/ConfirmProvider.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import {
  createCatalogueMetadata,
  listCatalogueMetadata,
  updateCatalogueMetadata,
} from '../../services/adminApi.js';
import './admin-catalogue-metadata.css';

const TYPES = [
  { id: 'dietary_tag', label: 'Dietary tags', singular: 'dietary tag', plural: 'dietary tags' },
  { id: 'allergen', label: 'Allergens', singular: 'allergen', plural: 'allergens' },
];
const blankForm = { name: '', description: '' };

export default function AdminCatalogueMetadataPage() {
  const { session } = useAuth();
  const confirm = useConfirm();
  const token = session?.access_token;
  const [catalogue, setCatalogue] = useState({ dietary_tags: [], allergens: [] });
  const [type, setType] = useState('dietary_tag');
  const [filter, setFilter] = useState('active');
  const [loading, setLoading] = useState(Boolean(token));
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError('');
    try {
      const response = await listCatalogueMetadata(token);
      setCatalogue({ dietary_tags: response?.dietary_tags || [], allergens: response?.allergens || [] });
    } catch (requestError) {
      setLoadError(requestError.message || 'Could not load catalogue labels.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  const currentType = TYPES.find((entry) => entry.id === type) || TYPES[0];
  const allEntries = type === 'dietary_tag' ? catalogue.dietary_tags : catalogue.allergens;
  const entries = useMemo(() => allEntries.filter((entry) => (
    filter === 'all' || (filter === 'active' ? entry.is_active : !entry.is_active)
  )), [allEntries, filter]);
  const activeCount = allEntries.filter((entry) => entry.is_active).length;

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
    setForm(blankForm);
    setError('');
    setNotice('');
  }

  function openEdit(entry) {
    setEditing(entry);
    setEditorOpen(true);
    setForm({ name: entry.name, description: entry.description || '' });
    setError('');
    setNotice('');
  }

  function closeEditor() {
    if (saving) return;
    setEditorOpen(false);
    setError('');
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = { name: form.name.trim(), description: form.description.trim() || null };
      if (editing) {
        await updateCatalogueMetadata(token, type, editing.id, payload);
        setNotice(`${currentType.singular[0].toUpperCase()}${currentType.singular.slice(1)} updated.`);
      } else {
        await createCatalogueMetadata(token, { ...payload, type });
        setNotice(`${currentType.singular[0].toUpperCase()}${currentType.singular.slice(1)} added.`);
      }
      setEditorOpen(false);
      await refresh();
    } catch (requestError) {
      setError(requestError.message || `Could not save this ${currentType.singular}.`);
    } finally {
      setSaving(false);
    }
  }

  async function setActive(entry, isActive) {
    if (saving) return;
    if (!isActive && !await confirm({
      title: `Deactivate ${currentType.singular}?`,
      message: `${entry.name} will no longer be available for new menu-item assignments. Existing item and order records are retained.`,
      confirmLabel: 'Deactivate label',
      tone: 'danger',
    })) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await updateCatalogueMetadata(token, type, entry.id, { is_active: isActive });
      setNotice(`${entry.name} ${isActive ? 'reactivated' : 'deactivated'}.`);
      await refresh();
    } catch (requestError) {
      setError(requestError.message || `Could not update ${entry.name}.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-catalogue-metadata">
      <header className="admin-catalogue-metadata__header">
        <div>
          <span className="admin-card__eyebrow">Menu configuration</span>
          <h1>Catalogue metadata</h1>
          <p>Manage the shared dietary and allergen labels vendors can assign to menu items.</p>
        </div>
        <PrimaryButton size="sm" icon={IconPlus} onClick={openCreate}>Add {currentType.singular}</PrimaryButton>
      </header>

      <section className="admin-catalogue-metadata__panel" aria-label="Shared menu labels">
        <div className="admin-catalogue-metadata__toolbar">
          <div className="admin-catalogue-metadata__types" role="tablist" aria-label="Label type">
            {TYPES.map((entry) => {
              const count = entry.id === 'dietary_tag' ? catalogue.dietary_tags.length : catalogue.allergens.length;
              return <button key={entry.id} type="button" role="tab" aria-selected={type === entry.id}
                className={type === entry.id ? 'is-active' : ''} onClick={() => { setType(entry.id); setNotice(''); setError(''); }}>
                {entry.label}<span>{count}</span>
              </button>;
            })}
          </div>
          <div className="admin-catalogue-metadata__filters" aria-label="Label status filter">
            {['active', 'inactive', 'all'].map((value) => <button key={value} type="button" aria-pressed={filter === value}
              className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>
              {value === 'all' ? 'All' : value[0].toUpperCase() + value.slice(1)}
            </button>)}
          </div>
        </div>

        <div className="admin-catalogue-metadata__summary">
          <span>{activeCount} active {currentType.plural}</span>
          <span>Inactive labels stay attached to existing menu items and historical orders.</span>
        </div>

        {notice && <p className="admin-catalogue-metadata__notice" role="status">{notice}</p>}
        {error && <p className="admin-catalogue-metadata__error" role="alert">{error}</p>}
        {loadError ? <div className="admin-catalogue-metadata__load-error" role="alert"><p>{loadError}</p><button type="button" className="admin-action" onClick={refresh}><IconRefresh size={14} /> Retry</button></div>
          : loading ? <div className="admin-catalogue-metadata__loading" role="status">Loading shared labels…</div>
            : entries.length === 0 ? <div className="admin-catalogue-metadata__empty">
              <h2>No {filter === 'active' ? 'active ' : filter === 'inactive' ? 'inactive ' : ''}{currentType.plural}</h2>
              <p>{filter === 'active' ? `Add a ${currentType.singular} so vendors can use it on their menu items.` : 'There are no labels in this view.'}</p>
            </div> : <div className="admin-catalogue-metadata__list">
              {entries.map((entry) => <article className="admin-catalogue-metadata__row" key={entry.id}>
                <div className="admin-catalogue-metadata__copy">
                  <div className="admin-catalogue-metadata__name-line"><strong>{entry.name}</strong><span className={`admin-catalogue-metadata__status${entry.is_active ? ' is-active' : ''}`}>{entry.is_active ? 'Active' : 'Inactive'}</span></div>
                  {entry.description && <p>{entry.description}</p>}
                </div>
                <div className="admin-catalogue-metadata__actions">
                  <button type="button" className="admin-action" onClick={() => openEdit(entry)} disabled={saving}><IconEdit size={14} />Edit</button>
                  {entry.is_active
                    ? <button type="button" className="admin-action admin-action--ghost-danger" onClick={() => setActive(entry, false)} disabled={saving}><IconArchive size={14} />Deactivate</button>
                    : <button type="button" className="admin-action" onClick={() => setActive(entry, true)} disabled={saving}><IconRefresh size={14} />Reactivate</button>}
                </div>
              </article>)}
            </div>}
      </section>

      {editorOpen && <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="catalogue-label-title">
        <button type="button" className="admin-modal__overlay" aria-label="Close label editor" onClick={closeEditor} />
        <form className="admin-modal__card admin-catalogue-metadata__modal" onSubmit={save}>
          <header className="admin-modal__head"><div>
            <h2 className="admin-modal__title" id="catalogue-label-title">{editing ? `Edit ${currentType.singular}` : `Add ${currentType.singular}`}</h2>
            <p className="admin-modal__sub">This shared label will be available to vendor managers across the platform.</p>
          </div></header>
          {error && <p className="admin-catalogue-metadata__error" role="alert">{error}</p>}
          <label className="admin-modal__field"><span>Name</span><input className="admin-input" maxLength={100} required autoFocus value={form.name} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
          <label className="admin-modal__field"><span>Description (optional)</span><textarea className="admin-modal__textarea" maxLength={500} rows={3} value={form.description} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
          <footer className="admin-modal__foot">
            <button type="button" className="admin-action" disabled={saving} onClick={closeEditor}>Cancel</button>
            <PrimaryButton type="submit" disabled={saving || !form.name.trim()}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add label'}</PrimaryButton>
          </footer>
        </form>
      </div>}
    </div>
  );
}
