import { useCallback, useEffect, useState } from 'react';
import { IconPlus, IconPencil, IconTrash } from '@tabler/icons-react';
import CustomDropdown from '../../components/ui/CustomDropdown.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import { useConfirm } from '../../components/confirmation/ConfirmProvider.jsx';
import {
  createVendorOptionGroup,
  getVendorMenuItemConfiguration,
  listVendorMenuMetadataOptions,
  listVendorOptionGroups,
  updateVendorMenuItemConfiguration,
  updateVendorOptionGroup,
} from '../../services/vendorApi.js';
import './vendor-catalogue-configuration.css';

const GROUP_PAGE_SIZE = 8;
const GROUP_ASSIGNMENT_PAGE_SIZE = 8;
const statusValue = (value) => ({ id: value, name: value === 'single' ? 'Choose one' : 'Choose multiple' });

function FieldLabel({ children, htmlFor }) {
  return <label className="vendor-config-field__label" htmlFor={htmlFor}>{children}</label>;
}

export function VendorMenuItemConfigurationModal({ item, token, onClose, onSaved }) {
  const [metadata, setMetadata] = useState({ dietary_tags: [], allergens: [] });
  const [groups, setGroups] = useState([]);
  const [groupsPagination, setGroupsPagination] = useState({ page: 1, limit: GROUP_ASSIGNMENT_PAGE_SIZE, total: 0, totalPages: 1 });
  const [groupPage, setGroupPage] = useState(1);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [dietaryIds, setDietaryIds] = useState([]);
  const [allergens, setAllergens] = useState([]);
  const [groupIds, setGroupIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [metadataResponse, configurationResponse] = await Promise.all([
          listVendorMenuMetadataOptions(item.vendor_id, { token, signal: controller.signal }),
          getVendorMenuItemConfiguration(item.id, { token, signal: controller.signal }),
        ]);
        const configuration = configurationResponse.configuration || {};
        setMetadata({ dietary_tags: metadataResponse.dietary_tags || [], allergens: metadataResponse.allergens || [] });
        setDietaryIds((configuration.dietary_tags || []).map((tag) => tag.id));
        setAllergens((configuration.allergens || []).map((allergen) => ({ id: allergen.id, vendor_notice: allergen.vendor_notice || '' })));
        setGroupIds((configuration.option_groups || []).filter((group) => group.is_active).map((group) => group.id));
      } catch (loadError) {
        if (loadError.name !== 'AbortError') setError(loadError.message || 'Could not load item configuration.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [item.id, item.vendor_id, token]);

  useEffect(() => {
    const controller = new AbortController();
    setGroupsLoading(true);
    listVendorOptionGroups(item.vendor_id, { token, page: groupPage, limit: GROUP_ASSIGNMENT_PAGE_SIZE, signal: controller.signal })
      .then((response) => {
        setGroups(response.option_groups || []);
        setGroupsPagination(response.pagination || { page: groupPage, limit: GROUP_ASSIGNMENT_PAGE_SIZE, total: 0, totalPages: 1 });
      })
      .catch((loadError) => {
        if (loadError.name !== 'AbortError') setError(loadError.message || 'Could not load option groups.');
      })
      .finally(() => { if (!controller.signal.aborted) setGroupsLoading(false); });
    return () => controller.abort();
  }, [item.vendor_id, token, groupPage]);

  function toggleValue(values, setValues, value) {
    setValues((current) => current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]);
  }

  function toggleAllergen(id) {
    setAllergens((current) => current.some((row) => row.id === id)
      ? current.filter((row) => row.id !== id)
      : [...current, { id, vendor_notice: '' }]);
  }

  async function save(event) {
    event.preventDefault();
    if (saving || loading) return;
    setSaving(true);
    setError('');
    try {
      await updateVendorMenuItemConfiguration(item.id, {
        dietary_tag_ids: dietaryIds,
        allergens,
        option_group_ids: groupIds,
      }, { token });
      onSaved?.();
      onClose();
    } catch (saveError) {
      setError(saveError.message || 'Could not save item configuration.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="vendor-item-config-title">
    <button type="button" className="admin-modal__overlay" aria-label="Close item configuration" onClick={onClose} />
    <form className="admin-modal__card admin-modal__card--lg vendor-config-modal" onSubmit={save}>
      <header className="admin-modal__head">
        <div><h3 className="admin-modal__title" id="vendor-item-config-title">Item details</h3><p className="admin-modal__sub">Dietary information and customer options for {item.name}.</p></div>
      </header>
      <div className="admin-modal__body admin-modal__body--single">
        {error && <p className="vendor-config-error" role="alert">{error}</p>}
        {loading ? <p className="vendor-config-loading" role="status">Loading item details…</p> : <>
          <section className="vendor-config-section">
            <div className="vendor-config-section__heading"><h4>Dietary</h4><p>Choose all labels that describe this item.</p></div>
            {metadata.dietary_tags.length ? <div className="vendor-config-check-list">
              {metadata.dietary_tags.map((tag) => <label className="vendor-config-check" key={tag.id}>
                <input type="checkbox" checked={dietaryIds.includes(tag.id)} disabled={saving} onChange={() => toggleValue(dietaryIds, setDietaryIds, tag.id)} />
                <span><strong>{tag.name}</strong>{tag.description && <small>{tag.description}</small>}</span>
              </label>)}
            </div> : <p className="vendor-config-empty">No dietary labels are configured. Ask an administrator to add the required shared labels.</p>}
          </section>

          <section className="vendor-config-section">
            <div className="vendor-config-section__heading"><h4>Allergens</h4><p>Add a clear notice where customers need extra guidance.</p></div>
            {metadata.allergens.length ? <div className="vendor-config-check-list">
              {metadata.allergens.map((allergen) => {
                const selected = allergens.find((row) => row.id === allergen.id);
                return <div className={`vendor-config-allergen${selected ? ' is-selected' : ''}`} key={allergen.id}>
                  <label className="vendor-config-check">
                    <input type="checkbox" checked={Boolean(selected)} disabled={saving} onChange={() => toggleAllergen(allergen.id)} />
                    <span><strong>{allergen.name}</strong>{allergen.description && <small>{allergen.description}</small>}</span>
                  </label>
                  {selected && <input className="admin-input vendor-config-allergen__notice" maxLength={500} aria-label={`${allergen.name} vendor notice`} placeholder="Optional notice for customers" value={selected.vendor_notice} disabled={saving} onChange={(event) => setAllergens((current) => current.map((row) => row.id === allergen.id ? { ...row, vendor_notice: event.target.value } : row))} />}
                </div>;
              })}
            </div> : <p className="vendor-config-empty">No allergens are configured. Ask an administrator to add the required shared labels.</p>}
          </section>

          <section className="vendor-config-section">
            <div className="vendor-config-section__heading"><h4>Customer options</h4><p>Choose reusable option groups for this item.</p></div>
            {groupsLoading ? <p className="vendor-config-loading" role="status">Loading option groups…</p> : groups.length ? <div className="vendor-config-check-list">
              {groups.map((group) => <label className="vendor-config-check" key={group.id}>
                <input type="checkbox" checked={groupIds.includes(group.id)} disabled={saving} onChange={() => toggleValue(groupIds, setGroupIds, group.id)} />
                <span>
                  <strong>{group.name}</strong>
                  <small>{group.selection_type === 'single' ? 'Choose one' : 'Choose multiple'}{group.is_required ? ' · Required' : ' · Optional'} · {group.options.length} options</small>
                </span>
              </label>)}
            </div> : <p className="vendor-config-empty">Create an option group below before assigning customer choices to this item.</p>}
            {groupsPagination.totalPages > 1 && <Pagination currentPage={groupsPagination.page} totalPages={groupsPagination.totalPages} totalItems={groupsPagination.total} itemsPerPage={groupsPagination.limit} label="option groups" onPageChange={setGroupPage} />}
          </section>
        </>}
      </div>
      <footer className="admin-modal__foot">
        <PrimaryButton type="button" disabled={saving} onClick={onClose}>Cancel</PrimaryButton>
        <PrimaryButton type="submit" disabled={loading || saving}>{saving ? 'Saving…' : 'Save item details'}</PrimaryButton>
      </footer>
    </form>
  </div>;
}

function makeEmptyGroup() {
  return { name: '', selection_type: 'single', is_required: false, min_select: 0, max_select: 1, is_active: true, options: [{ name: '', price_delta: 0, max_quantity: 1 }] };
}

export function VendorOptionGroupEditor({ vendorId, token, group, onClose, onSaved }) {
  const editing = Boolean(group);
  const [form, setForm] = useState(() => group ? {
    name: group.name,
    selection_type: group.selection_type,
    is_required: group.is_required,
    min_select: group.min_select,
    max_select: group.max_select,
    is_active: true,
    options: (group.options || []).map((option) => ({ ...option, price_delta: String(option.price_delta) })),
  } : makeEmptyGroup());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateOption = (index, key, value) => setForm((current) => ({ ...current, options: current.options.map((option, optionIndex) => optionIndex === index ? { ...option, [key]: value } : option) }));

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const payload = {
        ...form,
        min_select: Number(form.min_select),
        max_select: Number(form.selection_type === 'single' ? 1 : form.max_select),
        options: form.options.map((option) => ({ ...option, price_delta: Number(option.price_delta), max_quantity: Number(option.max_quantity) })),
      };
      if (payload.is_required && !payload.min_select) payload.min_select = 1;
      if (payload.selection_type === 'single' && payload.is_required) payload.max_select = 1;
      if (editing) await updateVendorOptionGroup(vendorId, group.id, payload, { token });
      else await createVendorOptionGroup(vendorId, payload, { token });
      onSaved?.();
      onClose();
    } catch (saveError) {
      setError(saveError.message || 'Could not save this option group.');
    } finally {
      setBusy(false);
    }
  }

  const typeOptions = ['single', 'multiple'].map(statusValue);
  return <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="vendor-option-group-title">
    <button type="button" className="admin-modal__overlay" aria-label="Close option group editor" onClick={onClose} />
    <form className="admin-modal__card admin-modal__card--lg vendor-config-modal" onSubmit={submit}>
      <header className="admin-modal__head"><div><h3 className="admin-modal__title" id="vendor-option-group-title">{editing ? 'Edit option group' : 'Create option group'}</h3><p className="admin-modal__sub">Option groups are reusable. Changes affect every menu item assigned to this group.</p></div></header>
      <div className="admin-modal__body admin-modal__body--single">
        {error && <p className="vendor-config-error" role="alert">{error}</p>}
        {editing && <p className="vendor-config-note">Changes to this group and its choices will be used wherever “{group.name}” is assigned.</p>}
        <div className="vendor-config-form-grid">
          <label className="vendor-config-field"><FieldLabel htmlFor="option-group-name">Group name</FieldLabel><input id="option-group-name" className="admin-input" maxLength={100} value={form.name} disabled={busy} onChange={(event) => update('name', event.target.value)} /></label>
          <div className="vendor-config-field"><CustomDropdown label="Selection type" value={statusValue(form.selection_type)} options={typeOptions.map((option) => ({ ...option, available: true }))} disabled={busy} showAvailabilityStatus={false} onChange={(option) => update('selection_type', option.id)} /></div>
          <label className="vendor-config-field"><FieldLabel htmlFor="option-group-min">Minimum choices</FieldLabel><input id="option-group-min" className="admin-input" type="number" min={form.is_required ? 1 : 0} max={form.options.length} value={form.is_required ? Math.max(1, form.min_select) : form.min_select} disabled={busy} onChange={(event) => update('min_select', Number(event.target.value))} /></label>
          <label className="vendor-config-field"><FieldLabel htmlFor="option-group-max">Maximum choices</FieldLabel><input id="option-group-max" className="admin-input" type="number" min="1" max={form.options.length} value={form.selection_type === 'single' ? 1 : form.max_select} disabled={busy || form.selection_type === 'single'} onChange={(event) => update('max_select', Number(event.target.value))} /></label>
        </div>
        <label className="vendor-config-required"><input type="checkbox" checked={form.is_required} disabled={busy} onChange={(event) => update('is_required', event.target.checked)} /><span>Customer must make a selection</span></label>
        <div className="vendor-config-options-heading"><div><h4>Choices</h4><p>Set any additional price for each choice.</p></div><button type="button" className="vendor-config-add-option" disabled={busy || form.options.length >= 50} onClick={() => update('options', [...form.options, { name: '', price_delta: 0, max_quantity: 1 }])}><IconPlus size={16} />Add choice</button></div>
        <div className="vendor-config-option-list">
          {form.options.map((option, index) => <div className="vendor-config-option-row" key={option.id || `new-${index}`}>
            <label className="vendor-config-field"><FieldLabel htmlFor={`option-name-${index}`}>Choice</FieldLabel><input id={`option-name-${index}`} className="admin-input" maxLength={100} value={option.name} disabled={busy} onChange={(event) => updateOption(index, 'name', event.target.value)} /></label>
            <label className="vendor-config-field"><FieldLabel htmlFor={`option-price-${index}`}>Price change</FieldLabel><input id={`option-price-${index}`} className="admin-input" type="number" min="0" step="0.01" value={option.price_delta} disabled={busy} onChange={(event) => updateOption(index, 'price_delta', event.target.value)} /></label>
            <label className="vendor-config-field"><FieldLabel htmlFor={`option-quantity-${index}`}>Max qty</FieldLabel><input id={`option-quantity-${index}`} className="admin-input" type="number" min="1" max="99" value={option.max_quantity} disabled={busy} onChange={(event) => updateOption(index, 'max_quantity', event.target.value)} /></label>
            <button type="button" className="vendor-config-remove-option" aria-label={`Remove ${option.name || 'choice'}`} disabled={busy || form.options.length <= 1} onClick={() => update('options', form.options.filter((_, choiceIndex) => choiceIndex !== index))}><IconTrash size={17} /></button>
          </div>)}
        </div>
      </div>
      <footer className="admin-modal__foot"><PrimaryButton type="button" disabled={busy} onClick={onClose}>Cancel</PrimaryButton><PrimaryButton type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save option group' : 'Create option group'}</PrimaryButton></footer>
    </form>
  </div>;
}

export default function VendorOptionGroupManager({ vendorId, token }) {
  const confirm = useConfirm();
  const [groups, setGroups] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: GROUP_PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async (signal) => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const response = await listVendorOptionGroups(vendorId, { token, page, limit: GROUP_PAGE_SIZE, signal });
      setGroups(response.option_groups || []);
      setPagination(response.pagination || { page, limit: GROUP_PAGE_SIZE, total: 0, totalPages: 1 });
      setError('');
    } catch (loadError) {
      if (loadError.name !== 'AbortError') setError(loadError.message || 'Could not load option groups.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [vendorId, token, page]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function archive(group) {
    if (busy) return;
    setBusy(true);
    try {
      if (!await confirm({ title: 'Archive this option group?', message: `“${group.name}” will stop appearing on every item that uses it.`, confirmLabel: 'Archive group', tone: 'danger' })) return;
      await updateVendorOptionGroup(vendorId, group.id, { ...group, is_active: false }, { token });
      setNotice(`${group.name} archived.`);
      await load();
    } catch (archiveError) {
      setError(archiveError.message || 'Could not archive this option group.');
    } finally { setBusy(false); }
  }

  return <section className="vendor-menu-management__section vendor-option-groups" aria-labelledby="vendor-option-groups-title">
    <header className="vendor-option-groups__heading">
      <div><h3 id="vendor-option-groups-title">Customer options</h3><p>Create reusable choices such as sizes, extras, and preparation preferences.</p></div>
      <PrimaryButton size="sm" icon={IconPlus} disabled={busy} onClick={() => setEditing({ isNew: true })}>Add option group</PrimaryButton>
    </header>
    <p className="vendor-config-note">Groups are reusable. Editing or archiving one affects every item assigned to it.</p>
    {notice && <p className="vendor-menu-management__notice" role="status">{notice}</p>}
    {error && <p className="vendor-menu-management__error" role="alert">{error}</p>}
    {loading ? <p className="vendor-config-loading" role="status">Loading option groups…</p>
      : !groups.length ? <p className="vendor-menu-management__empty">No option groups yet. Create one when customers need to choose item variations.</p>
        : <div className="vendor-menu-management__items">
          {groups.map((group) => <article className="vendor-option-group__row" key={group.id}>
            <div className="vendor-option-group__copy">
              <strong>{group.name}</strong>
              <span>{group.selection_type === 'single' ? 'Choose one' : 'Choose multiple'} · {group.is_required ? 'Required' : 'Optional'} · {group.options.length} choices</span>
              <small>{group.options.map((option) => `${option.name}${Number(option.price_delta) > 0 ? ` (+${Number(option.price_delta).toFixed(2)})` : ''}`).join(' · ')}</small>
            </div>
            <div className="vendor-menu-item__actions">
              <button type="button" className="vendor-menu-item__action" disabled={busy} onClick={() => setEditing(group)}><IconPencil size={16} />Edit</button>
              <button type="button" className="vendor-menu-item__action vendor-menu-item__action--archive" disabled={busy} onClick={() => archive(group)}><IconTrash size={16} />Archive</button>
            </div>
          </article>)}
          <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} totalItems={pagination.total} itemsPerPage={pagination.limit} label="option groups" onPageChange={setPage} />
        </div>}
    {editing && <VendorOptionGroupEditor vendorId={vendorId} token={token} group={editing.isNew ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setNotice(editing.isNew ? 'Option group created.' : 'Option group updated.'); load(); }} />}
  </section>;
}
