import { ApiError } from '../utils/errors.js';

export async function getVendorLocationInventory(database, vendorLocationId, menuItemIds) {
  const itemIds = [...new Set((menuItemIds || []).filter(Boolean))];
  const { data: setting, error: settingError } = await database
    .from('vendor_location_inventory_settings')
    .select('tracking_enabled')
    .eq('vendor_location_id', vendorLocationId)
    .maybeSingle();
  if (settingError) throw settingError;
  const trackingEnabled = setting?.tracking_enabled === true;
  if (!trackingEnabled || itemIds.length === 0) return { trackingEnabled, items: new Map() };

  const { data: rows, error } = await database
    .from('vendor_location_item_inventory')
    .select('menu_item_id, on_hand_quantity, reserved_quantity')
    .eq('vendor_location_id', vendorLocationId)
    .in('menu_item_id', itemIds);
  if (error) throw error;
  const items = new Map((rows || []).map((row) => [row.menu_item_id, {
    on_hand_quantity: row.on_hand_quantity,
    reserved_quantity: row.reserved_quantity,
    orderable_quantity: row.on_hand_quantity - row.reserved_quantity,
  }]));
  itemIds.forEach((id) => {
    if (!items.has(id)) items.set(id, { on_hand_quantity: 0, reserved_quantity: 0, orderable_quantity: 0 });
  });
  return { trackingEnabled, items };
}

export async function assertVendorLocationStock(database, vendorLocationId, quantities) {
  const inventory = await getVendorLocationInventory(database, vendorLocationId, quantities.map((line) => line.menuItemId));
  if (!inventory.trackingEnabled) return inventory;
  for (const line of quantities) {
    const row = inventory.items.get(line.menuItemId);
    if (!row || row.orderable_quantity < line.quantity) {
      throw new ApiError(409, 'INSUFFICIENT_STOCK', `${line.name || 'A menu item'} has only ${row?.orderable_quantity || 0} available at this collection location.`);
    }
  }
  return inventory;
}
