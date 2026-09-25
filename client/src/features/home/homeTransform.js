export function normalizeVendorStatus(status) {
  const value = String(status || '').toLowerCase();

  if (value === 'temporarily_unavailable' || value === 'closed') return 'closed';
  if (value === 'busy') return 'busy';
  return 'open';
}

export function formatPrice(value) {
  const raw = typeof value === 'string' ? Number.parseFloat(value.replace(/[^\d.]/g, '')) : Number(value);
  const safe = Number.isFinite(raw) ? raw : 0;
  return `R${safe.toFixed(2)}`;
}

export function mapVendorToCafeteria(vendor, detail, index = 0) {
  const vendorData = detail?.vendor || detail || vendor || {};
  const locations = vendorData.locations || [];
  const location = locations.find((entry) => entry?.is_active !== false) || locations[0] || {};
  const status = normalizeVendorStatus(location.service_status || 'closed');
  const prepMinutes = Number(location.estimated_prep_minutes || 15);
  const walkMinutes = 5 + (index % 3);

  return {
    id: vendor?.id || vendorData.id,
    name: vendor?.name || vendorData.name || 'Campus vendor',
    status,
    theme: ['blue', 'coral', 'mint'][index % 3],
    image: vendor?.logo_url || vendorData.logo_url || '',
    category: ['dining', 'seafood', 'cafe'][index % 3],
    description: vendor?.description || vendorData.description || 'Fresh food for the campus community.',
    walkTime: `${walkMinutes} min`,
    prepWindow: `${prepMinutes} min`,
  };
}

export function mapCafeteriaToCard(cafeteria, index = 0) {
  const location = cafeteria?.location || {};
  const status = normalizeVendorStatus(location.service_status || 'closed');
  const prepMinutes = Number(location.estimated_prep_minutes);
  const address = [
    location.street_address,
    location.city,
    location.province,
    location.postal_code,
  ].filter(Boolean).join(', ') || location.address || location.site_name || 'Address unavailable';

  return {
    id: cafeteria?.id,
    vendorId: cafeteria?.vendor_id,
    siteName: cafeteria?.site_name || cafeteria?.name || 'Campus cafeteria',
    name: cafeteria?.site_name || cafeteria?.name || 'Campus cafeteria',
    status,
    theme: ['blue', 'coral', 'mint'][index % 3],
    image: cafeteria?.cover_image_url || cafeteria?.logo_url || '',
    category: cafeteria?.category || null,
    description: cafeteria?.description || cafeteria?.address || 'Address unavailable',
    walkTime: '—',
    prepWindow: Number.isFinite(prepMinutes) ? `${prepMinutes} min` : '—',
    location: address,
    rating: cafeteria?.average_rating ? String(Number(cafeteria.average_rating).toFixed(1)) : '0.0',
    reviewCount: Number(cafeteria?.rating_count || 0),
  };
}

export function mapVendorToDirectory(vendor, detail, index = 0) {
  const mapped = mapVendorToCafeteria(vendor, detail, index);
  const vendorData = detail?.vendor || detail || vendor || {};
  const locations = vendorData.locations || [];
  const location = locations.find((entry) => entry?.is_active !== false) || locations[0] || {};

  return {
    ...mapped,
    category: 'open',
    location: location?.site_name || location?.building_name ? `${location.site_name || 'Campus'} · ${location.building_name || 'On site'}` : 'Campus location',
    rating: vendorData.average_rating ? String(Number(vendorData.average_rating).toFixed(1)) : '4.5',
    reviewCount: Number(vendorData.rating_count || 0),
  };
}

export function mapMenuItemToMeal(item, vendorName, vendorId, index = 0) {
  return {
    id: item?.id,
    name: item?.name || 'Menu item',
    price: formatPrice(item?.base_price ?? item?.price ?? 0),
    vendor: vendorName || 'Campus vendor',
    image: item?.image_url || '',
    bestSeller: index < 2 || item?.status === 'limited',
    cafeteriaId: vendorId,
  };
}

export function mapCategoryToDisplay(category) {
  const items = category?.items || [];
  return {
    id: category?.id || category?.name || `category-${Math.random().toString(36).slice(2, 10)}`,
    name: category?.name || 'Other',
    image: items[0]?.image || items[0]?.image_url || '',
  };
}
