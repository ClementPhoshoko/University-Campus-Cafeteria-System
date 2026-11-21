import { useState } from 'react';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import { useFavorites } from '../../contexts/FavoritesContext.jsx';
import { MENU_ITEM_FAVORITE, VENDOR_FAVORITE } from '../../features/favorites/favoritesState.js';
import './FavoriteStarButton.css';

export default function FavoriteStarButton({
  kind,
  id,
  name,
  placement,
  className = '',
}) {
  const {
    authenticated,
    isFavoriteVendor,
    isFavoriteMenuItem,
    isPendingVendor,
    isPendingMenuItem,
    toggleVendor,
    toggleMenuItem,
  } = useFavorites();
  const [pulseKey, setPulseKey] = useState(0);

  if (!authenticated || !id) return null;

  const isVendor = kind === VENDOR_FAVORITE;
  const favorite = isVendor ? isFavoriteVendor(id) : isFavoriteMenuItem(id);
  const pending = isVendor ? isPendingVendor(id) : isPendingMenuItem(id);
  const subject = name || (isVendor ? 'vendor' : 'meal');
  const label = favorite
    ? `Remove ${subject} from favourites`
    : `Save ${subject} to favourites`;
  const position = placement || (isVendor ? 'vendor' : 'meal');

  const handleClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (pending) return;

    try {
      const result = isVendor
        ? await toggleVendor(id)
        : await toggleMenuItem(id);
      if (result?.favorited === true) setPulseKey((key) => key + 1);
    } catch {
      // The provider restores the previous state; the card stays interactive.
    }
  };

  return (
    <button
      type="button"
      className={[
        'favorite-star',
        `favorite-star--${position}`,
        favorite ? 'favorite-star--active' : '',
        pending ? 'favorite-star--pending' : '',
        className,
      ].filter(Boolean).join(' ')}
      onClick={handleClick}
      aria-label={label}
      aria-pressed={favorite}
      title={label}
      disabled={pending}
    >
      <span className="favorite-star__icon" key={pulseKey}>
        {favorite ? <IconStarFilled size={18} stroke={1.6} /> : <IconStar size={18} stroke={1.8} />}
      </span>
    </button>
  );
}
