import { useCallback, useEffect, useRef, useState } from 'react';
import { IconCheck, IconEdit, IconPhoto, IconPlus, IconUpload, IconX } from '@tabler/icons-react';
import SmartImage from '../../components/ui/SmartImage.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.webp';
import { useAuth } from '../../hooks/useAuth.js';
import useObjectPreview from '../../hooks/useObjectPreview.js';
import {
  createVendorCategoryCatalogEntry,
  listVendorCategoryCatalog,
  updateVendorCategoryCatalogEntry,
  uploadAdminAsset,
} from '../../services/adminApi.js';
import './vendor-categories.css';

const emptyForm = { name: '', imageFile: null, sort_order: 0, is_active: true };
const CATEGORIES_PER_PAGE = 8;

function getCategoryErrorMessage(error, fallback) {
  const message = error?.message?.trim();
  if (!message || /<(?:!doctype|html|head|body)\b/i.test(message)) return fallback;
  return message;
}

function CategoryListSkeleton() {
  return (
    <div className="admin-vendor-categories__skeleton-list" role="status" aria-label="Loading categories">
      {Array.from({ length: 3 }, (_, index) => (
        <div className="admin-vendor-categories__row" key={index}>
          <Skeleton className="admin-vendor-categories__skeleton-image" />
          <div className="admin-vendor-categories__skeleton-details">
            <Skeleton className="skeleton--text" style={{ width: '34%', height: 14 }} />
            <Skeleton className="skeleton--text" style={{ width: '52%', height: 11 }} />
          </div>
          <div className="admin-vendor-categories__skeleton-actions">
            <Skeleton className="skeleton--text" style={{ width: 54, height: 30 }} />
            <Skeleton className="skeleton--text" style={{ width: 54, height: 30 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminVendorCategoriesPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [imagePreview, setImagePreview] = useObjectPreview(null);
  const imageInputRef = useRef(null);
  const categoryListRef = useRef(null);
  const [categoryPage, setCategoryPage] = useState(1);
  const [loading, setLoading] = useState(Boolean(token));
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError('');
    try {
      const response = await listVendorCategoryCatalog(token);
      setCategories(response?.categories || []);
    } catch (loadError) {
      setLoadError(getCategoryErrorMessage(loadError, 'Unable to load vendor categories.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startEdit = (category) => {
    setEditing(category);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    setForm({
      name: category.name,
      imageFile: null,
      sort_order: category.sort_order || 0,
    });
    setError('');
    setSuccess('');
  };

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    setError('');
    setSuccess('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!editing && !form.imageFile) {
      setError('Choose an image for this category.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sort_order: Number(form.sort_order),
        ...(editing ? {} : { is_active: Boolean(form.is_active) }),
      };
      const response = editing
        ? await updateVendorCategoryCatalogEntry(token, editing.id, payload)
        : await createVendorCategoryCatalogEntry(token, payload);
      const categoryId = response?.category?.id || editing?.id;
      if (form.imageFile && categoryId) {
        await uploadAdminAsset(token, 'vendor_category', categoryId, form.imageFile);
      }
      if (!editing) setCategoryPage(1);
      setSuccess(editing ? 'Category updated.' : 'Category created.');
      resetForm();
    } catch (saveError) {
      setError(getCategoryErrorMessage(saveError, 'Unable to save this category.'));
    } finally {
      setSaving(false);
      await refresh();
    }
  };

  const toggleActive = async (category) => {
    setError('');
    setSuccess('');
    try {
      await updateVendorCategoryCatalogEntry(token, category.id, { is_active: !category.is_active });
      setSuccess(`${category.name} ${category.is_active ? 'hidden from' : 'shown in'} customer categories.`);
      await refresh();
    } catch (updateError) {
      setError(getCategoryErrorMessage(updateError, 'Unable to update category visibility.'));
    }
  };

  const totalCategoryPages = Math.max(1, Math.ceil(categories.length / CATEGORIES_PER_PAGE));
  const paginatedCategories = categories.slice(
    (categoryPage - 1) * CATEGORIES_PER_PAGE,
    categoryPage * CATEGORIES_PER_PAGE,
  );

  const changeCategoryPage = (page) => {
    setCategoryPage(page);
    categoryListRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (categoryPage > totalCategoryPages) {
      setCategoryPage(totalCategoryPages);
    }
  }, [categoryPage, totalCategoryPages]);

  return (
    <section className="admin-vendor-categories">
      <header className="admin-vendors__header admin-vendor-categories__header">
        <div>
          <span className="admin-card__eyebrow">Customer catalog</span>
          <p className="admin-vendors__sub">Manage shared categories, their Home-page images, and which categories vendors can select.</p>
        </div>
      </header>

      <form className="admin-card admin-vendor-categories__form" onSubmit={submit}>
        <header className="admin-card__head admin-card__head--inline">
          <div>
            <span className="admin-card__eyebrow">{editing ? 'Update catalog' : 'Catalog setup'}</span>
            <h2 className="admin-card__title admin-vendor-categories__section-title">
              {editing ? 'Edit category' : 'Add category'}
            </h2>
          </div>
          {editing && (
            <button type="button" className="admin-action admin-action--ghost" onClick={resetForm}>
              <IconX size={16} /> Cancel
            </button>
          )}
        </header>
        <div className="admin-vendor-categories__form-grid">
          <div className="admin-vendor-categories__form-fields">
            <label className="admin-modal__field">
              <span>Category name</span>
              <input
                className="admin-input"
                value={form.name}
                maxLength={80}
                required
                placeholder="e.g. Coffee & tea"
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="admin-modal__field admin-vendor-categories__order-field">
              <span>Display order</span>
              <input
                className="admin-input"
                type="number"
                step="1"
                value={form.sort_order}
                onChange={(event) => setForm((current) => ({ ...current, sort_order: Number(event.target.value) }))}
              />
              <span className="admin-vendor-categories__field-hint">Lower numbers appear first.</span>
            </label>
          </div>
          <div className="admin-modal__field admin-vendor-categories__image-field">
            <span>Home image</span>
            <label className={`admin-vendor-categories__upload${imagePreview || editing?.image_url ? ' admin-vendor-categories__upload--has-image' : ''}`}>
              <input
                ref={imageInputRef}
                className="admin-vendor-categories__upload-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/tiff,image/gif"
                required={!editing}
                onChange={(event) => {
                  const imageFile = event.target.files?.[0] || null;
                  setForm((current) => ({ ...current, imageFile }));
                  setImagePreview(imageFile);
                }}
              />
              <span className="admin-vendor-categories__upload-preview">
                {imagePreview || editing?.image_url ? (
                  <img src={imagePreview || editing.image_url} alt="" />
                ) : (
                  <IconPhoto size={24} stroke={1.5} />
                )}
              </span>
              <span className="admin-vendor-categories__upload-copy">
                <strong>{form.imageFile?.name || (editing?.image_url ? 'Current category image' : 'Choose an image')}</strong>
                <span>{form.imageFile ? 'Selected for upload' : 'Add an image shown on the customer Home page.'}</span>
                <span className="admin-vendor-categories__upload-hint">JPEG, PNG, WebP, AVIF, TIFF or still GIF · 32–6,000 px per side · Max 7 MB</span>
              </span>
              <span className="admin-vendor-categories__choose-file">
                <IconUpload size={15} stroke={1.8} />
                Choose file
              </span>
            </label>
          </div>
        </div>
        <footer className="admin-vendor-categories__form-footer">
          <button type="submit" className="admin-action admin-action--approve admin-vendor-categories__submit" disabled={saving || !form.name.trim()}>
            {editing ? <IconCheck size={16} /> : <IconPlus size={16} />}
            {saving ? 'Saving…' : editing ? 'Save category' : 'Add category'}
          </button>
          {error && <p className="admin-vendor-categories__error" role="alert">{error}</p>}
          {success && <p className="admin-vendor-categories__success" role="status">{success}</p>}
        </footer>
      </form>

      <section className="admin-card admin-vendor-categories__list">
        <header className="admin-card__head admin-card__head--inline">
          <div>
            <span className="admin-card__eyebrow">Customer catalog</span>
            <h2 className="admin-card__title admin-vendor-categories__section-title">Managed categories</h2>
          </div>
          {loading ? (
            <Skeleton className="skeleton--text" style={{ width: 76, height: 12 }} />
          ) : !loadError ? (
            <span className="admin-vendor-categories__count">{categories.length} categories</span>
          ) : null}
        </header>
        {loading ? (
          <CategoryListSkeleton />
        ) : loadError ? (
          <div className="admin-vendor-categories__load-error" role="alert">
            <p>{loadError}</p>
            <button type="button" className="admin-action admin-action--ghost" onClick={refresh}>
              Try again
            </button>
          </div>
        ) : categories.length ? (
          <>
            <div
              className="admin-table-wrap admin-vendor-categories__scroll"
              ref={categoryListRef}
              role="region"
              aria-label="Managed vendor categories"
              tabIndex={0}
            >
              {paginatedCategories.map((category) => (
                <article className="admin-vendor-categories__row" key={category.id}>
                  <SmartImage
                    src={category.image_url}
                    alt=""
                    className="admin-vendor-categories__image"
                    width={92}
                    height={72}
                  />
                  <div className="admin-vendor-categories__details">
                    <strong>{category.name}</strong>
                    <span>
                      {category.is_active ? 'Visible' : 'Hidden'} · {category.assigned_vendor_count || 0} vendors · Order {category.sort_order}
                    </span>
                  </div>
                  <div className="admin-vendor-categories__actions">
                    <button type="button" className="admin-action admin-action--ghost" onClick={() => startEdit(category)}>
                      <IconEdit size={16} /> Edit
                    </button>
                    <button type="button" className="admin-action admin-action--ghost" onClick={() => toggleActive(category)}>
                      {category.is_active ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <Pagination
              currentPage={categoryPage}
              totalPages={totalCategoryPages}
              totalItems={categories.length}
              itemsPerPage={CATEGORIES_PER_PAGE}
              label="categories"
              onPageChange={changeCategoryPage}
            />
          </>
        ) : (
          <div className="admin-empty">
            <img src={emptyStateAvatar} alt="" className="admin-empty__avatar" />
            <h3>No categories yet</h3>
            <p>Add a category above to make it available in vendor forms and on Home.</p>
          </div>
        )}
      </section>
    </section>
  );
}
