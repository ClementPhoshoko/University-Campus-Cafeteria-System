import { ApiError } from './errors.js';
import { isUuid } from '../validators/vendorValidators.js';

export async function requireActiveVendorLocation(database, vendorId, locationId) {
  if (!isUuid(locationId)) {
    throw new ApiError(400, 'LOCATION_REQUIRED', 'Choose a valid pickup location before browsing this menu');
  }

  const { data, error } = await database
    .from('vendor_locations')
    .select('id, vendor_id, site_id, building_id, collection_point_id, is_active')
    .eq('id', locationId)
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, 'LOCATION_NOT_FOUND', 'Pickup location is not active for this cafeteria');
  return data;
}
