import { requireActiveVendorLocation } from './vendorLocation.js';

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

export async function getTodaysPublishedVendorMenu(database, vendorId, locationId) {
  const location = await requireActiveVendorLocation(database, vendorId, locationId);

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

export async function getTodaysPublishedMenuItem(database, vendorId, itemId, locationId) {
  const { locationId: resolvedLocationId, menu } = await getTodaysPublishedVendorMenu(database, vendorId, locationId);
  if (!menu) return { locationId: resolvedLocationId, menuId: null, status: null };

  const { data: link, error } = await database
    .from('menu_menu_items')
    .select('status')
    .eq('menu_id', menu.id)
    .eq('menu_item_id', itemId)
    .maybeSingle();
  if (error) throw error;
  if (!link) {
    const { count, error: countError } = await database
      .from('menu_menu_items')
      .select('menu_item_id', { count: 'exact', head: true })
      .eq('menu_id', menu.id);
    if (countError) throw countError;
    return { locationId: resolvedLocationId, menuId: menu.id, status: null, menuEmpty: count === 0 };
  }
  return { locationId: resolvedLocationId, menuId: menu.id, status: link?.status || null };
}
