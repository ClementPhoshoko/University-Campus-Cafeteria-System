import { useEffect, useState } from 'react';
import { IconRefresh } from '@tabler/icons-react';
import Pagination from '../../components/ui/Pagination.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import {
  getVendorMenuItemConfiguration,
  listVendorMenuMetadataOptions,
  listVendorOptionGroups,
  updateVendorMenuItemConfiguration,
} from '../../services/vendorApi.js';
import './vendor-catalogue-configuration.css';

const PAGE_SIZE = 8;
const SECTIONS = [
  { id: 'dietary', label: 'Dietary' },
  { id: 'allergens', label: 'Allergens' },
  { id: 'options', label: 'Customer options' },
];

function ConfigurationSectionSkeleton({ rows = 4 }) {
  return <div className="vendor-config-skeleton-list" role="status" aria-label="Loading section details" aria-busy="true">
    {Array.from({ length: rows }, (_, index) => <div className="vendor-config-skeleton-row" key={index}>
      <Skeleton className="vendor-config-skeleton-row__indicator" />
      <div className="vendor-config-skeleton-row__copy"><Skeleton className="vendor-config-skeleton-row__title" /><Skeleton className="vendor-config-skeleton-row__description" /></div>
    </div>)}
  </div>;
}

export default function VendorMenuItemConfigurationModal({ item, token, onClose, onSaved }) {
  const [activeSection, setActiveSection] = useState('dietary');
  const [sectionLoaded, setSectionLoaded] = useState({});
  const [sectionLoading, setSectionLoading] = useState({ dietary: false, allergens: false, options: false });
  const [sectionErrors, setSectionErrors] = useState({});
  const [retryVersion, setRetryVersion] = useState(0);
  const [metadata, setMetadata] = useState({ dietary_tags: [], allergens: [] });
  const [dietaryIds, setDietaryIds] = useState([]);
  const [allergens, setAllergens] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupIds, setGroupIds] = useState([]);
  const [groupsPagination, setGroupsPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [groupPage, setGroupPage] = useState(1);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [hasInactiveDietary, setHasInactiveDietary] = useState(false);
  const [hasInactiveAllergens, setHasInactiveAllergens] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (sectionLoaded[activeSection]) return undefined;
    const controller = new AbortController();

    async function loadActiveSection() {
      setSectionLoading((current) => ({ ...current, [activeSection]: true }));
      setSectionErrors((current) => ({ ...current, [activeSection]: '' }));
      if (activeSection === 'options') setGroupsLoading(true);
      try {
        const [metadataResponse, configurationResponse, groupResponse] = await Promise.all([
          activeSection === 'options'
            ? Promise.resolve(null)
            : listVendorMenuMetadataOptions(item.vendor_id, {
              token,
              signal: controller.signal,
              type: activeSection === 'dietary' ? 'dietary_tag' : 'allergen',
            }),
          getVendorMenuItemConfiguration(item.id, { token, signal: controller.signal, section: activeSection }),
          activeSection === 'options'
            ? listVendorOptionGroups(item.vendor_id, { token, page: groupPage, limit: PAGE_SIZE, signal: controller.signal })
            : Promise.resolve(null),
        ]);
        const configuration = configurationResponse.configuration || {};

        if (activeSection === 'dietary') {
          const tags = metadataResponse.dietary_tags || [];
          const availableIds = new Set(tags.map((tag) => tag.id));
          setMetadata((current) => ({ ...current, dietary_tags: tags }));
          setDietaryIds((configuration.dietary_tags || []).map((tag) => tag.id).filter((id) => availableIds.has(id)));
          setHasInactiveDietary((configuration.dietary_tags || []).some((tag) => !availableIds.has(tag.id)));
        } else if (activeSection === 'allergens') {
          const entries = metadataResponse.allergens || [];
          const availableIds = new Set(entries.map((allergen) => allergen.id));
          setMetadata((current) => ({ ...current, allergens: entries }));
          setAllergens((configuration.allergens || [])
            .filter((allergen) => availableIds.has(allergen.id))
            .map((allergen) => ({ id: allergen.id, vendor_notice: allergen.vendor_notice || '' })));
          setHasInactiveAllergens((configuration.allergens || []).some((allergen) => !availableIds.has(allergen.id)));
        } else {
          setGroupIds((configuration.option_groups || []).filter((group) => group.is_active).map((group) => group.id));
          setGroups(groupResponse.option_groups || []);
          setGroupsPagination(groupResponse.pagination || { page: groupPage, limit: PAGE_SIZE, total: 0, totalPages: 1 });
        }
        setSectionLoaded((current) => ({ ...current, [activeSection]: true }));
      } catch (error) {
        if (error.name !== 'AbortError') {
          setSectionErrors((current) => ({ ...current, [activeSection]: error.message || `Could not load ${activeSection} details.` }));
        }
      } finally {
        if (!controller.signal.aborted) {
          setSectionLoading((current) => ({ ...current, [activeSection]: false }));
          if (activeSection === 'options') setGroupsLoading(false);
        }
      }
    }

    loadActiveSection();
    return () => controller.abort();
  }, [activeSection, groupPage, item.id, item.vendor_id, retryVersion, sectionLoaded, token]);

  useEffect(() => {
    if (activeSection !== 'options' || !sectionLoaded.options || groupsPagination.page === groupPage) return undefined;
    const controller = new AbortController();
    setGroupsLoading(true);
    listVendorOptionGroups(item.vendor_id, { token, page: groupPage, limit: PAGE_SIZE, signal: controller.signal })
      .then((response) => {
        setGroups(response.option_groups || []);
        setGroupsPagination(response.pagination || { page: groupPage, limit: PAGE_SIZE, total: 0, totalPages: 1 });
        setSectionErrors((current) => ({ ...current, options: '' }));
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setSectionErrors((current) => ({ ...current, options: error.message || 'Could not load option groups.' }));
      })
      .finally(() => { if (!controller.signal.aborted) setGroupsLoading(false); });
    return () => controller.abort();
  }, [activeSection, groupPage, groupsPagination.page, item.vendor_id, sectionLoaded.options, token]);

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
    if (saving || sectionLoading[activeSection] || !sectionLoaded[activeSection]) return;
    setSaving(true);
    setSaveError('');
    try {
      const payload = activeSection === 'dietary'
        ? { section: activeSection, dietary_tag_ids: dietaryIds }
        : activeSection === 'allergens'
          ? { section: activeSection, allergens }
          : { section: activeSection, option_group_ids: groupIds };
      await updateVendorMenuItemConfiguration(item.id, payload, { token });
      onSaved?.();
      onClose();
    } catch (error) {
      setSaveError(error.message || `Could not save ${activeSection} details.`);
    } finally {
      setSaving(false);
    }
  }

  const loadError = sectionErrors[activeSection];
  const isLoading = sectionLoading[activeSection];

  return <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="vendor-item-config-title">
    <button type="button" className="admin-modal__overlay" aria-label="Close item configuration" onClick={onClose} />
    <form className="admin-modal__card vendor-config-modal" onSubmit={save}>
      <header className="admin-modal__head">
        <div><h3 className="admin-modal__title" id="vendor-item-config-title">Item details</h3><p className="admin-modal__sub">{item.name}</p></div>
      </header>

      <div className="vendor-config-tabs" role="tablist" aria-label="Item details sections">
        {SECTIONS.map((section) => <button key={section.id} type="button" role="tab" aria-selected={activeSection === section.id}
          aria-controls={`vendor-config-panel-${section.id}`} id={`vendor-config-tab-${section.id}`}
          className={`vendor-config-tabs__tab${activeSection === section.id ? ' is-active' : ''}`}
          disabled={saving} onClick={() => { setActiveSection(section.id); setSaveError(''); }}>
          {section.label}
        </button>)}
      </div>

      <div className="admin-modal__body admin-modal__body--single vendor-config-modal__body" role="tabpanel"
        id={`vendor-config-panel-${activeSection}`} aria-labelledby={`vendor-config-tab-${activeSection}`}>
        {saveError && <p className="vendor-config-error" role="alert">{saveError}</p>}
        {loadError ? <div className="vendor-config-load-error" role="alert"><p>{loadError}</p><button type="button" className="vendor-config-retry" onClick={() => {
          setSectionLoaded((current) => ({ ...current, [activeSection]: false }));
          setSectionErrors((current) => ({ ...current, [activeSection]: '' }));
          setRetryVersion((current) => current + 1);
        }}><IconRefresh size={15} />Retry</button></div>
          : isLoading ? <ConfigurationSectionSkeleton rows={activeSection === 'options' ? 3 : 4} />
            : <section className="vendor-config-section">
              {activeSection === 'dietary' && <>
                <div className="vendor-config-section__heading"><h4>Dietary tags</h4><p>Choose all labels that describe this item.</p></div>
                {hasInactiveDietary && <p className="vendor-config-note">This item has a dietary label that an administrator deactivated. It will be removed when you save this section.</p>}
                {metadata.dietary_tags.length ? <div className="vendor-config-check-list">
                  {metadata.dietary_tags.map((tag) => <label className="vendor-config-check" key={tag.id}>
                    <input type="checkbox" checked={dietaryIds.includes(tag.id)} disabled={saving} onChange={() => toggleValue(dietaryIds, setDietaryIds, tag.id)} />
                    <span><strong>{tag.name}</strong>{tag.description && <small>{tag.description}</small>}</span>
                  </label>)}
                </div> : <p className="vendor-config-empty">No dietary labels are configured. Ask an administrator to add the required shared labels.</p>}
              </>}
              {activeSection === 'allergens' && <>
                <div className="vendor-config-section__heading"><h4>Allergens</h4><p>Add a clear notice where customers need extra guidance.</p></div>
                {hasInactiveAllergens && <p className="vendor-config-note">This item has an allergen label that an administrator deactivated. It will be removed when you save this section.</p>}
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
              </>}
              {activeSection === 'options' && <>
                <div className="vendor-config-section__heading"><h4>Customer options</h4><p>Choose reusable option groups for this item.</p></div>
                {groups.length ? <div className="vendor-config-check-list">
                  {groups.map((group) => <label className="vendor-config-check" key={group.id}>
                    <input type="checkbox" checked={groupIds.includes(group.id)} disabled={saving} onChange={() => toggleValue(groupIds, setGroupIds, group.id)} />
                    <span><strong>{group.name}</strong><small>{group.selection_type === 'single' ? 'Choose one' : 'Choose multiple'}{group.is_required ? ' · Required' : ' · Optional'} · {group.options.length} options</small></span>
                  </label>)}
                </div> : <p className="vendor-config-empty">Create an option group below before assigning customer choices to this item.</p>}
                {groupsLoading && <span className="vendor-config-inline-loading" role="status">Updating option groups…</span>}
                {groupsPagination.totalPages > 1 && <Pagination currentPage={groupsPagination.page} totalPages={groupsPagination.totalPages} totalItems={groupsPagination.total} itemsPerPage={groupsPagination.limit} label="option groups" onPageChange={setGroupPage} />}
              </>}
            </section>}
      </div>

      <footer className="admin-modal__foot">
        <PrimaryButton type="button" disabled={saving} onClick={onClose}>Cancel</PrimaryButton>
        <PrimaryButton type="submit" disabled={!sectionLoaded[activeSection] || isLoading || saving}>{saving ? 'Saving…' : `Save ${SECTIONS.find((section) => section.id === activeSection)?.label.toLowerCase()}`}</PrimaryButton>
      </footer>
    </form>
  </div>;
}
