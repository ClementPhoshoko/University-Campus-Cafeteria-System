import { useCallback, useEffect, useState } from 'react';
import { IconArrowLeft, IconCategory, IconList, IconPlus, IconTrash } from '@tabler/icons-react';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import {
  archiveVendorMenuItem,
  createVendorCatalogItem,
  createVendorMenuCategory,
  deleteVendorMenuCategory,
  listVendorMenuCatalog,
  listVendorMenuCategories,
  updateVendorMenuCategory,
  updateVendorMenuItem,
  uploadVendorMenuItemAsset,
} from '../../services/vendorApi.js';
import { formatMoney } from './components/VendorDashboardComponents.jsx';
import { MenuItemModal, CategoryModal } from '../admin/VendorForms.jsx';
import './vendor-menu-management.css';

const PAGE_SIZE = 8;
const EMPTY_PAGINATION = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 };

function PageSkeleton() {
  return <div className="vendor-menu-management__skeleton" role="status" aria-label="Loading menu management">
    <Skeleton className="home_card-skeleton-shimmer" />
    <Skeleton className="home_card-skeleton-shimmer" />
    <Skeleton className="home_card-skeleton-shimmer" />
  </div>;
}

export default function VendorMenuManagementPage({ vendorId, vendorName, onBack }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [categoriesPage, setCategoriesPage] = useState(1);
  const [itemsPage, setItemsPage] = useState(1);
  const [categoriesPagination, setCategoriesPagination] = useState(EMPTY_PAGINATION);
  const [itemsPagination, setItemsPagination] = useState(EMPTY_PAGINATION);
  const [categoriesState, setCategoriesState] = useState('loading');
  const [itemsState, setItemsState] = useState('loading');
  const [categoriesError, setCategoriesError] = useState('');
  const [itemsError, setItemsError] = useState('');
  const [pageError, setPageError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [formCategories, setFormCategories] = useState([]);

  const loadCategories = useCallback(async (page, signal) => {
    if (!vendorId) return;
    setCategoriesState('loading');
    setCategoriesError('');
    try {
      const response = await listVendorMenuCategories(vendorId, { token, page, limit: PAGE_SIZE, signal });
      setCategories(response.categories || []);
      setCategoriesPagination(response.pagination || EMPTY_PAGINATION);
      setCategoriesState('ready');
      const lastPage = Math.max(1, response.pagination?.totalPages || 1);
      setCategoriesPage((current) => current > lastPage ? lastPage : current);
    } catch (error) {
      if (error.name !== 'AbortError') {
        setCategoriesError(error.message || 'Could not load categories.');
        setCategoriesState('error');
      }
    }
  }, [token, vendorId]);

  const loadItems = useCallback(async (page, signal) => {
    if (!vendorId) return;
    setItemsState('loading');
    setItemsError('');
    try {
      const response = await listVendorMenuCatalog(vendorId, { token, page, limit: PAGE_SIZE, signal });
      setItems(response.catalog || []);
      setItemsPagination(response.pagination || EMPTY_PAGINATION);
      setItemsState('ready');
      const lastPage = Math.max(1, response.pagination?.totalPages || 1);
      setItemsPage((current) => current > lastPage ? lastPage : current);
    } catch (error) {
      if (error.name !== 'AbortError') {
        setItemsError(error.message || 'Could not load menu items.');
        setItemsState('error');
      }
    }
  }, [token, vendorId]);

  useEffect(() => {
    if (!vendorId) return undefined;
    const controller = new AbortController();
    loadCategories(categoriesPage, controller.signal);
    return () => controller.abort();
  }, [categoriesPage, loadCategories, vendorId]);

  useEffect(() => {
    if (!vendorId) return undefined;
    const controller = new AbortController();
    loadItems(itemsPage, controller.signal);
    return () => controller.abort();
  }, [itemsPage, loadItems, vendorId]);

  async function loadFormCategories() {
    const first = await listVendorMenuCategories(vendorId, { token, page: 1, limit: 50 });
    const allCategories = first.categories || [];
    for (let page = 2; page <= (first.pagination?.totalPages || 1); page += 1) {
      const response = await listVendorMenuCategories(vendorId, { token, page, limit: 50 });
      allCategories.push(...(response.categories || []));
    }
    setFormCategories(allCategories);
  }

  async function openItemModal(item = null) {
    setPageError('');
    try {
      await loadFormCategories();
      setEditingItem(item);
      setShowNewItem(!item);
    } catch (error) {
      setPageError(error.message || 'Could not load categories for the item form.');
    }
  }

  async function saveItem(payload) {
    setBusy(true);
    setPageError('');
    setNotice('');
    const { image_file: imageFile, ...itemPayload } = payload;
    let saved = false;
    let imageUploadFailed = false;
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
        imageUploadFailed = true;
        await uploadVendorMenuItemAsset(itemId, imageFile, { token });
      }
      const page = editingItem ? itemsPage : 1;
      if (page !== itemsPage) setItemsPage(page);
      else await loadItems(page);
      setEditingItem(null);
      setShowNewItem(false);
      setNotice(editingItem ? 'Menu item updated.' : 'Menu item added to the vendor catalogue.');
    } catch (error) {
      if (saved) {
        const page = editingItem ? itemsPage : 1;
        if (page !== itemsPage) setItemsPage(page);
        else await loadItems(page);
        setEditingItem(null);
        setShowNewItem(false);
        setPageError(imageUploadFailed
          ? `The item was saved, but its image could not be uploaded: ${error.message}`
          : `The item was saved, but the list could not be refreshed: ${error.message}`);
      } else {
        setPageError(error.message || 'Could not save this menu item.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveCategory(payload) {
    setBusy(true);
    setPageError('');
    setNotice('');
    try {
      if (editingCategory) {
        await updateVendorMenuCategory(vendorId, editingCategory.id, payload, { token });
      } else {
        await createVendorMenuCategory(vendorId, payload, { token });
      }
      const page = editingCategory ? categoriesPage : 1;
      if (page !== categoriesPage) setCategoriesPage(page);
      else await loadCategories(page);
      if (editingCategory) await loadItems(itemsPage);
      setEditingCategory(null);
      setShowNewCategory(false);
      setNotice(editingCategory ? 'Category updated.' : 'Category added.');
    } catch (error) {
      setPageError(error.message || 'Could not save this category.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(category) {
    if (!window.confirm(`Delete “${category.name}”? Items in it will become uncategorized.`)) return;
    setBusy(true);
    setPageError('');
    setNotice('');
    try {
      await deleteVendorMenuCategory(vendorId, category.id, { token });
      await loadCategories(categoriesPage);
      await loadItems(itemsPage);
      setNotice(`${category.name} deleted.`);
    } catch (error) {
      setPageError(error.message || 'Could not delete this category.');
    } finally {
      setBusy(false);
    }
  }

  async function archiveItem(item) {
    if (!window.confirm(`Archive “${item.name}”? It will no longer be available for future menus.`)) return;
    setBusy(true);
    setPageError('');
    setNotice('');
    try {
      await archiveVendorMenuItem(item.id, { token });
      await loadItems(itemsPage);
      setNotice(`${item.name} archived.`);
    } catch (error) {
      setPageError(error.message || 'Could not archive this menu item.');
    } finally {
      setBusy(false);
    }
  }

  const initialLoading = categoriesState === 'loading' && itemsState === 'loading'
    && !categories.length && !items.length;

  return <div className="vendor-menu-management">
    <header className="vendor-menu-management__heading">
      <div>
        <p>Manager workspace</p>
        <h2>Menu &amp; categories</h2>
        <span>Manage the reusable menu items and categories for {vendorName || 'your vendor'}.</span>
      </div>
      <PrimaryButton size="sm" icon={IconArrowLeft} onClick={onBack}>Back to dashboard</PrimaryButton>
    </header>

    {notice && <p className="vendor-menu-management__notice" role="status">{notice}</p>}
    {pageError && <p className="vendor-menu-management__error" role="alert">{pageError}</p>}
    {initialLoading ? <PageSkeleton /> : <>
      <section className="vendor-menu-management__section">
        <header className="vendor-menu-management__section-heading">
          <div className="vendor-menu-management__section-title">
            <span><IconCategory size={19} /></span>
            <div><h3>Categories</h3><p>Organize your items so customers can browse them easily.</p></div>
          </div>
          <PrimaryButton size="sm" icon={IconPlus} disabled={busy} onClick={() => setShowNewCategory(true)}>Add category</PrimaryButton>
        </header>
        {categoriesState === 'error' && <p className="vendor-menu-management__inline-error" role="alert">{categoriesError} <button type="button" onClick={() => loadCategories(categoriesPage)}>Retry</button></p>}
        {categoriesState === 'loading' && <PageSkeleton />}
        {categoriesState === 'ready' && !categories.length && <p className="vendor-menu-management__empty">No categories yet. Add one to organize your menu items.</p>}
        {categoriesState === 'ready' && categories.length > 0 && <>
          <div className="vendor-menu-management__rows">
            {categories.map((category) => <article className="vendor-menu-management__row" key={category.id}>
              <div><strong>{category.name}</strong></div>
              <div className="vendor-menu-management__actions">
                <PrimaryButton size="sm" disabled={busy} onClick={() => setEditingCategory(category)}>Edit</PrimaryButton>
                <PrimaryButton size="sm" className="primary-btn primary-btn--sm vendor-menu-danger-button" disabled={busy} onClick={() => deleteCategory(category)}><IconTrash size={15} /> Delete</PrimaryButton>
              </div>
            </article>)}
          </div>
          <Pagination currentPage={categoriesPagination.page} totalPages={categoriesPagination.totalPages} totalItems={categoriesPagination.total} itemsPerPage={categoriesPagination.limit} label="categories" onPageChange={setCategoriesPage} />
        </>}
      </section>

      <section className="vendor-menu-management__section">
        <header className="vendor-menu-management__section-heading">
          <div className="vendor-menu-management__section-title">
            <span><IconList size={19} /></span>
            <div><h3>Menu items</h3><p>Add and maintain the reusable items belonging to this vendor.</p></div>
          </div>
          <PrimaryButton size="sm" icon={IconPlus} disabled={busy} onClick={() => openItemModal()}>Add item</PrimaryButton>
        </header>
        {itemsState === 'error' && <p className="vendor-menu-management__inline-error" role="alert">{itemsError} <button type="button" onClick={() => loadItems(itemsPage)}>Retry</button></p>}
        {itemsState === 'loading' && <PageSkeleton />}
        {itemsState === 'ready' && !items.length && <p className="vendor-menu-management__empty">No menu items yet. Add an item to this vendor’s reusable catalogue.</p>}
        {itemsState === 'ready' && items.length > 0 && <>
          <div className="vendor-menu-management__items">
            {items.map((item) => <article className="vendor-menu-management__row" key={item.id}>
              <div className="vendor-menu-management__item-copy">
                <strong>{item.name}</strong>
                <span>{item.menu_categories?.name || 'Uncategorized'} · {formatMoney(item.base_price, item.currency)}</span>
              </div>
              <div className="vendor-menu-management__actions">
                <PrimaryButton size="sm" disabled={busy} onClick={() => openItemModal(item)}>Edit</PrimaryButton>
                <PrimaryButton size="sm" className="primary-btn primary-btn--sm vendor-menu-danger-button" disabled={busy} onClick={() => archiveItem(item)}><IconTrash size={15} /> Archive</PrimaryButton>
              </div>
            </article>)}
          </div>
          <Pagination currentPage={itemsPagination.page} totalPages={itemsPagination.totalPages} totalItems={itemsPagination.total} itemsPerPage={itemsPagination.limit} label="menu items" onPageChange={setItemsPage} />
        </>}
      </section>
    </>}

    {(editingItem || showNewItem) && <MenuItemModal
      item={editingItem}
      categories={formCategories}
      submitting={busy}
      usePrimaryButtons
      title={editingItem ? undefined : 'Add vendor menu item'}
      subtitle={editingItem ? undefined : 'Add this reusable item to your vendor catalogue. It will be available for customer menus when the existing menu workflow includes it.'}
      submitLabel={editingItem ? undefined : 'Add item'}
      onClose={() => { setEditingItem(null); setShowNewItem(false); }}
      onSubmit={saveItem}
    />}
    {(editingCategory || showNewCategory) && <CategoryModal
      category={editingCategory}
      submitting={busy}
      usePrimaryButtons
      onClose={() => { setEditingCategory(null); setShowNewCategory(false); }}
      onSubmit={saveCategory}
    />}
  </div>;
}
