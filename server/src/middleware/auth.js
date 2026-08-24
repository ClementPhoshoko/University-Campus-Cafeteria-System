export function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const userRole = req.user?.role;
      if (!userRole) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User role not found' }
        });
      }

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Insufficient permissions' }
        });
      }

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Authentication middleware failed' }
      });
    }
  };
}

export function optionalRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const userRole = req.user?.role;
      if (!userRole) {
        req.user = { role: null };
        return next();
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Insufficient permissions' }
        });
      }

      next();
    } catch (error) {
      console.error('Optional auth middleware error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Authentication middleware failed' }
      });
    }
  };
}