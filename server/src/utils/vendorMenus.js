function johannesburgDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function getTodaysPublishedVendorMenu(database, vendorId) {
  const { data: location, error: locationError } = await database
    .from('vendor_locations')
    .select('id')
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (locationError) throw locationError;
  if (!location) return { locationId: null, menu: null };

  const { data: menu, error: menuError } = await database
    .from('menus')
    .select('id, name, menu_date')
    .eq('vendor_location_id', location.id)
    .eq('menu_date', johannesburgDate())
    .eq('status', 'published')
    .maybeSingle();
  if (menuError) throw menuError;
  return { locationId: location.id, menu: menu || null };
}

export async function getTodaysPublishedMenuItem(database, vendorId, itemId) {
  const { locationId, menu } = await getTodaysPublishedVendorMenu(database, vendorId);
  if (!menu) return { locationId, menuId: null, status: null };

  const { data: link, error } = await database
    .from('menu_menu_items')
    .select('status')
    .eq('menu_id', menu.id)
    .eq('menu_item_id', itemId)
    .maybeSingle();
  if (error) throw error;
  return { locationId, menuId: menu.id, status: link?.status || null };
}
