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

export function mapFeaturedMenuItems(menuResponses, cafeterias, limit = 8) {
  const byVendor = new Map();

  menuResponses.forEach((response, index) => {
    const cafeteria = cafeterias[index];
    const vendorId = cafeteria?.vendor_id;
    if (!vendorId) return;

    const vendorItems = byVendor.get(vendorId) || new Map();
    const vendorName = response?.vendor?.name || cafeteria.name || '';
    for (const item of (response?.categories || []).flatMap((category) => category?.items || [])) {
      if (!item?.id || vendorItems.has(item.id)) continue;
      vendorItems.set(item.id, {
        ...mapMenuItemToMeal(item, vendorName, vendorId),
        vendorId,
        siteId: cafeteria.id,
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
