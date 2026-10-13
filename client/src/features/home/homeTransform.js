export function normalizeVendorStatus(status) {
  const value = String(status || '').toLowerCase();

  if (value === 'temporarily_unavailable' || value === 'closed') return 'closed';
  if (value === 'open') return 'open';
  if (value === 'busy') return 'busy';
  return 'closed';
}

export function formatPrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const raw = typeof value === 'string' ? Number.parseFloat(value.replace(/[^\d.]/g, '')) : Number(value);
  return Number.isFinite(raw) ? `R${raw.toFixed(2)}` : null;
}

export function mapCafeteriaToCard(cafeteria) {
  const sourceLocation = cafeteria?.location || {};
  const status = normalizeVendorStatus(sourceLocation.service_status);
  const prepMinutes = Number(sourceLocation.estimated_prep_minutes ?? Number.NaN);

  return {
    id: cafeteria?.id,
    vendorId: cafeteria?.vendor_id,
    siteName: cafeteria?.site_name || cafeteria?.name || '',
    name: cafeteria?.name || '',
    status,
    image: cafeteria?.cover_image_url || '',
    description: typeof cafeteria?.description === 'string' ? cafeteria.description.trim() : '',
    prepWindow: Number.isFinite(prepMinutes) && prepMinutes > 0 ? `${prepMinutes} min` : null,
    location: {
      siteId: sourceLocation.site_id || cafeteria?.id || null,
      siteName: sourceLocation.site_name || cafeteria?.site_name || cafeteria?.name || null,
      streetAddress: sourceLocation.street_address || null,
      address: sourceLocation.address || cafeteria?.address || null,
      city: sourceLocation.city || null,
      province: sourceLocation.province || null,
      postalCode: sourceLocation.postal_code || null,
      country: sourceLocation.country || null,
    },
    rating: Number(cafeteria?.average_rating) > 0 ? Number(cafeteria.average_rating).toFixed(1) : null,
    reviewCount: Number(cafeteria?.rating_count || 0),
  };
}

export function mapMenuItemToMeal(item, vendorName, vendorId) {
  return {
    id: item?.id,
    name: item?.name || '',
    price: formatPrice(item?.base_price ?? item?.price),
    vendor: vendorName || '',
    image: item?.image_url || '',
    cafeteriaId: vendorId,
  };
}

export function mapCategoryToDisplay(category) {
  const items = category?.items || [];
  return {
    id: category?.id || category?.name || '',
    name: category?.name || '',
    image: items[0]?.image || items[0]?.image_url || '',
  };
}
