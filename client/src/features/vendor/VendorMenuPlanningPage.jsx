import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconArrowLeft, IconCalendar, IconCategory, IconChevronDown, IconCopy, IconList, IconMapPin, IconPlus, IconSoup, IconTrash } from '@tabler/icons-react';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import {
  addItemToVendorMenu,
  archiveVendorMenuItem,
  copyVendorMenuPlan,
  createVendorCatalogItem,
  createVendorMenuPlan,
  createVendorMenuCategory,
  listVendorMenuPlanCategories,
  listVendorMenuCatalog,
  listVendorMenuPlans,
  removeItemFromVendorMenu,
  updateVendorMenuCategory,
  updateVendorMenuItem,
  updateVendorMenuItemStatus,
  updateVendorMenuPlan,
  uploadVendorMenuItemAsset,
} from '../../services/vendorApi.js';
import { formatMoney, formatStatus } from './components/VendorDashboardComponents.jsx';
import { VendorMenuPlanningSkeleton } from './VendorLoadingSkeletons.jsx';
import { CategoryModal, MenuItemModal } from '../admin/VendorForms.jsx';
import './vendor-operations.css';
import './vendor-menu-planning.css';

function johannesburgDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(date, offset) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

const CATALOG_PAGE_SIZE = 8;
const EMPTY_PAGINATION = { page: 1, limit: CATALOG_PAGE_SIZE, total: 0, totalPages: 1 };

