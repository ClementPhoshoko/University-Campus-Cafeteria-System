import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth.js';
import { supabase } from '../services/supabase.js';

/**
 * Returns the authenticated user's roles and helper functions.
 *
 * Usage:
 *   const { roles, hasRole, isAdmin, isVendorMember, loading } = useRoles();
 *   if (isAdmin) { ... }
 *   if (hasRole('vendor_manager')) { ... }
 */
export function useRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !supabase) {
      setRoles([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchRoles = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .or('expires_at.is.null,expires_at.gt.now()');

        if (!cancelled) {
          setRoles(error ? [] : (data || []).map((r) => r.role));
        }
      } catch {
        if (!cancelled) setRoles([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRoles();

    return () => { cancelled = true; };
  }, [user?.id]);

  const hasRole = useCallback(
    (role) => roles.includes(role),
    [roles],
  );

  const hasAnyRole = useCallback(
    (...roleList) => roleList.some((r) => roles.includes(r)),
    [roles],
  );

  const value = useMemo(() => ({
    roles,
    loading,
    hasRole,
    hasAnyRole,
    isAdmin: roles.includes('admin'),
    isFinance: roles.includes('finance'),
    isSupport: roles.includes('support'),
    isAuditor: roles.includes('auditor'),
    isVendorStaff: roles.includes('vendor_staff'),
    isVendorManager: roles.includes('vendor_manager'),
    isExecutive: roles.includes('executive'),
    isExecutiveAssistant: roles.includes('executive_assistant'),
    isMeetingOrganiser: roles.includes('meeting_organiser'),
    isEmployee: roles.includes('employee'),
  }), [roles, loading, hasRole, hasAnyRole]);

  return value;
}
