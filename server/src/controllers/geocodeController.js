import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  autocompleteAddress,
  geocodePlaceId,
  geocodeAddress,
} from '../services/googleMaps.js';
import { ApiError, sendError, sendInternalError } from '../utils/errors.js';
import { respond } from '../utils/http.js';

/**
 * GET /api/v1/admin/geocode/autocomplete?q=...
 * Returns address predictions for typeahead.
 */
export async function autocomplete(req, res) {
  try {
    const input = String(req.query.q || '').trim();
    if (input.length < 2) {
      return respond(req, res, { success: true, predictions: [] });
    }

    const sessionToken = req.query.session_token || undefined;
    const predictions = await autocompleteAddress(input, sessionToken);

    return respond(req, res, { success: true, predictions });
  } catch (err) {
    if (err instanceof ApiError) {
      return sendError(res, err.status, err.code, err.message);
    }
    return sendInternalError(res, err);
  }
}

/**
 * POST /api/v1/admin/geocode/resolve
 * Body: { place_id: string } or { address: string }
 * Returns structured address components.
 */
export async function resolve(req, res) {
  try {
    const { place_id, address } = req.body || {};

    let result;
    if (place_id) {
      result = await geocodePlaceId(place_id);
    } else if (address) {
      result = await geocodeAddress(address);
    } else {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Either place_id or address is required');
    }

    return respond(req, res, { success: true, location: result });
  } catch (err) {
    if (err instanceof ApiError) {
      return sendError(res, err.status, err.code, err.message);
    }
    return sendInternalError(res, err);
  }
}
