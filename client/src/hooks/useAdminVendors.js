import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './useAuth.js';
import {
  addVendorUser,
  createVendor,
  createVendorLocation,
  getVendor,
  listVendorApprovals,
  listVendors,
  removeVendorUser,
  updateVendor,
  updateVendorApproval,
  updateVendorLocation,
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

function removeById(items, id) {
  return items.filter((item) => item.id !== id);
}

function updateDetailVendor(detail, vendor) {
  if (!detail || !vendor || detail.id !== vendor.id) return detail;
  return { ...detail, ...vendor };
}

export function useAdminVendors({
  autoLoad = true,
  vendorParams = DEFAULT_LIST_PARAMS,
  approvalParams = DEFAULT_LIST_PARAMS,
} = {}) {
  const { session, initialized } = useAuth();
  const token = session?.access_token;
  const mountedRef = useRef(false);

  const [vendors, setVendors] = useState([]);
  const [vendorPagination, setVendorPagination] = useState(EMPTY_PAGINATION);
  const [approvals, setApprovals] = useState([]);
  const [approvalPagination, setApprovalPagination] = useState(EMPTY_PAGINATION);
  const [vendorDetails, setVendorDetails] = useState({});

  const [loading, setLoading] = useState({
    vendors: false,
    approvals: false,
    detail: false,
    mutation: false,
  });
  const [errors, setErrors] = useState({
    vendors: null,
    approvals: null,
    detail: null,
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

  const fetchVendors = useCallback(async (params = vendorParams, options = {}) => {
    setLoadingKey('vendors', true);
    setErrorKey('vendors', null);
    try {
      const payload = await listVendors(requireToken(), params, options);
      if (!mountedRef.current) return payload;
      setVendors(payload?.vendors || []);
      setVendorPagination(payload?.pagination || EMPTY_PAGINATION);
      return payload;
    } catch (error) {
      setErrorKey('vendors', getMessage(error));
      throw error;
    } finally {
      setLoadingKey('vendors', false);
    }
  }, [requireToken, setErrorKey, setLoadingKey, vendorParams]);

  const fetchApprovals = useCallback(async (params = approvalParams, options = {}) => {
    setLoadingKey('approvals', true);
    setErrorKey('approvals', null);
    try {
      const payload = await listVendorApprovals(requireToken(), params, options);
      if (!mountedRef.current) return payload;
      setApprovals(payload?.approvals || []);
      setApprovalPagination(payload?.pagination || EMPTY_PAGINATION);
      return payload;
    } catch (error) {
      setErrorKey('approvals', getMessage(error));
      throw error;
    } finally {
      setLoadingKey('approvals', false);
    }
  }, [approvalParams, requireToken, setErrorKey, setLoadingKey]);

  const fetchVendor = useCallback(async (vendorId, options = {}) => {
    setLoadingKey('detail', true);
    setErrorKey('detail', null);
    try {
      const payload = await getVendor(requireToken(), vendorId, options);
      if (!mountedRef.current) return payload;
      if (payload?.vendor) {
        setVendorDetails((prev) => ({ ...prev, [vendorId]: payload.vendor }));
      }
      return payload;
    } catch (error) {
      setErrorKey('detail', getMessage(error));
      throw error;
    } finally {
      setLoadingKey('detail', false);
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

  const addVendor = useCallback((payload) => runMutation(async (authToken) => {
    const response = await createVendor(authToken, payload);
    if (mountedRef.current && response?.vendor) {
      setVendors((prev) => upsertById(prev, response.vendor));
      setApprovals((prev) => upsertById(prev, response.vendor));
    }
    await Promise.all([
      fetchVendors(),
      fetchApprovals(),
    ]);
    return response;
  }), [fetchApprovals, fetchVendors, runMutation]);

  const editVendor = useCallback((vendorId, payload) => runMutation(async (authToken) => {
    const response = await updateVendor(authToken, vendorId, payload);
    if (mountedRef.current && response?.vendor) {
      setVendors((prev) => upsertById(prev, response.vendor));
      setApprovals((prev) => upsertById(prev, response.vendor));
      setVendorDetails((prev) => ({
        ...prev,
        [vendorId]: updateDetailVendor(prev[vendorId], response.vendor),
      }));
    }
    return response;
  }), [runMutation]);

  const setVendorApproval = useCallback((vendorId, payload) => runMutation(async (authToken) => {
    const response = await updateVendorApproval(authToken, vendorId, payload);
    if (mountedRef.current && response?.vendor) {
      setVendors((prev) => upsertById(prev, response.vendor));
      setVendorDetails((prev) => ({
        ...prev,
        [vendorId]: updateDetailVendor(prev[vendorId], response.vendor),
      }));
      if (response.vendor.status === 'pending') {
        setApprovals((prev) => upsertById(prev, response.vendor));
      } else {
        setApprovals((prev) => removeById(prev, vendorId));
      }
    }
    await Promise.all([
      fetchVendors(),
      fetchApprovals(),
    ]);
    return response;
  }), [fetchApprovals, fetchVendors, runMutation]);

  const approveVendor = useCallback((vendorId, reason = null) => (
    setVendorApproval(vendorId, { decision: 'approve', reason })
  ), [setVendorApproval]);

  const rejectVendor = useCallback((vendorId, reason) => (
    setVendorApproval(vendorId, { decision: 'reject', reason })
  ), [setVendorApproval]);

  const suspendVendor = useCallback((vendorId, reason = null) => (
    setVendorApproval(vendorId, { decision: 'suspend', reason })
  ), [setVendorApproval]);

  const activateVendor = useCallback((vendorId, reason = null) => (
    setVendorApproval(vendorId, { decision: 'activate', reason })
  ), [setVendorApproval]);

  const addVendorLocation = useCallback((vendorId, payload) => runMutation(async (authToken) => {
    const response = await createVendorLocation(authToken, vendorId, payload);
    if (mountedRef.current && response?.vendorLocation) {
      setVendorDetails((prev) => {
        const detail = prev[vendorId];
        if (!detail) return prev;
        return {
          ...prev,
          [vendorId]: {
            ...detail,
            locations: upsertById(detail.locations || [], response.vendorLocation),
          },
        };
      });
    }
    await fetchVendor(vendorId);
    return response;
  }), [fetchVendor, runMutation]);

  const editVendorLocation = useCallback((vendorId, locationId, payload) => runMutation(async (authToken) => {
    const response = await updateVendorLocation(authToken, locationId, payload);
    if (mountedRef.current && response?.vendorLocation) {
      setVendorDetails((prev) => {
        const detail = prev[vendorId];
        if (!detail) return prev;
        return {
          ...prev,
          [vendorId]: {
            ...detail,
            locations: upsertById(detail.locations || [], response.vendorLocation),
          },
        };
      });
    }
    return response;
  }), [runMutation]);

  const addVendorMember = useCallback((vendorId, payload) => runMutation(async (authToken) => {
    const response = await addVendorUser(authToken, vendorId, payload);
    if (mountedRef.current && response?.member) {
      setVendorDetails((prev) => {
        const detail = prev[vendorId];
        if (!detail) return prev;
        const staff = detail.staff || [];
        const index = staff.findIndex((member) => member.user_id === response.member.user_id);
        const nextStaff = index === -1
          ? [response.member, ...staff]
          : staff.map((member) => member.user_id === response.member.user_id ? response.member : member);
        return {
          ...prev,
          [vendorId]: { ...detail, staff: nextStaff },
        };
      });
    }
    return response;
  }), [runMutation]);

  const removeVendorMember = useCallback((vendorId, userId) => runMutation(async (authToken) => {
    const response = await removeVendorUser(authToken, vendorId, userId);
    if (mountedRef.current) {
      setVendorDetails((prev) => {
        const detail = prev[vendorId];
        if (!detail) return prev;
        return {
          ...prev,
          [vendorId]: {
            ...detail,
            staff: (detail.staff || []).filter((member) => member.user_id !== userId),
          },
        };
      });
    }
    return response;
  }), [runMutation]);

  useEffect(() => {
    if (!autoLoad || !initialized || !token) return;
    Promise.all([
      fetchVendors().catch(() => {}),
      fetchApprovals().catch(() => {}),
    ]);
  }, [autoLoad, fetchApprovals, fetchVendors, initialized, token]);

  const vendorsById = useMemo(
    () => vendors.reduce((map, vendor) => ({ ...map, [vendor.id]: vendor }), {}),
    [vendors],
  );

  const approvalCount = approvalPagination.total || approvals.length;

  return {
    vendors,
    vendorsById,
    vendorPagination,
    approvals,
    approvalPagination,
    approvalCount,
    vendorDetails,
    loading,
    errors,
    hasSession: !!token,
    clearError,
    fetchVendors,
    fetchApprovals,
    fetchVendor,
    addVendor,
    editVendor,
    setVendorApproval,
    approveVendor,
    rejectVendor,
    suspendVendor,
    activateVendor,
    addVendorLocation,
    editVendorLocation,
    addVendorMember,
    removeVendorMember,
  };
}
