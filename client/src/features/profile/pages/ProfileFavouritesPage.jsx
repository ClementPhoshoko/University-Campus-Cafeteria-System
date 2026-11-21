import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconStar, IconX } from '@tabler/icons-react';
import { useAuth } from '../../../hooks/useAuth.js';
import { useFetch } from '../../../hooks/useFetch.js';
import {
  listFavoriteMenuItems,
  listFavoriteVendors,
  toggleFavoriteMenuItem,
  toggleFavoriteVendor,
} from '../../../services/employeeApi.js';
import ProfilePagination from '../components/ProfilePagination.jsx';
import { hasMorePages, pageAfterRemoval } from '../profileForms.js';

const FAVOURITE_PAGE_SIZE = 10;

function formatPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Price unavailable';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
}

function ListSkeleton() {
  return (
    <div className="profile_loading" aria-label="Loading favourites">
      <div className="profile_loading-bar profile_loading-bar--short" />
      <div className="profile_loading-bar" />
    </div>
  );
}

function ListError({ message, onRetry }) {
  return (
    <div className="profile_favourite-empty" role="alert">
      <p>{message || 'We could not load your favourites.'}</p>
      <button type="button" className="profile_link-button" onClick={onRetry}>Try again</button>
    </div>
  );
}

function StatusBadge({ children }) {
  return <span className="profile_favourite-badge">{children}</span>;
}

function FavouriteListCard({ title, count, state, error, onRetry, children, pagination, onPrevious, onNext, pageChanging }) {
  return (
    <div className="profile_card">
      <div className="profile_card-header">
        <h3 className="profile_card-title">{title}</h3>
        <span className="profile_favourites-count">{count}</span>
      </div>
      <div className="profile_favourite-list">
        {state === 'error' ? (
          <ListError message={error?.message} onRetry={onRetry} />
        ) : state === 'loading' || pageChanging ? (
          <ListSkeleton />
        ) : (
          children
        )}
      </div>
      <ProfilePagination
        pagination={pagination}
        onPrevious={onPrevious}
        onNext={onNext}
        disabled={pageChanging}
      />
    </div>
  );
}

