export function rankPopularMenuItems(items, limit = 8) {
  const byVendor = new Map();

  for (const item of items) {
    if (!item.vendor_id) continue;
    const vendorItems = byVendor.get(item.vendor_id) || [];
    vendorItems.push(item);
    byVendor.set(item.vendor_id, vendorItems);
  }

  const vendorGroups = [...byVendor.values()]
    .map((vendorItems) => vendorItems.sort((first, second) => (
      Number(second.quantity_ordered) - Number(first.quantity_ordered)
      || Number(second.order_count) - Number(first.order_count)
      || String(first.name).localeCompare(String(second.name))
    )))
    .sort((first, second) => (
      Number(second[0].quantity_ordered) - Number(first[0].quantity_ordered)
      || String(first[0].vendor_name).localeCompare(String(second[0].vendor_name))
    ));

  const ranked = [];
  for (let index = 0; ranked.length < limit; index += 1) {
    let added = false;
    for (const vendorItems of vendorGroups) {
      if (vendorItems[index]) {
        ranked.push(vendorItems[index]);
        added = true;
        if (ranked.length === limit) break;
      }
    }
    if (!added) break;
  }

  return ranked;
}

export function rankFeaturedMenuItems(items, limit = 8) {
  const byVendor = new Map();

  for (const item of items) {
    if (!item.vendor_id) continue;
    const vendorItems = byVendor.get(item.vendor_id) || [];
    vendorItems.push(item);
    byVendor.set(item.vendor_id, vendorItems);
  }

  const vendorGroups = [...byVendor.values()]
    .map((vendorItems) => vendorItems.sort((first, second) => (
      Number(first.status === 'limited') - Number(second.status === 'limited')
      || String(second.created_at || '').localeCompare(String(first.created_at || ''))
      || String(first.name).localeCompare(String(second.name))
    )))
    .sort((first, second) => (
      String(first[0].vendor_name).localeCompare(String(second[0].vendor_name))
    ));

  const featured = [];
  for (let index = 0; featured.length < limit; index += 1) {
    let added = false;
    for (const vendorItems of vendorGroups) {
      if (vendorItems[index]) {
        featured.push(vendorItems[index]);
        added = true;
        if (featured.length === limit) break;
      }
    }
    if (!added) break;
  }

  return featured;
}
