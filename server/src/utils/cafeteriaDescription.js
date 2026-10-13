function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isLocationDescription(description, site) {
  const normalizedDescription = normalizeText(description);
  if (!normalizedDescription) return false;

  const locationValues = [
    site.address,
    site.street_address,
    site.city,
    site.province,
    site.postal_code,
    site.country,
    [site.street_address, site.city, site.province, site.postal_code, site.country].filter(Boolean).join(', '),
    [site.address, site.city, site.province, site.postal_code, site.country].filter(Boolean).join(', '),
    [site.city, site.province, site.country].filter(Boolean).join(', '),
    [site.city, site.province, site.postal_code, site.country].filter(Boolean).join(', '),
  ];

  return locationValues.some((value) => (
    normalizeText(value) && normalizeText(value) === normalizedDescription
  ));
}

export function getCafeteriaDescription(site, vendors) {
  const siteDescription = typeof site.description === 'string' ? site.description.trim() : '';
  if (siteDescription) return siteDescription;

  const vendorDescription = [...vendors]
    .sort((first, second) => String(first.name || '').localeCompare(String(second.name || '')))
    .map((vendor) => (typeof vendor.description === 'string' ? vendor.description.trim() : ''))
    .find((description) => description && !isLocationDescription(description, site));

  return vendorDescription || null;
}
