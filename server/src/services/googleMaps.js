/**
 * Google Maps geocoding service.
 *
 * Resolves place_ids and address strings into structured address components
 * using the Google Geocoding API (server-side, API key kept secret).
 *
 * Requires GOOGLE_MAPS_API_KEY in environment variables.
 */

const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

function getApiKey() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error('GOOGLE_MAPS_API_KEY is not configured');
  return key;
}

/**
 * Extract structured address components from Google Geocoding API response.
 */
function extractAddressComponents(components) {
  const get = (type) => {
    const comp = components.find((c) => c.types.includes(type));
    return comp?.long_name || null;
  };

  return {
    street_number: get('street_number'),
    route: get('route'),
    street_address: [get('street_number'), get('route')].filter(Boolean).join(' ') || null,
    city: get('locality') || get('sublocality') || get('administrative_area_level_2'),
    province: get('administrative_area_level_1'),
    postal_code: get('postal_code'),
    country: get('country'),
    country_code: get('country') ? components.find((c) => c.types.includes('country'))?.short_name : null,
  };
}

/**
 * Extract timezone from Google Geocoding response.
 * Note: Google Geocoding does not directly return timezone.
 * We use a lookup based on lat/lng for South Africa (simplified).
 * For production, consider using a timezone API like timezonedb or Google Time Zone API.
 */
function inferTimezone(lat, lng) {
  // Simplified South Africa timezone inference
  // In production, use a proper timezone lookup service
  if (lat >= -35 && lat <= -22 && lng >= 16 && lng <= 33) {
    return 'Africa/Johannesburg';
  }
  return null;
}

/**
 * Geocode a place_id into structured address components.
 * @param {string} placeId - Google Place ID
 * @returns {Promise<Object>} Structured address data
 */
export async function geocodePlaceId(placeId) {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    place_id: placeId,
    key: apiKey,
    fields: 'address_component,formatted_address,geometry/location',
  });

  const response = await fetch(`${GOOGLE_GEOCODE_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Geocoding API request failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(`Geocoding failed: ${data.status}`);
  }

  const result = data.results[0];
  const components = extractAddressComponents(result.address_components);
  const location = result.geometry?.location;

  return {
    ...components,
    formatted_address: result.formatted_address || null,
    latitude: location?.lat ?? null,
    longitude: location?.lng ?? null,
    timezone: inferTimezone(location?.lat, location?.lng),
    place_id: placeId,
  };
}

/**
 * Autocomplete address suggestions using Google Places Autocomplete API.
 * This is a server-side proxy to keep the API key secret.
 * @param {string} input - User's typed input
 * @param {string} [sessionToken] - Optional session token for billing optimization
 * @returns {Promise<Array>} Array of prediction objects
 */
export async function autocompleteAddress(input, sessionToken) {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    input,
    key: apiKey,
    types: 'geocode|establishment',
    components: 'country:za', // Restrict to South Africa
  });
  if (sessionToken) params.set('sessiontoken', sessionToken);

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`
  );
  if (!response.ok) {
    throw new Error(`Autocomplete API request failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Autocomplete failed: ${data.status}`);
  }

  return (data.predictions || []).map((p) => ({
    place_id: p.place_id,
    description: p.description,
    main_text: p.structured_formatting?.main_text || p.description,
    secondary_text: p.structured_formatting?.secondary_text || null,
    types: p.types || [],
  }));
}

/**
 * Geocode a free-text address string into structured components.
 * @param {string} address - Free-text address
 * @returns {Promise<Object>} Structured address data
 */
export async function geocodeAddress(address) {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    address,
    key: apiKey,
    components: 'country:za',
  });

  const response = await fetch(`${GOOGLE_GEOCODE_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Geocoding API request failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(`Geocoding failed: ${data.status}`);
  }

  const result = data.results[0];
  const components = extractAddressComponents(result.address_components);
  const location = result.geometry?.location;

  return {
    ...components,
    formatted_address: result.formatted_address || null,
    latitude: location?.lat ?? null,
    longitude: location?.lng ?? null,
    timezone: inferTimezone(location?.lat, location?.lng),
    place_id: result.place_id || null,
  };
}
