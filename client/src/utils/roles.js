export const VENDOR_ROLE_IDS = new Set(['vendor_staff', 'vendor_manager']);

export function isVendorRole(role) {
  return VENDOR_ROLE_IDS.has(role);
}

export function filterPlatformRoleIds(roles = []) {
  return (roles || []).filter((role) => role && !isVendorRole(role));
}
