import { useCallback, useEffect, useState } from 'react';
import { IconCheck, IconEdit, IconPlus, IconX } from '@tabler/icons-react';
import SmartImage from '../../components/ui/SmartImage.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.webp';
import { useAuth } from '../../hooks/useAuth.js';
import {
  createVendorCategoryCatalogEntry,
  listVendorCategoryCatalog,
  updateVendorCategoryCatalogEntry,
  uploadAdminAsset,
} from '../../services/adminApi.js';
import './vendor-categories.css';

const emptyForm = { name: '', imageFile: null, sort_order: 0, is_active: true };

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
    setForm({
      name: category.name,
      imageFile: null,
      sort_order: category.sort_order || 0,
      is_active: category.is_active,
    });
    setError('');
    setSuccess('');
  };

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
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
        is_active: Boolean(form.is_active),
      };
      const response = editing
        ? await updateVendorCategoryCatalogEntry(token, editing.id, payload)
        : await createVendorCategoryCatalogEntry(token, payload);
      const categoryId = response?.category?.id || editing?.id;
      if (form.imageFile && categoryId) {
        await uploadAdminAsset(token, 'vendor_category', categoryId, form.imageFile);
      }
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
        <div className="admin-vendor-categories__fields">
          <label className="admin-modal__field">
            <span>Category name</span>
            <input
              className="admin-input"
              value={form.name}
              maxLength={80}
              required
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label className="admin-modal__field">
            <span>Home image</span>
            <input
              className="admin-input admin-vendor-categories__file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/tiff,image/gif"
              required={!editing}
              onChange={(event) => setForm((current) => ({ ...current, imageFile: event.target.files?.[0] || null }))}
            />
          </label>
          <label className="admin-modal__field">
            <span>Display order</span>
            <input
              className="admin-input"
              type="number"
              step="1"
              value={form.sort_order}
              onChange={(event) => setForm((current) => ({ ...current, sort_order: Number(event.target.value) }))}
            />
          </label>
          {editing && (
            <label className="admin-vendor-categories__active">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
              />
              Visible to customers and vendors
            </label>
          )}
        </div>
        <footer className="admin-vendor-categories__form-footer">
          <button type="submit" className="admin-action admin-action--approve" disabled={saving || !form.name.trim()}>
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
          categories.map((category) => (
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
          ))
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