export default function VendorMenuPlanningPage({ vendorId, vendorName, onBack }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const today = useMemo(johannesburgDate, []);
  const [locationId, setLocationId] = useState('');
  const [menuDate, setMenuDate] = useState(today);
  const [plan, setPlan] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [sourceMenuId, setSourceMenuId] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [categories, setCategories] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [formCategories, setFormCategories] = useState([]);
  const [categoriesPagination, setCategoriesPagination] = useState(EMPTY_PAGINATION);
  const [catalogPagination, setCatalogPagination] = useState(EMPTY_PAGINATION);
  const [categoriesPage, setCategoriesPage] = useState(1);
  const [catalogPage, setCatalogPage] = useState(1);
  const [categoriesState, setCategoriesState] = useState('idle');
  const [catalogState, setCatalogState] = useState('idle');
  const [categoriesError, setCategoriesError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [categoriesReload, setCategoriesReload] = useState(0);
  const [catalogReload, setCatalogReload] = useState(0);

  const loadPlan = useCallback(async (signal) => {
    if (!vendorId) return;
    try {
      const response = await listVendorMenuPlans(vendorId, {
        token,
        from: menuDate > shiftDate(today, 30) ? shiftDate(menuDate, -30) : shiftDate(today, -30),
        to: menuDate < shiftDate(today, 335) ? shiftDate(menuDate, 30) : shiftDate(today, 365),
        selectedDate: menuDate,
        signal,
      });
      setPlan(response);
      setLocationId((current) => response.locations.some((location) => location.id === current)
        ? current
        : response.locations[0]?.id || '');
      setLoadError('');
    } catch (error) {
      if (error.name !== 'AbortError') setLoadError(error.message || 'Could not load menu plans.');
    }
  }, [menuDate, today, token, vendorId]);

  const loadCategories = useCallback(async (page, signal) => {
    if (!vendorId) return;
    setCategoriesState('loading');
    setCategoriesError('');
    try {
      const response = await listVendorMenuPlanCategories(vendorId, { token, page, limit: CATALOG_PAGE_SIZE, signal });
      setCategories(response.categories || []);
      setCategoriesPagination(response.pagination || EMPTY_PAGINATION);
      setCategoriesError('');
      setCategoriesState('ready');
      const lastPage = Math.max(1, response.pagination?.totalPages || 1);
      if (page > lastPage) setCategoriesPage(lastPage);
    } catch (error) {
      if (error.name !== 'AbortError') {
        setCategoriesError(error.message || 'Could not load menu categories.');
        setCategoriesState('error');
      }
    }
  }, [token, vendorId]);

  const loadCatalog = useCallback(async (page, signal) => {
    if (!vendorId) return;
    setCatalogState('loading');
    setCatalogError('');
    try {
      const response = await listVendorMenuCatalog(vendorId, { token, page, limit: CATALOG_PAGE_SIZE, signal });
      setCatalog(response.catalog || []);
      setCatalogPagination(response.pagination || EMPTY_PAGINATION);
      setCatalogError('');
      setCatalogState('ready');
      const lastPage = Math.max(1, response.pagination?.totalPages || 1);
      if (page > lastPage) setCatalogPage(lastPage);
    } catch (error) {
      if (error.name !== 'AbortError') {
        setCatalogError(error.message || 'Could not load menu items.');
        setCatalogState('error');
      }
    }
  }, [token, vendorId]);

  async function loadFormCategories() {
    const firstPage = await listVendorMenuPlanCategories(vendorId, { token, page: 1, limit: 50 });
    const allCategories = firstPage.categories || [];
    for (let page = 2; page <= (firstPage.pagination?.totalPages || 1); page += 1) {
      const response = await listVendorMenuPlanCategories(vendorId, { token, page, limit: 50 });
      allCategories.push(...(response.categories || []));
    }
    setFormCategories(allCategories);
  }

  async function openItemModal(item = null) {
    setEditingItem(item);
    setShowNewItem(!item);
    setLoadError('');
    try {
      await loadFormCategories();
    } catch (error) {
      setLoadError(error.message || 'Could not load categories for the menu item form.');
    }
  }

  useEffect(() => {
    if (!vendorId) return undefined;
    const controller = new AbortController();
    setPlan(null);
    loadPlan(controller.signal);
    return () => controller.abort();
  }, [loadPlan, vendorId]);

  useEffect(() => {
    if (!categoriesExpanded || !vendorId) return undefined;
    const controller = new AbortController();
    loadCategories(categoriesPage, controller.signal);
    return () => controller.abort();
  }, [categoriesExpanded, categoriesPage, categoriesReload, loadCategories, vendorId]);

  useEffect(() => {
    if (!itemsExpanded || !vendorId) return undefined;
    const controller = new AbortController();
    loadCatalog(catalogPage, controller.signal);
    return () => controller.abort();
  }, [itemsExpanded, catalogPage, catalogReload, loadCatalog, vendorId]);

  const selectedVendor = vendorId ? { id: vendorId, name: vendorName || 'Vendor' } : null;
  const selectedLocation = plan?.locations.find((location) => location.id === locationId);
  const menu = plan?.menus.find((item) => item.vendor_location_id === locationId && item.menu_date === menuDate);
  const menuItemIds = new Set((menu?.items || []).map((item) => item.id));
  const availableItems = catalog.filter((item) => !menuItemIds.has(item.id));
  const sourceMenus = (plan?.menus || []).filter((item) =>
    item.vendor_location_id === locationId && item.menu_date !== menuDate && item.status !== 'archived',
  );
  const sourceMenu = sourceMenus.find((item) => item.id === sourceMenuId);

  async function runMutation(action, successMessage) {
    setBusy(true);
    setNotice('');
    try {
      await action();
      await loadPlan();
      setNotice(successMessage);
    } catch (error) {
      setNotice(error.message || 'The menu change could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  function handleCreateMenu() {
    if (!locationId || !selectedLocation) return;
    runMutation(async () => {
      await createVendorMenuPlan({
        vendor_location_id: locationId,
        menu_date: menuDate,
        name: `${selectedVendor?.name || 'Vendor'} menu`,
      }, { token });
    }, 'Draft menu created.');
  }

  function handleCopyMenu() {
    if (!sourceMenu) return;
    runMutation(async () => {
      await copyVendorMenuPlan(sourceMenu.id, { menu_date: menuDate }, { token });
      setSourceMenuId('');
    }, 'Menu copied as a draft. Review it before publishing.');
  }

  function handleMenuStatus(status) {
    if (!menu) return;
    if (status === 'archived' && !window.confirm('Archive this dated menu? It will no longer be available to customers.')) return;
    runMutation(
      () => updateVendorMenuPlan(menu.id, { status }, { token }),
      status === 'published' ? 'Menu published.' : status === 'draft' ? 'Menu returned to draft.' : 'Menu archived.',
    );
  }

  function handleAddItem(itemId) {
    if (!menu) return;
    runMutation(() => addItemToVendorMenu(menu.id, itemId, { token }), 'Item added to the draft menu.');
  }

  function handleRemoveItem(itemId) {
    if (!menu || !window.confirm('Remove this item from the draft menu?')) return;
    runMutation(() => removeItemFromVendorMenu(menu.id, itemId, { token }), 'Item removed from the draft menu.');
  }

  function handleItemStatus(itemId, status) {
    if (!menu) return;
    runMutation(
      () => updateVendorMenuItemStatus(menu.id, itemId, status, { token }),
      'Menu item availability updated.',
    );
  }

  async function handleCatalogSave(payload) {
    setBusy(true);
    setNotice('');
    setLoadError('');
    const { image_file: imageFile, ...itemPayload } = payload;
    const editing = !!editingItem;
    let saved = false;
    try {
      let itemId = editingItem?.id;
      if (editingItem) {
        await updateVendorMenuItem(itemId, itemPayload, { token });
      } else {
        const response = await createVendorCatalogItem(vendorId, itemPayload, { token });
        itemId = response?.menuItem?.id;
      }
      saved = true;
      if (imageFile) {
        if (!itemId) throw new Error('The saved item could not be identified for image upload.');
        await uploadVendorMenuItemAsset(itemId, imageFile, { token });
      }
      await loadPlan();
      await loadCatalog(catalogPage);
      setEditingItem(null);
      setShowNewItem(false);
      setNotice(editing ? 'Catalogue item updated.' : 'Catalogue item created.');
    } catch (error) {
      if (saved) {
        await loadCatalog(catalogPage);
        setEditingItem(null);
        setShowNewItem(false);
        setLoadError(`Menu item saved, but its image could not be uploaded: ${error.message}`);
      } else {
        setLoadError(error.message || 'Could not save this catalogue item.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCategoryCreate(payload) {
    setBusy(true);
    setNotice('');
    try {
      await createVendorMenuCategory(vendorId, payload, { token });
      setShowNewCategory(false);
      await loadCategories(categoriesPage);
      if (itemsExpanded) await loadCatalog(catalogPage);
      setNotice('Menu category created.');
    } catch (error) {
      setNotice(error.message || 'Could not create the category.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCategoryUpdate(categoryId, payload, successMessage) {
    setBusy(true);
    try {
      await updateVendorMenuCategory(vendorId, categoryId, payload, { token });
      setEditingCategory(null);
      await loadCategories(categoriesPage);
      if (itemsExpanded) await loadCatalog(catalogPage);
      setNotice(successMessage);
    } catch (error) {
      setNotice(error.message || 'Could not update the category.');
    } finally {
      setBusy(false);
    }
  }

  function handleCategoryArchive(category) {
    if (!window.confirm(`Archive “${category.name}”? Existing items will keep their category history.`)) return;
    handleCategoryUpdate(category.id, { is_active: false }, `${category.name} archived.`);
  }

  async function handleArchiveItem(item) {
    if (!window.confirm(`Archive “${item.name}”? It will no longer be available on menus.`)) return;
    setBusy(true);
    setNotice('');
    try {
      await archiveVendorMenuItem(item.id, { token });
      await loadPlan();
      await loadCatalog(catalogPage);
      setNotice(`${item.name} archived.`);
    } catch (error) {
      setNotice(error.message || 'Could not archive this menu item.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="vendor-menu-planning">
      <header className="vendor-menu-planning__heading">
        <div><p>Manager workspace</p><h2>Menu planning</h2><span>Build and publish date-specific menus for {selectedVendor?.name || 'your vendor'}.</span></div>
        <PrimaryButton size="sm" icon={IconArrowLeft} onClick={onBack}>Back to orders</PrimaryButton>
      </header>

      {loadError && <p className="vendor-menu-planning__alert" role="alert">{loadError}</p>}
      {notice && <p className="vendor-menu-planning__notice" role="status">{notice}</p>}
      {!plan && !loadError && <VendorMenuPlanningSkeleton />}

      {plan && selectedVendor && <>
        <section className="vendor-menu-planning__controls" aria-label="Select menu location and date">
          <label className="vendor-menu-planning__field">
            <span>Location</span>
            <span className="vendor-menu-planning__input-wrap">
              <IconMapPin size={17} aria-hidden="true" />
              <select value={locationId} onChange={(event) => setLocationId(event.target.value)}>
                {plan.locations.map((location) => <option key={location.id} value={location.id}>
                  {[location.sites?.name, location.buildings?.name].filter(Boolean).join(' · ') || 'Vendor location'}
                </option>)}
              </select>
            </span>
          </label>
          <label className="vendor-menu-planning__field">
            <span>Menu date</span>
            <span className="vendor-menu-planning__input-wrap">
              <IconCalendar size={17} aria-hidden="true" />
              <input type="date" min={today} max={shiftDate(today, 365)} value={menuDate} onChange={(event) => {
                if (event.target.value) setMenuDate(event.target.value);
              }} />
            </span>
          </label>
        </section>

        {!selectedLocation ? <div className="vendor-menu-planning__empty">
          <h3>No active locations</h3>
          <p>Ask an administrator to add an active location before planning menus.</p>
        </div> : <section className="vendor-menu-planning__card">
          <header className="vendor-menu-planning__card-header">
            <span className="vendor-menu-planning__date-icon"><IconCalendar size={20} aria-hidden="true" /></span>
            <div className="vendor-menu-planning__date-copy">
              <p>{new Intl.DateTimeFormat('en-ZA', { dateStyle: 'full', timeZone: 'Africa/Johannesburg' }).format(new Date(`${menuDate}T12:00:00+02:00`))}</p>
              <h3>{menu?.name || 'No menu planned for this date'}</h3>
            </div>
            <span className={`vendor-menu-planning__status${menu ? ` vendor-menu-planning__status--${menu.status}` : ' vendor-menu-planning__status--empty'}`}>{menu ? formatStatus(menu.status) : 'Not planned'}</span>
          </header>

          {!menu ? <div className="vendor-menu-planning__empty-action">
            <div className="vendor-menu-planning__empty-copy">
              <strong>No menu for this date</strong>
              <p>Create a draft for this location and date, or copy a previous menu to get started.</p>
            </div>
            <div className="vendor-menu-planning__empty-actions">
              <PrimaryButton icon={IconPlus} disabled={busy} onClick={handleCreateMenu}>Create draft menu</PrimaryButton>
              {sourceMenus.length > 0 && <div className="vendor-menu-planning__copy">
                <label className="vendor-menu-planning__field">
                  Copy a previous menu
                  <select value={sourceMenuId} onChange={(event) => setSourceMenuId(event.target.value)}>
                    <option value="">Choose a menu</option>
                    {sourceMenus.map((source) => <option key={source.id} value={source.id}>{source.menu_date} · {source.name}</option>)}
                  </select>
                </label>
                <PrimaryButton icon={IconCopy} disabled={busy || !sourceMenuId} onClick={handleCopyMenu}>Copy as draft</PrimaryButton>
              </div>}
            </div>
          </div> : <>
            <div className="vendor-menu-planning__menu-actions">
              {menu.status === 'draft' && <PrimaryButton disabled={busy || !menu.items.some((item) => item.is_active && ['available', 'limited'].includes(item.status))} onClick={() => handleMenuStatus('published')}>Publish menu</PrimaryButton>}
              {menu.status === 'published' && menuDate >= today && <PrimaryButton disabled={busy} onClick={() => handleMenuStatus('draft')}>Unpublish to edit</PrimaryButton>}
              {menu.status !== 'archived' && menuDate >= today && <PrimaryButton className="primary-btn primary-btn--md vendor-menu-danger-button" disabled={busy} onClick={() => handleMenuStatus('archived')}>Archive menu</PrimaryButton>}
              {menu.status === 'draft' && <label className="vendor-menu-planning__field vendor-menu-planning__name">
                Menu name
                <input maxLength={120} value={menu.name} onChange={(event) => setPlan((current) => ({
                  ...current,
                  menus: current.menus.map((item) => item.id === menu.id ? { ...item, name: event.target.value } : item),
                }))} onBlur={() => updateVendorMenuPlan(menu.id, { name: menu.name }, { token }).catch((error) => setNotice(error.message || 'Could not update the menu name.'))} />
              </label>}
            </div>

            <div className="vendor-menu-planning__item-list">
              {!menu.items.length && <p className="vendor-menu-planning__empty-text">No items in this menu yet. Add items from the catalogue below.</p>}
              {menu.items.map((item) => <article className="vendor-menu-planning__item" key={item.id}>
                <div><strong>{item.name}</strong><span>{formatMoney(item.base_price, item.currency)}{!item.is_active && ' · Archived catalogue item'}</span></div>
                {menu.status === 'draft' && item.is_active && <div className="vendor-menu-planning__item-actions">
                  <label className="vendor-menu-planning__item-status">
                    Availability
                    <select value={item.status} disabled={busy} onChange={(event) => handleItemStatus(item.id, event.target.value)}>
                      {['available', 'limited', 'sold_out', 'unavailable'].map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
                    </select>
                  </label>
                  <button type="button" aria-label={`Remove ${item.name} from menu`} disabled={busy} onClick={() => handleRemoveItem(item.id)}><IconTrash size={17} /></button>
                </div>}
                {menu.status === 'draft' && !item.is_active && <button type="button" aria-label={`Remove ${item.name} from menu`} disabled={busy} onClick={() => handleRemoveItem(item.id)}><IconTrash size={17} /></button>}
              </article>)}
            </div>

            {menu.status === 'draft' && <div className="vendor-menu-planning__catalog-picker">
              <label className="vendor-menu-planning__field">
                Add catalogue item
                <select defaultValue="" disabled={busy || !availableItems.length} onChange={(event) => {
                  if (event.target.value) handleAddItem(event.target.value);
                  event.target.value = '';
                }}>
                  <option value="">{availableItems.length ? 'Choose an item' : 'All active items are on this menu'}</option>
                  {availableItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatMoney(item.base_price, item.currency)}</option>)}
                </select>
              </label>
            </div>}
          </>}
        </section>}

        <section className="vendor-menu-planning__catalog">
          <header className="vendor-menu-planning__catalog-heading">
            <div><p><IconSoup size={17} /> Reusable vendor items</p><h3>Menu setup</h3><span>Organize your categories and reusable items, then add them to dated menus.</span></div>
          </header>
          <section className={`vendor-menu-planning__accordion${categoriesExpanded ? ' is-expanded' : ''}`}>
            <button type="button" className="vendor-menu-planning__accordion-trigger" aria-expanded={categoriesExpanded} onClick={() => setCategoriesExpanded((expanded) => !expanded)}>
              <span className="vendor-menu-planning__accordion-icon"><IconCategory size={19} aria-hidden="true" /></span>
              <span className="vendor-menu-planning__accordion-copy"><strong>Categories</strong><span>Group items so customers can browse your menu easily.</span></span>
              <IconChevronDown className="vendor-menu-planning__accordion-chevron" size={18} aria-hidden="true" />
            </button>
            {categoriesExpanded && <div className="vendor-menu-planning__accordion-content vendor-menu-planning__categories">
              <div className="vendor-menu-planning__accordion-actions">
                <PrimaryButton size="sm" icon={IconPlus} onClick={() => setShowNewCategory(true)} disabled={busy}>Add category</PrimaryButton>
              </div>
              {categoriesState === 'loading' && <div className="vendor-menu-planning__lazy-skeleton" role="status" aria-label="Loading categories">{[1, 2, 3].map((row) => <Skeleton key={row} />)}</div>}
              {categoriesError && <p className="vendor-menu-planning__inline-error" role="alert">{categoriesError} <button type="button" onClick={() => setCategoriesReload((value) => value + 1)}>Retry</button></p>}
              {categoriesState === 'ready' && !categories.length && <p className="vendor-menu-planning__empty-text">No active categories yet.</p>}
              {categoriesState === 'ready' && categories.length > 0 && <div className="vendor-menu-planning__category-list">
                {categories.map((category) => <div className="vendor-menu-planning__category-row" key={category.id}>
                  <span>{category.name}</span>
                  <div><PrimaryButton size="sm" onClick={() => setEditingCategory(category)}>Rename</PrimaryButton>
                    <PrimaryButton size="sm" className="primary-btn primary-btn--sm vendor-menu-danger-button" onClick={() => handleCategoryArchive(category)}>Archive</PrimaryButton></div>
                </div>)}
                <Pagination currentPage={categoriesPagination.page} totalPages={categoriesPagination.totalPages} totalItems={categoriesPagination.total} itemsPerPage={categoriesPagination.limit} label="categories" onPageChange={setCategoriesPage} />
              </div>}
            </div>}
          </section>
          <section className={`vendor-menu-planning__accordion${itemsExpanded ? ' is-expanded' : ''}`}>
            <button type="button" className="vendor-menu-planning__accordion-trigger" aria-expanded={itemsExpanded} onClick={() => setItemsExpanded((expanded) => !expanded)}>
              <span className="vendor-menu-planning__accordion-icon"><IconList size={19} aria-hidden="true" /></span>
              <span className="vendor-menu-planning__accordion-copy"><strong>Menu items</strong><span>Reusable items are added to each dated menu separately.</span></span>
              <IconChevronDown className="vendor-menu-planning__accordion-chevron" size={18} aria-hidden="true" />
            </button>
            {itemsExpanded && <div className="vendor-menu-planning__accordion-content vendor-menu-planning__catalog-items">
              <div className="vendor-menu-planning__accordion-actions">
                <PrimaryButton size="sm" icon={IconPlus} onClick={() => openItemModal()}>Add item</PrimaryButton>
              </div>
              {catalogState === 'loading' && <div className="vendor-menu-planning__catalog-skeleton" role="status" aria-label="Loading menu items">{[1, 2, 3, 4].map((row) => <Skeleton key={row} />)}</div>}
              {catalogError && <p className="vendor-menu-planning__inline-error" role="alert">{catalogError} <button type="button" onClick={() => setCatalogReload((value) => value + 1)}>Retry</button></p>}
              {catalogState === 'ready' && !catalog.length ? <p className="vendor-menu-planning__empty-text">Create catalogue items, then add them to one or more dated menus.</p> :
                catalogState === 'ready' && catalog.map((item) => <article className="vendor-menu-planning__catalog-item" key={item.id}>
                  <div><strong>{item.name}</strong><span>{item.menu_categories?.name || 'Uncategorized'} · {formatMoney(item.base_price, item.currency)}</span></div>
                  <div className="vendor-menu-planning__catalog-actions">
                    <PrimaryButton size="sm" onClick={() => openItemModal(item)}>Edit</PrimaryButton>
                    <PrimaryButton size="sm" className="primary-btn primary-btn--sm vendor-menu-danger-button" onClick={() => handleArchiveItem(item)}>Archive</PrimaryButton>
                  </div>
                </article>)}
              {catalogState === 'ready' && catalog.length > 0 && <Pagination currentPage={catalogPagination.page} totalPages={catalogPagination.totalPages} totalItems={catalogPagination.total} itemsPerPage={catalogPagination.limit} label="menu items" onPageChange={setCatalogPage} />}
            </div>}
          </section>
        </section>
      </>}

      {(editingItem || showNewItem) && <MenuItemModal
        item={editingItem}
        categories={formCategories}
        submitting={busy}
        usePrimaryButtons
        onClose={() => { setEditingItem(null); setShowNewItem(false); }}
        onSubmit={handleCatalogSave}
      />}
      {(editingCategory || showNewCategory) && <CategoryModal
        category={editingCategory}
        submitting={busy}
        usePrimaryButtons
        onClose={() => { setEditingCategory(null); setShowNewCategory(false); }}
        onSubmit={(payload) => {
          if (editingCategory) handleCategoryUpdate(editingCategory.id, payload, 'Category updated.');
          else handleCategoryCreate(payload);
        }}
      />}
    </div>;
}
