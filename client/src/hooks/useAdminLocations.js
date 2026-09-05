import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './useAuth.js';
import {
  createBuilding,
  createCollectionPoint,
  createDeliveryLocation,
  createFloor,
  createSite,
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
    setLoadingKey('sites', true);
    setErrorKey('sites', null);
    try {
      const payload = await listSites(requireToken(), params, options);
      if (!mountedRef.current) return payload;
      setSites(payload?.sites || []);
      setSitePagination(payload?.pagination || EMPTY_PAGINATION);
      return payload;
    } catch (error) {
      setErrorKey('sites', getMessage(error));
      throw error;
    } finally {
      setLoadingKey('sites', false);
    }
  }, [requireToken, setErrorKey, setLoadingKey, siteParams]);

  const fetchBuildings = useCallback(async (siteId, params = DEFAULT_LIST_PARAMS, options = {}) => {
    setLoadingKey('buildings', true);
    setErrorKey('buildings', null);
    try {
      const payload = await listBuildings(requireToken(), siteId, params, options);
      if (!mountedRef.current) return payload;
      setBuildingsBySite((prev) => ({ ...prev, [siteId]: payload?.buildings || [] }));
      setBuildingPaginationBySite((prev) => ({ ...prev, [siteId]: payload?.pagination || EMPTY_PAGINATION }));
      return payload;
    } catch (error) {
      setErrorKey('buildings', getMessage(error));
      throw error;
    } finally {
      setLoadingKey('buildings', false);
    }
  }, [requireToken, setErrorKey, setLoadingKey]);

  const fetchFloors = useCallback(async (buildingId, params = DEFAULT_LIST_PARAMS, options = {}) => {
    setLoadingKey('floors', true);
    setErrorKey('floors', null);
    try {
      const payload = await listFloors(requireToken(), buildingId, params, options);
      if (!mountedRef.current) return payload;
      setFloorsByBuilding((prev) => ({ ...prev, [buildingId]: payload?.floors || [] }));
      setFloorPaginationByBuilding((prev) => ({ ...prev, [buildingId]: payload?.pagination || EMPTY_PAGINATION }));
      return payload;
    } catch (error) {
      setErrorKey('floors', getMessage(error));
      throw error;
    } finally {
      setLoadingKey('floors', false);
    }
  }, [requireToken, setErrorKey, setLoadingKey]);

  const fetchCollectionPoints = useCallback(async (buildingId, params = DEFAULT_LIST_PARAMS, options = {}) => {
    setLoadingKey('collectionPoints', true);
    setErrorKey('collectionPoints', null);
    try {
      const payload = await listCollectionPoints(requireToken(), buildingId, params, options);
      if (!mountedRef.current) return payload;
      setCollectionPointsByBuilding((prev) => ({ ...prev, [buildingId]: payload?.collectionPoints || [] }));
      setCollectionPointPaginationByBuilding((prev) => ({ ...prev, [buildingId]: payload?.pagination || EMPTY_PAGINATION }));
      return payload;
    } catch (error) {
      setErrorKey('collectionPoints', getMessage(error));
      throw error;
    } finally {
      setLoadingKey('collectionPoints', false);
    }
  }, [requireToken, setErrorKey, setLoadingKey]);

  const fetchDeliveryLocations = useCallback(async (buildingId, params = DEFAULT_LIST_PARAMS, options = {}) => {
    setLoadingKey('deliveryLocations', true);
    setErrorKey('deliveryLocations', null);
    try {
      const payload = await listDeliveryLocations(requireToken(), buildingId, params, options);
      if (!mountedRef.current) return payload;
      setDeliveryLocationsByBuilding((prev) => ({ ...prev, [buildingId]: payload?.deliveryLocations || [] }));
      setDeliveryLocationPaginationByBuilding((prev) => ({ ...prev, [buildingId]: payload?.pagination || EMPTY_PAGINATION }));
      return payload;
    } catch (error) {
      setErrorKey('deliveryLocations', getMessage(error));
      throw error;
    } finally {
      setLoadingKey('deliveryLocations', false);
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
    await fetchSites();
    return response;
  }), [fetchSites, runMutation]);

  const editSite = useCallback((siteId, payload) => runMutation(async (authToken) => {
    const response = await updateSite(authToken, siteId, payload);
    if (mountedRef.current && response?.site) {
      setSites((prev) => upsertById(prev, response.site));
    }
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
  }, []);

  const resetBuildingChildrenCache = useCallback((buildingId) => {
    setFloorsByBuilding((prev) => removeKey(prev, buildingId));
    setFloorPaginationByBuilding((prev) => removeKey(prev, buildingId));
    setCollectionPointsByBuilding((prev) => removeKey(prev, buildingId));
    setCollectionPointPaginationByBuilding((prev) => removeKey(prev, buildingId));
    setDeliveryLocationsByBuilding((prev) => removeKey(prev, buildingId));
    setDeliveryLocationPaginationByBuilding((prev) => removeKey(prev, buildingId));
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
