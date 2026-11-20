import { useEffect, useRef, useState } from 'react';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import CustomDropdown from '../../components/ui/CustomDropdown.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import ModalProgressOverlay from '../admin/ModalProgressOverlay.jsx';
import {
  createVendorOptionGroup,
  updateVendorOptionGroup,
} from '../../services/vendorApi.js';
import './vendor-catalogue-configuration.css';

const statusValue = (value) => ({ id: value, name: value === 'single' ? 'Choose one' : 'Choose multiple' });

function FieldLabel({ children, htmlFor }) {
  return <label className="vendor-config-field__label" htmlFor={htmlFor}>{children}</label>;
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
  const optionListRef = useRef(null);
  const previousOptionCount = useRef(form.options.length);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateOption = (index, key, value) => setForm((current) => ({ ...current, options: current.options.map((option, optionIndex) => optionIndex === index ? { ...option, [key]: value } : option) }));
  const addChoice = () => update('options', [...form.options, { name: '', price_delta: 0, max_quantity: 1 }]);

  useEffect(() => {
    if (form.options.length > previousOptionCount.current) {
      const rows = optionListRef.current?.querySelectorAll('.vendor-config-option-row');
      const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      rows?.[rows.length - 1]?.scrollIntoView({ block: 'nearest', behavior });
    }
    previousOptionCount.current = form.options.length;
  }, [form.options.length]);

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
    <form className="admin-modal__card vendor-config-modal" onSubmit={submit}>
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
        <div className="vendor-config-options-heading"><div><h4>Choices</h4><p>Set any additional price for each choice.</p></div><button type="button" className="vendor-config-add-option" disabled={busy || form.options.length >= 50} onClick={addChoice}><IconPlus size={16} />Add choice</button></div>
        <div className="vendor-config-option-list" ref={optionListRef}>
          <div className="vendor-config-option-head">
            <span>Choice</span>
            <span>Price change</span>
            <span>Max qty</span>
            <span />
          </div>
          {form.options.map((option, index) => <div className="vendor-config-option-row" key={option.id || `new-${index}`}>
            <input id={`option-name-${index}`} className="admin-input" aria-label={`Choice ${index + 1} name`} maxLength={100} value={option.name} disabled={busy} onChange={(event) => updateOption(index, 'name', event.target.value)} />
            <input id={`option-price-${index}`} className="admin-input" aria-label={`Choice ${index + 1} price change`} type="number" min="0" step="0.01" value={option.price_delta} disabled={busy} onChange={(event) => updateOption(index, 'price_delta', event.target.value)} />
            <input id={`option-quantity-${index}`} className="admin-input" aria-label={`Choice ${index + 1} maximum quantity`} type="number" min="1" max="99" value={option.max_quantity} disabled={busy} onChange={(event) => updateOption(index, 'max_quantity', event.target.value)} />
            <button type="button" className="vendor-config-remove-option" aria-label={`Remove ${option.name || 'choice'}`} disabled={busy || form.options.length <= 1} onClick={() => update('options', form.options.filter((_, choiceIndex) => choiceIndex !== index))}><IconTrash size={16} /></button>
          </div>)}
        </div>
      </div>
      <footer className="admin-modal__foot"><PrimaryButton type="button" disabled={busy} onClick={onClose}>Cancel</PrimaryButton><PrimaryButton type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save option group' : 'Create option group'}</PrimaryButton></footer>
      <ModalProgressOverlay
        active={busy}
        messages={editing
          ? ['Updating option group...', 'Saving your choices...', 'Almost there...']
          : ['Creating option group...', 'Saving your choices...', 'Almost there...']}
      />
    </form>
  </div>;
}
