import { supabaseAdmin } from '../config/supabase.js';

/**
 * Vendor membership roles are stored per vendor in `vendor_users`, while
 * platform-wide roles live in `user_roles`. Admin views show the effective
 * union of both without writing vendor roles into `user_roles`.
 */
export function mapVendorMemberRole(role) {
  if (role === 'manager') return 'vendor_manager';
  if (role === 'staff') return 'vendor_staff';
  return null;
}

export function mergeEffectiveRoles(platformRoles = [], vendorMemberships = []) {
  const roles = [...new Set((platformRoles || []).filter(Boolean))];

  for (const membership of vendorMemberships || []) {
    if (!membership || membership.is_active === false) continue;
    const role = mapVendorMemberRole(membership.role);
    if (role && !roles.includes(role)) roles.push(role);
  }

  return roles;
}

export function buildEffectiveRoleData(platformRows = [], vendorRows = [], userIds = []) {
  const byUser = new Map();

  const ensureUser = (userId) => {
    if (!byUser.has(userId)) {
      byUser.set(userId, {
        roles: [],
        platformRoles: [],
        vendorRoles: [],
        vendorMemberships: [],
      });
    }
    return byUser.get(userId);
  };

  for (const userId of userIds || []) {
    if (userId) ensureUser(userId);
  }

  for (const row of platformRows || []) {
    if (!row?.user_id || !row.role) continue;
    const entry = ensureUser(row.user_id);
    if (!entry.platformRoles.includes(row.role)) entry.platformRoles.push(row.role);
  }

  for (const row of vendorRows || []) {
    if (!row?.user_id || row.is_active === false) continue;
    const role = mapVendorMemberRole(row.role);
    if (!role) continue;
    const entry = ensureUser(row.user_id);
    const vendors = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
    entry.vendorMemberships.push({
      user_id: row.user_id,
      vendor_id: row.vendor_id,
      vendorName: row.vendorName || vendors?.name || null,
      role: row.role,
      is_active: row.is_active,
      created_at: row.created_at || null,
    });
    if (!entry.vendorRoles.includes(role)) entry.vendorRoles.push(role);
  }

  for (const entry of byUser.values()) {
    entry.roles = mergeEffectiveRoles(entry.platformRoles, entry.vendorMemberships);
  }

  return Object.fromEntries(byUser);
}

export async function fetchEffectiveRoleData(userIds = []) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return {};

  const [platformResult, vendorResult] = await Promise.all([
    supabaseAdmin
      .from('user_roles')
      .select('user_id, role, granted_by, granted_at, expires_at')
      .in('user_id', ids)
      .or('expires_at.is.null,expires_at.gt.now()'),
    supabaseAdmin
      .from('vendor_users')
      .select('user_id, vendor_id, role, is_active, created_at, vendors(id, name)')
      .in('user_id', ids)
      .eq('is_active', true),
  ]);

  if (platformResult.error) throw platformResult.error;
  if (vendorResult.error) throw vendorResult.error;

  return buildEffectiveRoleData(platformResult.data || [], vendorResult.data || [], ids);
}
