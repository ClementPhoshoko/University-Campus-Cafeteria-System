export function resolveVendorLocationId(locations, { requestedLocationId, preferredSiteId, preferredBuildingId } = {}) {
  const activeLocations = (Array.isArray(locations) ? locations : []).filter((location) => location?.is_active !== false);
  const requested = activeLocations.find((location) => location.id === requestedLocationId);
  if (requested) return requested.id;

  if (preferredBuildingId) {
    const buildingMatches = activeLocations.filter((location) => location.building_id === preferredBuildingId);
    if (buildingMatches.length === 1) return buildingMatches[0].id;
  }

  if (preferredSiteId) {
    const siteMatches = activeLocations.filter((location) => location.site_id === preferredSiteId);
    if (siteMatches.length === 1) return siteMatches[0].id;
  }

  return activeLocations.length === 1 ? activeLocations[0].id : null;
}

export function makeVendorLocationOptions(locations) {
  const activeLocations = Array.isArray(locations) ? locations : [];
  const baseNames = activeLocations.map((location) => [location.site_name, location.building_name, location.collection_point_name]
      .filter(Boolean)
      .join(' · ') || 'Pickup location');
  const nameCounts = new Map();
  baseNames.forEach((name) => nameCounts.set(name, (nameCounts.get(name) || 0) + 1));
  return activeLocations.map((location, index) => {
    const baseName = baseNames[index];
    const name = nameCounts.get(baseName) > 1 ? `${baseName} · Pickup point ${index + 1}` : baseName;
    return { id: location.id, name, available: true };
  });
}
