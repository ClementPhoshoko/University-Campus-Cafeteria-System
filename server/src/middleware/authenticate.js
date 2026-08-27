import { supabaseAdmin } from '../config/supabase.js';

export async function authenticate(req, res, next) {
  if (!supabaseAdmin) {
    return res.status(500).json({
      success: false,
      error: { code: 'CONFIG_ERROR', message: 'Authentication service not configured' },
    });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' }
    });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing access token' }
    });
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' }
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    console.error('Auth verification error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Token verification failed' }
    });
  }
}
