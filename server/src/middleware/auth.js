import { supabaseAdmin } from '../config/supabase.js';

/**
 * Middleware factory: requires the authenticated user to hold at least one
 * of the specified roles. Must be used after `authenticate`.
 *
 * Usage:
 *   router.get('/admin/vendors', authenticate, requireRole('admin'), handler);
 *   router.post('/vendor/orders', authenticate, requireRole('admin', 'vendor_manager'), handler);
 */
export function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    try {
      if (!supabaseAdmin) {
        console.error('requireRole: supabaseAdmin not configured');
        return res.status(500).json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Role service unavailable' },
        });
      }

      const { data: roles, error } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', req.user.id)
        .or('expires_at.is.null,expires_at.gt.now()');

      if (error) {
        console.error('requireRole query error:', error);
        return res.status(500).json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to verify role' },
        });
      }

      const userRoles = (roles || []).map((r) => r.role);
      const hasAccess = allowedRoles.some((role) => userRoles.includes(role));

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Requires one of: ${allowedRoles.join(', ')}`,
          },
        });
      }

      req.userRoles = userRoles;
      next();
    } catch (err) {
      console.error('requireRole error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Role verification failed' },
      });
    }
  };
}

/**
 * Optional role check. Sets req.userRoles but does not block if the user
 * lacks the specified roles. Useful for conditional logic downstream.
 */
export function optionalRole(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.user?.id) {
      req.userRoles = [];
      return next();
    }

    try {
      if (!supabaseAdmin) {
        req.userRoles = [];
        return next();
      }

      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', req.user.id)
        .or('expires_at.is.null,expires_at.gt.now()');

      req.userRoles = (roles || []).map((r) => r.role);

      if (allowedRoles.length > 0) {
        const hasAccess = allowedRoles.some((role) => req.userRoles.includes(role));
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: `Requires one of: ${allowedRoles.join(', ')}`,
            },
          });
        }
      }

      next();
    } catch (err) {
      console.error('optionalRole error:', err);
      req.userRoles = [];
      next();
    }
  };
}