export default function ProfileFavouritesPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [vendorPage, setVendorPage] = useState(1);
  const [mealPage, setMealPage] = useState(1);
  const [removingVendor, setRemovingVendor] = useState(null);
  const [removingMeal, setRemovingMeal] = useState(null);
  const [actionError, setActionError] = useState('');

  const fetchVendors = useCallback(
    ({ signal }) => listFavoriteVendors({ token, page: vendorPage, limit: FAVOURITE_PAGE_SIZE, signal }),
    [token, vendorPage],
  );
  const fetchMeals = useCallback(
    ({ signal }) => listFavoriteMenuItems({ token, page: mealPage, limit: FAVOURITE_PAGE_SIZE, signal }),
    [token, mealPage],
  );
  const vendorsQuery = useFetch(fetchVendors, { enabled: !!token });
  const mealsQuery = useFetch(fetchMeals, { enabled: !!token });

  const vendorFavourites = vendorsQuery.data?.favorites || [];
  const mealFavourites = mealsQuery.data?.favorites || [];

  const removeVendor = async (favourite) => {
    const id = favourite?.vendor?.id;
    if (!id) return;
    setRemovingVendor(id);
    setActionError('');
    try {
      const result = await toggleFavoriteVendor(id, { token });
      if (result?.favorited !== false) return;

      const nextPage = pageAfterRemoval(
        vendorPage,
        vendorFavourites.length,
        vendorsQuery.data?.pagination,
      );
      if (nextPage !== vendorPage) setVendorPage(nextPage);
      else vendorsQuery.refetch();
    } catch (err) {
      setActionError(err?.message || 'Could not remove that vendor. Please try again.');
    } finally {
      setRemovingVendor(null);
    }
  };

  const removeMeal = async (favourite) => {
    const id = favourite?.menuItem?.id;
    if (!id) return;
    setRemovingMeal(id);
    setActionError('');
    try {
      const result = await toggleFavoriteMenuItem(id, { token });
      if (result?.favorited !== false) return;

      const nextPage = pageAfterRemoval(
        mealPage,
        mealFavourites.length,
        mealsQuery.data?.pagination,
      );
      if (nextPage !== mealPage) setMealPage(nextPage);
      else mealsQuery.refetch();
    } catch (err) {
      setActionError(err?.message || 'Could not remove that meal. Please try again.');
    } finally {
      setRemovingMeal(null);
    }
  };

  return (
    <section className="profile_section">
      <div className="profile_favourites-intro">
        <p className="profile_eyebrow">Your shortlist</p>
        <h2 className="profile_favourites-title">Saved vendors and meals</h2>
        <p className="profile_section-note">Keep the places and dishes you return to close at hand.</p>
      </div>
      {actionError && <p className="profile_form-message profile_form-message--error" role="alert">{actionError}</p>}
      <div className="profile_favourites-grid">
        <FavouriteListCard
          title="Favourite vendors"
          count={vendorsQuery.data?.pagination?.total ?? 0}
          state={vendorsQuery.state}
          error={vendorsQuery.error}
          onRetry={vendorsQuery.refetch}
          pagination={vendorsQuery.data?.pagination}
          onPrevious={() => setVendorPage((page) => Math.max(1, page - 1))}
          onNext={() => {
            if (hasMorePages(vendorsQuery.data?.pagination)) setVendorPage((page) => page + 1);
          }}
          pageChanging={!!removingVendor}
        >
          {vendorFavourites.length === 0 ? (
            <p className="profile_favourite-empty">You have not saved any vendors yet.</p>
          ) : vendorFavourites.map(({ vendor }) => {
            const inactive = vendor?.status && vendor.status !== 'active';
            return (
              <div key={vendor.id} className="profile_favourite-item">
                <div>
                  <div className="profile_favourite-title-row">
                    <strong className="profile_favourite-name">
                      <Link className="profile_favourite-link" to={`/cafeterias/${vendor.id}`}>{vendor.name}</Link>
                    </strong>
                    {inactive && <StatusBadge>Unavailable</StatusBadge>}
                    <button
                      type="button"
                      className="profile_favourite-remove"
                      aria-label={`Remove ${vendor.name} from favourites`}
                      disabled={removingVendor === vendor.id}
                      onClick={() => removeVendor({ vendor })}
                    >
                      <IconX size={14} stroke={2} />
                    </button>
                  </div>
                  <span className="profile_favourite-detail">{vendor.slug || 'Vendor'}</span>
                </div>
                <span className="profile_favourite-rating">
                  <IconStar size={14} />
                  {vendor.average_rating ? Number(vendor.average_rating).toFixed(1) : 'New'}
                </span>
              </div>
            );
          })}
        </FavouriteListCard>

        <FavouriteListCard
          title="Favourite meals"
          count={mealsQuery.data?.pagination?.total ?? 0}
          state={mealsQuery.state}
          error={mealsQuery.error}
          onRetry={mealsQuery.refetch}
          pagination={mealsQuery.data?.pagination}
          onPrevious={() => setMealPage((page) => Math.max(1, page - 1))}
          onNext={() => {
            if (hasMorePages(mealsQuery.data?.pagination)) setMealPage((page) => page + 1);
          }}
          pageChanging={!!removingMeal}
        >
          {mealFavourites.length === 0 ? (
            <p className="profile_favourite-empty">You have not saved any meals yet.</p>
          ) : mealFavourites.map(({ menuItem }) => {
            const inactive = menuItem?.is_active === false
              || ['inactive', 'unavailable', 'sold_out'].includes(menuItem?.status);
            return (
              <div key={menuItem.id} className="profile_favourite-item">
                <div>
                  <div className="profile_favourite-title-row">
                    <strong className="profile_favourite-name">
                      {menuItem.vendor?.id ? (
                        <Link
                          className="profile_favourite-link"
                          to={`/cafeterias/${menuItem.vendor.id}/menu/${menuItem.id}`}
                        >
                          {menuItem.name}
                        </Link>
                      ) : menuItem.name}
                    </strong>
                    {inactive && <StatusBadge>Unavailable</StatusBadge>}
                    <button
                      type="button"
                      className="profile_favourite-remove"
                      aria-label={`Remove ${menuItem.name} from favourites`}
                      disabled={removingMeal === menuItem.id}
                      onClick={() => removeMeal({ menuItem })}
                    >
                      <IconX size={14} stroke={2} />
                    </button>
                  </div>
                  <span className="profile_favourite-detail">{menuItem.vendor?.name || 'Vendor unavailable'}</span>
                </div>
                <span className="profile_favourite-price">{formatPrice(menuItem.base_price)}</span>
              </div>
            );
          })}
        </FavouriteListCard>
      </div>
    </section>
  );
}
