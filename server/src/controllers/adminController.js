import { supabaseAdmin } from '../config/supabase.js';

const VALID_ROLES = [
  'employee', 'executive', 'executive_assistant', 'meeting_organiser',
  'training_coordinator', 'cost_centre_owner', 'vendor_staff', 'vendor_manager',
  'admin', 'finance', 'support', 'auditor',
];

/**
 * GET /admin/users
 * List users with pagination, search, and role filtering.
 */
export async function listUsers(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, employee_number, department, is_active, created_at', { count: 'exact' });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,employee_number.ilike.%${search}%`);
    }

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data: users, error, count } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'QUERY_ERROR', message: error.message },
      });
    }

    // Fetch roles for each user in the result
    const userIds = (users || []).map((u) => u.id);
    let roleMap = {};

    if (userIds.length > 0) {
      const { data: allRoles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds)
        .or('expires_at.is.null,expires_at.gt.now()');

      if (allRoles) {
        for (const r of allRoles) {
          if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
          roleMap[r.user_id].push(r.role);
        }
      }
    }

    // If role filter is set, filter users server-side
    let filtered = (users || []).map((u) => ({
      ...u,
      roles: roleMap[u.id] || [],
    }));

    if (role) {
      filtered = filtered.filter((u) => u.roles.includes(role));
    }

    res.json({
      success: true,
      users: filtered,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (err) {
    console.error('listUsers error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list users' },
    });
  }
}

/**
 * GET /admin/users/:userId/roles
 * Get a specific user's roles.
 */
export async function getUserRoles(req, res) {
  try {
    const { userId } = req.params;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, employee_number')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role, granted_by, granted_at, expires_at')
      .eq('user_id', userId)
      .order('granted_at', { ascending: true });

    if (rolesError) {
      return res.status(500).json({
        success: false,
        error: { code: 'QUERY_ERROR', message: rolesError.message },
      });
    }

    res.json({
      success: true,
      user: profile,
      roles: (roles || []).map((r) => r.role),
      roleDetails: roles || [],
    });
  } catch (err) {
    console.error('getUserRoles error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get user roles' },
    });
  }
}

/**
 * PUT /admin/users/:userId/roles
 * Replace all roles for a user. Body: { roles: ['admin', 'finance'] }
 */
export async function setUserRoles(req, res) {
  try {
    const { userId } = req.params;
    const { roles } = req.body;

    if (!Array.isArray(roles)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'roles must be an array' },
      });
    }

    // Validate all roles
    const invalid = roles.filter((r) => !VALID_ROLES.includes(r));
    if (invalid.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Invalid roles: ${invalid.join(', ')}` },
      });
    }

    // Check user exists
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    // Prevent removing own admin role (self-demotion guard)
    if (userId === req.user.id && !roles.includes('admin')) {
      return res.status(400).json({
        success: false,
        error: { code: 'SELF_DEMOTION_BLOCKED', message: 'Cannot remove your own admin role' },
      });
    }

    // Delete existing roles
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    // Insert new roles
    if (roles.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('user_roles')
        .insert(
          roles.map((role) => ({
            user_id: userId,
            role,
            granted_by: req.user.id,
          })),
        );

      if (insertError) {
        return res.status(500).json({
          success: false,
          error: { code: 'INSERT_ERROR', message: insertError.message },
        });
      }
    }

    res.json({
      success: true,
      userId,
      roles,
    });
  } catch (err) {
    console.error('setUserRoles error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to set user roles' },
    });
  }
}

/**
 * POST /admin/users/:userId/roles
 * Add a role to a user. Body: { role: 'admin' }
 */
export async function addRole(req, res) {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
      });
    }

    // Check user exists
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const { error: insertError } = await supabaseAdmin
      .from('user_roles')
      .upsert(
        { user_id: userId, role, granted_by: req.user.id },
        { onConflict: 'user_id,role' },
      );

    if (insertError) {
      return res.status(500).json({
        success: false,
        error: { code: 'INSERT_ERROR', message: insertError.message },
      });
    }

    // Fetch updated roles
    const { data: updatedRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .or('expires_at.is.null,expires_at.gt.now()');

    res.json({
      success: true,
      userId,
      role,
      roles: (updatedRoles || []).map((r) => r.role),
    });
  } catch (err) {
    console.error('addRole error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to add role' },
    });
  }
}

/**
 * DELETE /admin/users/:userId/roles/:role
 * Remove a role from a user.
 */
export async function removeRole(req, res) {
  try {
    const { userId, role } = req.params;

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Invalid role: ${role}` },
      });
    }

    // Prevent self-demotion
    if (userId === req.user.id && role === 'admin') {
      return res.status(400).json({
        success: false,
        error: { code: 'SELF_DEMOTION_BLOCKED', message: 'Cannot remove your own admin role' },
      });
    }

    const { error } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role);

    if (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'DELETE_ERROR', message: error.message },
      });
    }

    // Fetch updated roles
    const { data: updatedRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .or('expires_at.is.null,expires_at.gt.now()');

    res.json({
      success: true,
      userId,
      removedRole: role,
      roles: (updatedRoles || []).map((r) => r.role),
    });
  } catch (err) {
    console.error('removeRole error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to remove role' },
    });
  }
}
