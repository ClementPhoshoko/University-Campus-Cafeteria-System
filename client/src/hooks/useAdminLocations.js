import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './useAuth.js';
import { getCache, setCache, invalidateCache, invalidateCachePattern, makeCacheKey } from '../services/cache.js';
import {
  createBuilding,
  createCollectionPoint,
  createDeliveryLocation,
  createFloor,
  createSite,
  listAllBuildings,
  listAllCollectionPoints,
  listBuildings,
  listCollectionPoints,
  listDeliveryLocations,
  listFloors,
  listSites,
  updateBuilding,
  updateCollectionPoint,
  updateDeliveryLocation,
  updateFloor,
  updateSite,
} from '../services/adminApi.js';

const DEFAULT_LIST_PARAMS = { page: 1, limit: 100 };

const EMPTY_PAGINATION = {
  page: 1,
  limit: 100,
  total: 0,
  totalPages: 0,
};

function getMessage(error) {
  return error?.message || 'Something went wrong';
}

function upsertById(items, item) {
  if (!item?.id) return items;
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index === -1) return [item, ...items];
  return items.map((existing) => existing.id === item.id ? item : existing);
}

function removeKey(state, key) {
  const next = { ...state };
  delete next[key];
  return next;
}

export function useAdminLocations({
  autoLoad = true,
  siteParams = DEFAULT_LIST_PARAMS,
} = {}) {
  const { session, initialized } = useAuth();
  const token = session?.access_token;
  const mountedRef = useRef(false);
  const requestIdsRef = useRef({});
  const nextRequestId = useCallback((key) => {
    requestIdsRef.current[key] = (requestIdsRef.current[key] || 0) + 1;
    return requestIdsRef.current[key];
  }, []);

  const [sites, setSites] = useState([]);
  const [sitePagination, setSitePagination] = useState(EMPTY_PAGINATION);
  const [buildingsBySite, setBuildingsBySite] = useState({});
  const [buildingPaginationBySite, setBuildingPaginationBySite] = useState({});
  const [floorsByBuilding, setFloorsByBuilding] = useState({});
  const [floorPaginationByBuilding, setFloorPaginationByBuilding] = useState({});
  const [collectionPointsByBuilding, setCollectionPointsByBuilding] = useState({});
  const [collectionPointPaginationByBuilding, setCollectionPointPaginationByBuilding] = useState({});
  const [deliveryLocationsByBuilding, setDeliveryLocationsByBuilding] = useState({});
  const [deliveryLocationPaginationByBuilding, setDeliveryLocationPaginationByBuilding] = useState({});

  const [loading, setLoading] = useState({
    sites: false,
    buildings: false,
    floors: false,
    collectionPoints: false,
    deliveryLocations: false,
    mutation: false,
  });
  const [errors, setErrors] = useState({
    sites: null,
    buildings: null,
    floors: null,
    collectionPoints: null,
    deliveryLocations: null,
    mutation: null,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setLoadingKey = useCallback((key, value) => {
    if (!mountedRef.current) return;
    setLoading((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setErrorKey = useCallback((key, value) => {
    if (!mountedRef.current) return;
    setErrors((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearError = useCallback((key) => {
    setErrorKey(key, null);
  }, [setErrorKey]);

  const requireToken = useCallback(() => {
    if (!token) throw new Error('Admin session is required');
    return token;
  }, [token]);

  const fetchSites = useCallback(async (params = siteParams, options = {}) => {
    const requestId = nextRequestId('sites');
    const controller = new AbortController();
    const cacheKey = makeCacheKey('/admin/sites', params);

    const cached = getCache(cacheKey);
    if (cached && !cached.isStale && mountedRef.current) {
      setSites(cached.data.sites || []);
      setSitePagination(cached.data.pagination || EMPTY_PAGINATION);
      setLoadingKey('sites', false);
      setErrorKey('sites', null);
      setCache(cacheKey, cached.data, 300_000);
      const doRefresh = async () => {
        try {
          const fresh = await listSites(requireToken(), params, { ...options, signal: controller.signal });
          if (requestId !== requestIdsRef.current.sites || !mountedRef.current) return;
          setSites(fresh?.sites || []);
          setSitePagination(fresh?.pagination || EMPTY_PAGINATION);
          setCache(cacheKey, fresh, 300_000);
        } catch { /* background refresh failed, keep stale data */ }
      };
      doRefresh();
      return cached.data;
    }

    setLoadingKey('sites', true);
    setErrorKey('sites', null);
    try {
      const payload = await listSites(requireToken(), params, { ...options, signal: controller.signal });
      if (!mountedRef.current || requestId !== requestIdsRef.current.sites) return payload;
      setSites(payload?.sites || []);
      setSitePagination(payload?.pagination || EMPTY_PAGINATION);
      setCache(cacheKey, payload, 300_000);
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') return undefined;
      if (requestId === requestIdsRef.current.sites) setErrorKey('sites', getMessage(error));
      throw error;
    } finally {
      if (requestId === requestIdsRef.current.sites) setLoadingKey('sites', false);
    }
  }, [requireToken, setErrorKey, setLoadingKey, siteParams]);

  const fetchBuildings = useCallback(async (siteId, params = DEFAULT_LIST_PARAMS, options = {}) => {
    const requestId = nextRequestId('buildings');
    const controller = new AbortController();
    const cacheKey = makeCacheKey(`/admin/sites/${siteId}/buildings`, params);

    const cached = getCache(cacheKey);
    if (cached && !cached.isStale && mountedRef.current) {
      setBuildingsBySite((prev) => ({ ...prev, [siteId]: cached.data.buildings || [] }));
      setBuildingPaginationBySite((prev) => ({ ...prev, [siteId]: cached.data.pagination || EMPTY_PAGINATION }));
      setLoadingKey('buildings', false);
      setErrorKey('buildings', null);
      const doRefresh = async () => {
        try {
          const fresh = await listBuildings(requireToken(), siteId, params, { ...options, signal: controller.signal });
          if (requestId !== requestIdsRef.current.buildings || !mountedRef.current) return;
          setBuildingsBySite((prev) => ({ ...prev, [siteId]: fresh?.buildings || [] }));
          setBuildingPaginationBySite((prev) => ({ ...prev, [siteId]: fresh?.pagination || EMPTY_PAGINATION }));
          setCache(cacheKey, fresh, 300_000);
        } catch { /* background refresh failed */ }
      };
      doRefresh();
      return cached.data;
    }

    setLoadingKey('buildings', true);
    setErrorKey('buildings', null);
    try {
      const payload = await listBuildings(requireToken(), siteId, params, options);
      if (!mountedRef.current || requestId !== requestIdsRef.current.buildings) return payload;
      setBuildingsBySite((prev) => ({ ...prev, [siteId]: payload?.buildings || [] }));
      setBuildingPaginationBySite((prev) => ({ ...prev, [siteId]: payload?.pagination || EMPTY_PAGINATION }));
      setCache(cacheKey, payload, 300_000);
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') return undefined;
      setErrorKey('buildings', getMessage(error));
      throw error;
    } finally {
      setLoadingKey('buildings', false);
    }
  }, [requireToken, setErrorKey, setLoadingKey]);

  const fetchFloors = useCallback(async (buildingId, params = DEFAULT_LIST_PARAMS, options = {}) => {
    const requestId = nextRequestId('floors');
    const controller = new AbortController();
    const cacheKey = makeCacheKey(`/admin/buildings/${buildingId}/floors`, params);

    const cached = getCache(cacheKey);
    if (cached && !cached.isStale && mountedRef.current) {
      setFloorsByBuilding((prev) => ({ ...prev, [buildingId]: cached.data.floors || [] }));
      setFloorPaginationByBuilding((prev) => ({ ...prev, [buildingId]: cached.data.pagination || EMPTY_PAGINATION }));
      setLoadingKey('floors', false);
      setErrorKey('floors', null);
      const doRefresh = async () => {
        try {
          const fresh = await listFloors(requireToken(), buildingId, params, { ...options, signal: controller.signal });
          if (requestId !== requestIdsRef.current.floors || !mountedRef.current) return;
          setFloorsByBuilding((prev) => ({ ...prev, [buildingId]: fresh?.floors || [] }));
          setFloorPaginationByBuilding((prev) => ({ ...prev, [buildingId]: fresh?.pagination || EMPTY_PAGINATION }));
          setCache(cacheKey, fresh, 300_000);
        } catch { /* background refresh failed */ }
      };
      doRefresh();
      return cached.data;
    }

    setLoadingKey('floors', true);
    setErrorKey('floors', null);
    try {
      const payload = await listFloors(requireToken(), buildingId, params, options);
      if (!mountedRef.current) return payload;
      setFloorsByBuilding((prev) => ({ ...prev, [buildingId]: payload?.floors || [] }));
      setFloorPaginationByBuilding((prev) => ({ ...prev, [buildingId]: payload?.pagination || EMPTY_PAGINATION }));
      setCache(cacheKey, payload, 300_000);
      return payload;
    } catch (error) {
      setErrorKey('floors', getMessage(error));
      throw error;
    } finally {
      setLoadingKey('floors', false);
    }
  }, [requireToken, setErrorKey, setLoadingKey]);

  const fetchCollectionPoints = useCallback(async (buildingId, params = DEFAULT_LIST_PARAMS, options = {}) => {
    const requestId = nextRequestId('collectionPoints');
    const controller = new AbortController();
    const cacheKey = makeCacheKey(`/admin/buildings/${buildingId}/collection-points`, params);

    const cached = getCache(cacheKey);
    if (cached && !cached.isStale && mountedRef.current) {
      setCollectionPointsByBuilding((prev) => ({ ...prev, [buildingId]: cached.data.collectionPoints || [] }));
      setCollectionPointPaginationByBuilding((prev) => ({ ...prev, [buildingId]: cached.data.pagination || EMPTY_PAGINATION }));
      setLoadingKey('collectionPoints', false);
      setErrorKey('collectionPoints', null);
      const doRefresh = async () => {
        try {
          const fresh = await listCollectionPoints(requireToken(), buildingId, params, { ...options, signal: controller.signal });
          if (requestId !== requestIdsRef.current.collectionPoints || !mountedRef.current) return;
          setCollectionPointsByBuilding((prev) => ({ ...prev, [buildingId]: fresh?.collectionPoints || [] }));
          setCollectionPointPaginationByBuilding((prev) => ({ ...prev, [buildingId]: fresh?.pagination || EMPTY_PAGINATION }));
          setCache(cacheKey, fresh, 300_000);
        } catch { /* background refresh failed */ }
      };
      doRefresh();
      return cached.data;
    }

    setLoadingKey('collectionPoints', true);
    setErrorKey('collectionPoints', null);
    try {
      const payload = await listCollectionPoints(requireToken(), buildingId, params, options);
      if (!mountedRef.current) return payload;
      setCollectionPointsByBuilding((prev) => ({ ...prev, [buildingId]: payload?.collectionPoints || [] }));
      setCollectionPointPaginationByBuilding((prev) => ({ ...prev, [buildingId]: payload?.pagination || EMPTY_PAGINATION }));
      setCache(cacheKey, payload, 300_000);
      return payload;
    } catch (error) {
      setErrorKey('collectionPoints', getMessage(error));
      throw error;
    } finally {
      setLoadingKey('collectionPoints', false);
    }
  }, [requireToken, setErrorKey, setLoadingKey]);

  const fetchDeliveryLocations = useCallback(async (buildingId, params = DEFAULT_LIST_PARAMS, options = {}) => {
    const requestId = nextRequestId('deliveryLocations');
    const controller = new AbortController();
    const cacheKey = makeCacheKey(`/admin/buildings/${buildingId}/delivery-locations`, params);

    const cached = getCache(cacheKey);
    if (cached && !cached.isStale && mountedRef.current) {
      setDeliveryLocationsByBuilding((prev) => ({ ...prev, [buildingId]: cached.data.deliveryLocations || [] }));
      setDeliveryLocationPaginationByBuilding((prev) => ({ ...prev, [buildingId]: cached.data.pagination || EMPTY_PAGINATION }));
      setLoadingKey('deliveryLocations', false);
      setErrorKey('deliveryLocations', null);
      const doRefresh = async () => {
        try {
          const fresh = await listDeliveryLocations(requireToken(), buildingId, params, { ...options, signal: controller.signal });
          if (requestId !== requestIdsRef.current.deliveryLocations || !mountedRef.current) return;
          setDeliveryLocationsByBuilding((prev) => ({ ...prev, [buildingId]: fresh?.deliveryLocations || [] }));
          setDeliveryLocationPaginationByBuilding((prev) => ({ ...prev, [buildingId]: fresh?.pagination || EMPTY_PAGINATION }));
          setCache(cacheKey, fresh, 300_000);
        } catch { /* background refresh failed */ }
      };
      doRefresh();
      return cached.data;
    }

    setLoadingKey('deliveryLocations', true);
    setErrorKey('deliveryLocations', null);
    try {
      const payload = await listDeliveryLocations(requireToken(), buildingId, params, options);
      if (!mountedRef.current) return payload;
      setDeliveryLocationsByBuilding((prev) => ({ ...prev, [buildingId]: payload?.deliveryLocations || [] }));
      setDeliveryLocationPaginationByBuilding((prev) => ({ ...prev, [buildingId]: payload?.pagination || EMPTY_PAGINATION }));
      setCache(cacheKey, payload, 300_000);
      return payload;
    } catch (error) {
      setErrorKey('deliveryLocations', getMessage(error));
      throw error;
    } finally {
      setLoadingKey('deliveryLocations', false);
    }
  }, [requireToken, setErrorKey, setLoadingKey]);

  const fetchAllBuildings = useCallback(async (params = DEFAULT_LIST_PARAMS, options = {}) => {
    const requestId = nextRequestId('allBuildings');
    const controller = new AbortController();
    const cacheKey = makeCacheKey('/admin/all-buildings', params);

    const cached = getCache(cacheKey);
    if (cached && !cached.isStale && mountedRef.current) {
      const buildings = cached.data.buildings || [];
      const grouped = {};
      for (const b of buildings) {
        const sid = b.site_id;
        if (!grouped[sid]) grouped[sid] = [];
        grouped[sid].push(b);
      }
      setBuildingsBySite((prev) => ({ ...prev, ...grouped }));
      setLoadingKey('buildings', false);
      setErrorKey('buildings', null);
      const doRefresh = async () => {
        try {
          const fresh = await listAllBuildings(requireToken(), params, { ...options, signal: controller.signal });
          if (requestId !== requestIdsRef.current.allBuildings || !mountedRef.current) return;
          const buildings = fresh?.buildings || [];
          const grouped = {};
          for (const b of buildings) {
            const sid = b.site_id;
            if (!grouped[sid]) grouped[sid] = [];
            grouped[sid].push(b);
          }
          setBuildingsBySite((prev) => ({ ...prev, ...grouped }));
          setCache(cacheKey, fresh, 300_000);
        } catch { /* background refresh failed */ }
      };
      doRefresh();
      return cached.data;
    }

    setLoadingKey('buildings', true);
    setErrorKey('buildings', null);
    try {
      const payload = await listAllBuildings(requireToken(), params, options);
      if (!mountedRef.current) return payload;
      const buildings = payload?.buildings || [];
      const grouped = {};
      for (const b of buildings) {
        const sid = b.site_id;
        if (!grouped[sid]) grouped[sid] = [];
        grouped[sid].push(b);
      }
      setBuildingsBySite((prev) => ({ ...prev, ...grouped }));
      setCache(cacheKey, payload, 300_000);
      return payload;
    } catch (error) {
      setErrorKey('buildings', getMessage(error));
      throw error;
    } finally {
      setLoadingKey('buildings', false);
    }
  }, [requireToken, setErrorKey, setLoadingKey]);

  const fetchAllCollectionPoints = useCallback(async (params = DEFAULT_LIST_PARAMS, options = {}) => {
    const requestId = nextRequestId('allCollectionPoints');
    const controller = new AbortController();
    const cacheKey = makeCacheKey('/admin/all-collection-points', params);

    const cached = getCache(cacheKey);
    if (cached && !cached.isStale && mountedRef.current) {
      const points = cached.data.collectionPoints || [];
      const grouped = {};
      for (const cp of points) {
        const bid = cp.building_id;
        if (!grouped[bid]) grouped[bid] = [];
        grouped[bid].push(cp);
      }
      setCollectionPointsByBuilding((prev) => ({ ...prev, ...grouped }));
      setLoadingKey('collectionPoints', false);
      setErrorKey('collectionPoints', null);
      const doRefresh = async () => {
        try {
          const fresh = await listAllCollectionPoints(requireToken(), params, { ...options, signal: controller.signal });
          if (requestId !== requestIdsRef.current.allCollectionPoints || !mountedRef.current) return;
          const points = fresh?.collectionPoints || [];
          const grouped = {};
          for (const cp of points) {
            const bid = cp.building_id;
            if (!grouped[bid]) grouped[bid] = [];
            grouped[bid].push(cp);
          }
          setCollectionPointsByBuilding((prev) => ({ ...prev, ...grouped }));
          setCache(cacheKey, fresh, 300_000);
        } catch { /* background refresh failed */ }
      };
      doRefresh();
      return cached.data;
    }

    setLoadingKey('collectionPoints', true);
    setErrorKey('collectionPoints', null);
    try {
      const payload = await listAllCollectionPoints(requireToken(), params, options);
      if (!mountedRef.current) return payload;
      const points = payload?.collectionPoints || [];
      const grouped = {};
      for (const cp of points) {
        const bid = cp.building_id;
        if (!grouped[bid]) grouped[bid] = [];
        grouped[bid].push(cp);
      }
      setCollectionPointsByBuilding((prev) => ({ ...prev, ...grouped }));
      setCache(cacheKey, payload, 300_000);
      return payload;
    } catch (error) {
      setErrorKey('collectionPoints', getMessage(error));
      throw error;
    } finally {
      setLoadingKey('collectionPoints', false);
    }
  }, [requireToken, setErrorKey, setLoadingKey]);

  const runMutation = useCallback(async (operation) => {
    setLoadingKey('mutation', true);
    setErrorKey('mutation', null);
    try {
      return await operation(requireToken());
    } catch (error) {
      setErrorKey('mutation', getMessage(error));
      throw error;
    } finally {
      setLoadingKey('mutation', false);
    }
  }, [requireToken, setErrorKey, setLoadingKey]);

  const addSite = useCallback((payload) => runMutation(async (authToken) => {
    const response = await createSite(authToken, payload);
    if (mountedRef.current && response?.site) {
      setSites((prev) => upsertById(prev, response.site));
    }
    invalidateCachePattern('/admin/sites');
    await fetchSites();
    return response;
  }), [fetchSites, runMutation]);

  const editSite = useCallback((siteId, payload) => runMutation(async (authToken) => {
    const response = await updateSite(authToken, siteId, payload);
    if (mountedRef.current && response?.site) {
      setSites((prev) => upsertById(prev, response.site));
    }
    invalidateCachePattern('/admin/sites');
    return response;
  }), [runMutation]);

  const addBuilding = useCallback((siteId, payload) => runMutation(async (authToken) => {
    const response = await createBuilding(authToken, siteId, payload);
    if (mountedRef.current && response?.building) {
      setBuildingsBySite((prev) => ({
        ...prev,
        [siteId]: upsertById(prev[siteId] || [], response.building),
      }));
    }
    invalidateCachePattern(`/admin/sites/${siteId}/buildings`);
    invalidateCachePattern('/admin/all-buildings');
    await fetchSites();
    await fetchBuildings(siteId);
    return response;
  }), [fetchBuildings, fetchSites, runMutation]);

  const editBuilding = useCallback((buildingId, payload) => runMutation(async (authToken) => {
    const response = await updateBuilding(authToken, buildingId, payload);
    if (mountedRef.current && response?.building) {
      const siteId = response.building.site_id;
      setBuildingsBySite((prev) => ({
        ...prev,
        [siteId]: upsertById(prev[siteId] || [], response.building),
      }));
    }
    return response;
  }), [runMutation]);

  const addFloor = useCallback((buildingId, payload) => runMutation(async (authToken) => {
    const response = await createFloor(authToken, buildingId, payload);
    if (mountedRef.current && response?.floor) {
      setFloorsByBuilding((prev) => ({
        ...prev,
        [buildingId]: upsertById(prev[buildingId] || [], response.floor),
      }));
    }
    invalidateCachePattern(`/admin/buildings/${buildingId}/floors`);
    await fetchFloors(buildingId);
    return response;
  }), [fetchFloors, runMutation]);

  const editFloor = useCallback((floorId, payload) => runMutation(async (authToken) => {
    const response = await updateFloor(authToken, floorId, payload);
    if (mountedRef.current && response?.floor) {
      const buildingId = response.floor.building_id;
      setFloorsByBuilding((prev) => ({
        ...prev,
        [buildingId]: upsertById(prev[buildingId] || [], response.floor),
      }));
    }
    return response;
  }), [runMutation]);

  const addCollectionPoint = useCallback((buildingId, payload) => runMutation(async (authToken) => {
    const response = await createCollectionPoint(authToken, buildingId, payload);
    if (mountedRef.current && response?.collectionPoint) {
      setCollectionPointsByBuilding((prev) => ({
        ...prev,
        [buildingId]: upsertById(prev[buildingId] || [], response.collectionPoint),
      }));
    }
    invalidateCachePattern(`/admin/buildings/${buildingId}/collection-points`);
    await fetchCollectionPoints(buildingId);
    return response;
  }), [fetchCollectionPoints, runMutation]);

  const editCollectionPoint = useCallback((collectionPointId, payload) => runMutation(async (authToken) => {
    const response = await updateCollectionPoint(authToken, collectionPointId, payload);
    if (mountedRef.current && response?.collectionPoint) {
      const buildingId = response.collectionPoint.building_id;
      setCollectionPointsByBuilding((prev) => ({
        ...prev,
        [buildingId]: upsertById(prev[buildingId] || [], response.collectionPoint),
      }));
    }
    return response;
  }), [runMutation]);

  const addDeliveryLocation = useCallback((buildingId, payload) => runMutation(async (authToken) => {
    const response = await createDeliveryLocation(authToken, buildingId, payload);
    if (mountedRef.current && response?.deliveryLocation) {
      setDeliveryLocationsByBuilding((prev) => ({
        ...prev,
        [buildingId]: upsertById(prev[buildingId] || [], response.deliveryLocation),
      }));
    }
    invalidateCachePattern(`/admin/buildings/${buildingId}/delivery-locations`);
    await fetchDeliveryLocations(buildingId);
    return response;
  }), [fetchDeliveryLocations, runMutation]);

  const editDeliveryLocation = useCallback((deliveryLocationId, payload) => runMutation(async (authToken) => {
    const response = await updateDeliveryLocation(authToken, deliveryLocationId, payload);
    if (mountedRef.current && response?.deliveryLocation) {
      const buildingId = response.deliveryLocation.building_id;
      setDeliveryLocationsByBuilding((prev) => ({
        ...prev,
        [buildingId]: upsertById(prev[buildingId] || [], response.deliveryLocation),
      }));
    }
    return response;
  }), [runMutation]);

  const resetBuildingCache = useCallback((siteId) => {
    setBuildingsBySite((prev) => removeKey(prev, siteId));
    setBuildingPaginationBySite((prev) => removeKey(prev, siteId));
    invalidateCachePattern(`/admin/sites/${siteId}/buildings`);
  }, []);

  const resetBuildingChildrenCache = useCallback((buildingId) => {
    setFloorsByBuilding((prev) => removeKey(prev, buildingId));
    setFloorPaginationByBuilding((prev) => removeKey(prev, buildingId));
    setCollectionPointsByBuilding((prev) => removeKey(prev, buildingId));
    setCollectionPointPaginationByBuilding((prev) => removeKey(prev, buildingId));
    setDeliveryLocationsByBuilding((prev) => removeKey(prev, buildingId));
    setDeliveryLocationPaginationByBuilding((prev) => removeKey(prev, buildingId));
    invalidateCachePattern(`/admin/buildings/${buildingId}/`);
  }, []);

  useEffect(() => {
    if (!autoLoad || !initialized || !token) return;
    fetchSites().catch(() => {});
  }, [autoLoad, fetchSites, initialized, token]);

  const allBuildings = useMemo(
    () => Object.values(buildingsBySite).flat(),
    [buildingsBySite],
  );

  const allFloors = useMemo(
    () => Object.values(floorsByBuilding).flat(),
    [floorsByBuilding],
  );

  const allCollectionPoints = useMemo(
    () => Object.values(collectionPointsByBuilding).flat(),
    [collectionPointsByBuilding],
  );

  const allDeliveryLocations = useMemo(
    () => Object.values(deliveryLocationsByBuilding).flat(),
    [deliveryLocationsByBuilding],
  );

  return {
    sites,
    sitePagination,
    buildingsBySite,
    buildingPaginationBySite,
    floorsByBuilding,
    floorPaginationByBuilding,
    collectionPointsByBuilding,
    collectionPointPaginationByBuilding,
    deliveryLocationsByBuilding,
    deliveryLocationPaginationByBuilding,
    allBuildings,
    allFloors,
    allCollectionPoints,
    allDeliveryLocations,
    loading,
    errors,
    hasSession: !!token,
    clearError,
    fetchSites,
    fetchBuildings,
    fetchAllBuildings,
    fetchAllCollectionPoints,
    fetchFloors,
    fetchCollectionPoints,
    fetchDeliveryLocations,
    addSite,
    editSite,
    addBuilding,
    editBuilding,
    addFloor,
    editFloor,
    addCollectionPoint,
    editCollectionPoint,
    addDeliveryLocation,
    editDeliveryLocation,
    resetBuildingCache,
    resetBuildingChildrenCache,
  };
}
