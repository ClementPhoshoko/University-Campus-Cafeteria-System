export function normalizeVendorStatus(status) {
  const value = String(status || '').toLowerCase();

  if (value === 'temporarily_unavailable') return 'temporarily_unavailable';
  if (value === 'closed') return 'closed';
  if (value === 'open') return 'open';
  if (value === 'busy') return 'busy';
  return 'closed';
}

export function formatPrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const raw = typeof value === 'string' ? Number.parseFloat(value.replace(/[^\d.]/g, '')) : Number(value);
  return Number.isFinite(raw) ? `R${raw.toFixed(2)}` : null;
}

export function mapVendorToCafeteriaCard(vendor) {
  const locations = Array.isArray(vendor?.locations) ? vendor.locations : [];
  const location = vendor?.location || locations[0] || null;
  const prepMinutes = Number(
    location
      ? location.estimated_prep_minutes
      : vendor?.estimated_prep_minutes ?? Number.NaN,
  );
  return {
    id: vendor?.id,
    name: vendor?.name || '',
    status: normalizeVendorStatus(location?.service_status || vendor?.service_status),
    image: vendor?.logo_url || '',
    description: typeof vendor?.description === 'string' ? vendor.description.trim() : '',
    prepWindow: Number.isFinite(prepMinutes) && prepMinutes > 0 ? `${prepMinutes} min` : null,
    location,
    locations,
    rating: Number(vendor?.average_rating) > 0 ? Number(vendor.average_rating).toFixed(1) : null,
    reviewCount: Number(vendor?.rating_count || 0),
  };
}

export function mapMenuItemToMeal(item, cafeteriaName) {
  return {
    id: item?.id,
    name: item?.name || '',
    price: formatPrice(item?.base_price ?? item?.price),
    cafeteriaName: cafeteriaName || '',
    image: item?.image_url || '',
  };
}

export function mapFeaturedMenuItems(menuResponses, cafeterias, limit = 8) {
  const byVendor = new Map();

  menuResponses.forEach((response, index) => {
    const cafeteria = cafeterias[index];
    const vendorId = cafeteria?.id;
    if (!vendorId) return;

    const vendorItems = byVendor.get(vendorId) || new Map();
    const cafeteriaName = response?.vendor?.name || cafeteria.name || '';
    for (const item of (response?.categories || []).flatMap((category) => category?.items || [])) {
      if (!item?.id || vendorItems.has(item.id)) continue;
      vendorItems.set(item.id, {
        ...mapMenuItemToMeal(item, cafeteriaName),
        vendorId,
        source: 'featured',
      });
    }
    byVendor.set(vendorId, vendorItems);
  });

  const vendorGroups = [...byVendor.values()].map((items) => [...items.values()]);
  const featured = [];
  for (let index = 0; featured.length < limit; index += 1) {
    let added = false;
    for (const items of vendorGroups) {
      if (items[index]) {
        featured.push(items[index]);
        added = true;
        if (featured.length === limit) break;
      }
    }
    if (!added) break;
  }

  return featured;
}

export function mapCategoryToDisplay(category) {
  const items = category?.items || [];
  return {
    id: category?.id || category?.name || '',
    name: category?.name || '',
    image: items[0]?.image || items[0]?.image_url || '',
  };
}
