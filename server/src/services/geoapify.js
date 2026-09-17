/**
 * Geoapify geocoding service.
 *
 * Resolves place_ids and address strings into structured address components
 * using the Geoapify Geocoding API (server-side, API key kept secret).
 *
 * Free tier: 3,000 requests/day — no credit card required.
 * Requires GEOAPIFY_API_KEY in environment variables.
 */

const GEOAPIFY_BASE = 'https://api.geoapify.com/v1/geocode';

function getApiKey() {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) throw new Error('GEOAPIFY_API_KEY is not configured');
  return key;
}

/**
 * Simplified South Africa timezone inference based on lat/lng.
 */
function inferTimezone(lat, lng) {
  if (lat >= -35 && lat <= -22 && lng >= 16 && lng <= 33) {
    return 'Africa/Johannesburg';
  }
  return null;
}

/**
 * Map a Geoapify feature to the app's standard location data shape.
 */
function mapFeature(feature) {
  const p = feature.properties || {};
  return {
    street_address: p.address_line1 || null,
    city: p.city || null,
    province: p.state || null,
    postal_code: p.postcode || null,
    country: p.country || null,
    country_code: p.country_code ? p.country_code.toUpperCase() : null,
    formatted_address: p.formatted || null,
    latitude: p.lat ?? null,
    longitude: p.lon ?? null,
    timezone: inferTimezone(p.lat, p.lon),
    place_id: p.place_id || null,
  };
}

/**
 * Autocomplete address suggestions using Geoapify Autocomplete API.
 * Restricted to South Africa via filter.
 * @param {string} input - User's typed input
 * @returns {Promise<Array>} Array of prediction objects
 */
export async function autocompleteAddress(input) {
  const apiKey = getApiKey();
  const params = new URLSearchParams();
  params.append('text', input);
  params.append('apiKey', apiKey);
  params.append('filter[0]', 'country:za');
  params.append('limit', '5');

  const response = await fetch(`${GEOAPIFY_BASE}/autocomplete?${params}`);
  if (!response.ok) {
    throw new Error(`Geoapify autocomplete request failed: ${response.status}`);
  }

  const data = await response.json();
  const features = data.features || [];

  return features.map((f) => {
    const p = f.properties || {};
    return {
      place_id: p.place_id || '',
      description: p.formatted || '',
      main_text: p.address_line1 || p.formatted || '',
      secondary_text: [p.address_line2, p.city, p.state].filter(Boolean).join(', ') || null,
      types: [],
    };
  });
}

/**
 * Geocode a place_id into structured address components.
 * @param {string} placeId - Geoapify place_id
 * @returns {Promise<Object>} Structured address data
 */
export async function geocodePlaceId(placeId) {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    place_id: placeId,
    apiKey,
  });

  const response = await fetch(`${GEOAPIFY_BASE}/details?${params}`);
  if (!response.ok) {
    throw new Error(`Geoapify details request failed: ${response.status}`);
  }

  const data = await response.json();
  const feature = data.features?.[0];
  if (!feature) {
    throw new Error('Geoapify returned no results for place_id');
  }

  return mapFeature(feature);
}

/**
 * Geocode a free-text address string into structured components.
 * @param {string} address - Free-text address
 * @returns {Promise<Object>} Structured address data
 */
export async function geocodeAddress(address) {
  const apiKey = getApiKey();
  const params = new URLSearchParams();
  params.append('text', address);
  params.append('apiKey', apiKey);
  params.append('filter[0]', 'country:za');

  const response = await fetch(`${GEOAPIFY_BASE}/search?${params}`);
  if (!response.ok) {
    throw new Error(`Geoapify search request failed: ${response.status}`);
  }

  const data = await response.json();
  const feature = data.features?.[0];
  if (!feature) {
    throw new Error('Geoapify returned no results for address');
  }

  return mapFeature(feature);
}
