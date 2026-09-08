import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  IconSearch,
  IconBuildingStore,
  IconStarFilled,
  IconAlertTriangle,
  IconChevronRight,
  IconCheck,
  IconX,
  IconShieldCheck,
  IconPlus,
} from '@tabler/icons-react';
import Pagination from '../../components/ui/Pagination.jsx';
import { createVendor, listVendorApprovals, listVendors, updateVendorApproval, uploadAdminAsset } from '../../services/adminApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.png';
import { AddVendorModal } from './VendorForms.jsx';

function VendorLogo({ src, alt }) {
  return (
    <div className="admin-vendors__vendor-logo">
      <img src={src} alt={alt || ''} />
    </div>
  );
}

function StatusPill({ status }) {
  return <span className={`admin-status admin-status--${status}`}>{status}</span>;
}

function ApprovalModal({ vendor, mode, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  if (!vendor) return null;
  const isApprove = mode === 'approve';
  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <div className="admin-modal__overlay" onClick={onCancel} />
      <div className="admin-modal__card">
        <header className="admin-modal__head">
          <div className={`admin-modal__icon admin-modal__icon--${isApprove ? 'success' : 'error'}`}>
            {isApprove ? <IconCheck size={20} stroke={2} /> : <IconX size={20} stroke={2} />}
          </div>
          <div>
            <h3 className="admin-modal__title">
              {isApprove ? 'Approve vendor?' : 'Reject application?'}
            </h3>
            <p className="admin-modal__sub">
              {vendor.name}
            </p>
          </div>
        </header>

        <p className="admin-modal__copy">
          {isApprove
            ? 'The vendor will be activated and notify their contact of approval. They can now publish menu items and start accepting orders.'
            : 'The vendor will be notified that their application was not accepted at this time. They will not appear in the active vendor list.'}
        </p>

        {!isApprove && (
          <label className="admin-modal__field">
            <span>Reason (will be sent to applicant)</span>
            <textarea
              className="admin-modal__textarea"
              placeholder="Briefly explain why this application was rejected..."
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        )}

        <footer className="admin-modal__foot">
          <button type="button" className="admin-action admin-action--ghost" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className={`admin-action ${isApprove ? 'admin-action--approve' : 'admin-action--reject'}`}
            onClick={() => onConfirm(vendor, mode, isApprove ? undefined : reason)}
          >
            <IconShieldCheck size={13} stroke={2} />
            {isApprove ? 'Confirm approval' : 'Confirm rejection'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function AdminVendorList() {
  const { session, initialized } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [token, setToken] = useState('');
  const [activeVendors, setActiveVendors] = useState([]);
  const [activePagination, setActivePagination] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [approvalPagination, setApprovalPagination] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [campusFilter, setCampusFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [selectedApprovals, setSelectedApprovals] = useState([]);
  const [currentPage, setCurrentPage] = useState(() => parseInt(searchParams.get('page')) || 1);

  useEffect(() => {
    const urlPage = parseInt(searchParams.get('page')) || 1;
    if (urlPage !== currentPage) setCurrentPage(urlPage);
  }, [searchParams]);

  const setPage = (value) => {
    setCurrentPage(value);
    setSearchParams((prev) => {
      if (value === 1 || value === undefined) {
        prev.delete('page');
      } else {
        prev.set('page', String(value));
      }
      return prev;
    });
  };

  const [showAddVendor, setShowAddVendor] = useState(false);
  const [addVendorLoading, setAddVendorLoading] = useState(false);
  const [tab, setTab] = useState(() => searchParams.get('tab') === 'approvals' ? 'approvals' : 'active');
  const itemsPerPage = 5;

  useEffect(() => {
    if (initialized && session?.access_token) {
      setToken(session.access_token);
    }
  }, [initialized, session]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      if (!token) return;
      try {
        // Fetch active vendors
        const vendorsResponse = await listVendors(token, {
          page: currentPage,
          limit: itemsPerPage,
          search: query,
          status: statusFilter === 'all' ? undefined : statusFilter,
        });
        setActiveVendors(vendorsResponse.vendors || []);
        setActivePagination(vendorsResponse.pagination || null);

        // Fetch pending approvals
        const approvalsResponse = await listVendorApprovals(token, { page: currentPage, limit: itemsPerPage, search: query });
        setPendingApprovals(approvalsResponse.approvals || []);
        setApprovalPagination(approvalsResponse.pagination || null);
      } catch (err) {
        console.error('Failed to fetch vendor data:', err);
      } finally {
        if (!cancelled) {
          // page stays as-is (already in sync with URL)
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [currentPage, initialized, query, statusFilter, token]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  const handlePageChange = (page) => {
    setPage(page);
  };

  const handleTabChange = (next) => {
    setTab(next);
    setSelectedApprovals([]);
    setSearchParams((prev) => {
      prev.delete('page');
      if (next === 'approvals') prev.set('tab', 'approvals');
      else prev.delete('tab');
      return prev;
    });
    setCurrentPage(1);
  };

  const CAMPUS_FILTERS = useMemo(() => {
    const vendors = activeVendors;
    const campuses = [...new Set(vendors.map((v) => v.location?.site_name).filter(Boolean))];
    return [{ id: 'all', label: 'All campuses' }, ...campuses.map(c => ({ id: c, label: c }))];
  }, [activeVendors]);

  const STATUS_FILTERS = useMemo(() => {
    const filters = [
      { id: 'all', label: 'All' },
       { id: 'pending', label: 'Pending' },
       { id: 'approved', label: 'Approved' },
       { id: 'suspended', label: 'Suspended' },
       { id: 'inactive', label: 'Inactive' },
       { id: 'rejected', label: 'Rejected' },
    ];
    return filters.map(f => ({
      ...f,
      count: f.id === 'all'
        ? activeVendors.length
        : activeVendors.filter(v => v.status === f.id).length,
    }));
  }, [activeVendors]);

  const handleApprove = (vendor) => setModal({ vendor, mode: 'approve' });
  const handleReject = (vendor) => setModal({ vendor, mode: 'reject' });

  const handleConfirm = async (vendor, mode, reason) => {
    if (!token) return;
    try {
      await updateVendorApproval(token, vendor.id, {
        decision: mode === 'approve' ? 'approve' : 'reject',
        ...(reason?.trim() ? { reason: reason.trim() } : {}),
      });
      setPendingApprovals((items) => items.filter((i) => i.id !== vendor.id));
      setActiveVendors((items) => items.map((item) => item.id === vendor.id
        ? { ...item, status: mode === 'approve' ? 'approved' : 'rejected' }
        : item));
      setSelectedApprovals((prev) => prev.filter((id) => id !== vendor.id));
      setModal(null);
    } catch (err) {
      console.error('Failed to update vendor approval:', err);
    }
  };

  const handleSelectAll = () => {
    if (selectedApprovals.length === paginatedApprovals.length) {
      setSelectedApprovals([]);
    } else {
      setSelectedApprovals(paginatedApprovals.map((v) => v.id));
    }
  };

  const handleSelectOne = (id) => {
    setSelectedApprovals((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleApproveSelected = async () => {
    if (!token) return;
    try {
      await Promise.all(selectedApprovals.map((id) => updateVendorApproval(token, id, { decision: 'approve' })));
      setPendingApprovals((items) => items.filter((i) => !selectedApprovals.includes(i.id)));
      setSelectedApprovals([]);
    } catch (err) {
      console.error('Failed to approve selected vendors:', err);
    }
  };

  const handleAddVendor = async (payload) => {
    if (!token) return;
    setAddVendorLoading(true);
    try {
      const { logoFile, ...vendorPayload } = payload;
      const response = await createVendor(token, vendorPayload);
      if (logoFile && response.vendor?.id) await uploadAdminAsset(token, 'vendor', response.vendor.id, logoFile);
      if (response.vendor) setPendingApprovals((items) => [response.vendor, ...items]);
    } finally {
      setAddVendorLoading(false);
    }
  };

  const filteredActive = useMemo(() => {
    return activeVendors.filter((v) => {
      const matchesQuery = !query
         || `${v.name} ${v.slug || ''} ${v.location?.site_name || ''} ${v.location?.building_name || ''}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
       const matchesCampus = campusFilter === 'all' || v.location?.site_name === campusFilter;
      return matchesQuery && matchesStatus && matchesCampus;
    });
  }, [activeVendors, query, statusFilter, campusFilter]);

  const totalActivePages = activePagination?.totalPages || Math.max(1, Math.ceil(filteredActive.length / itemsPerPage));
  const paginatedActive = filteredActive;

  const totalApprovalsPages = approvalPagination?.totalPages || Math.max(1, Math.ceil(pendingApprovals.length / itemsPerPage));
  const paginatedApprovals = pendingApprovals;

  const activeCount = activePagination?.total ?? activeVendors.filter(v => v.status === 'approved').length;
  const pendingCount = approvalPagination?.total ?? pendingApprovals.length;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const renderCategories = (categories = [], maxShow = 2) => {
    if (categories.length === 0) return <span className="admin-vendors__category-pill">—</span>;
    const shown = categories.slice(0, maxShow);
    const remaining = categories.length - maxShow;
    return (
      <>
        {shown.map((cat) => (
          <span key={cat} className="admin-vendors__category-pill">{cat}</span>
        ))}
        {remaining > 0 && (
          <span className="admin-vendors__category-pill admin-vendors__category-pill--more">+{remaining}</span>
        )}
      </>
    );
  };

  return (
    <div className="admin-vendors">
      <header className="admin-vendors__header">
        <div>
          <span className="admin-card__eyebrow">Vendor operations</span>
          <p className="admin-vendors__sub">
            Manage active vendors, approve new applications and monitor performance across the platform.
          </p>
        </div>
        <div className="admin-vendors__actions">
          <button type="button" className="admin-action admin-action--ghost" onClick={() => setShowAddVendor(true)}>
            <IconPlus size={14} stroke={2} />
            Add vendor
          </button>
        </div>
      </header>

      <div className="admin-vendors__kpis">
        <div className="admin-vendors__kpi">
          <div className="admin-vendors__kpi-icon">
            <IconBuildingStore size={24} stroke={1.8} />
          </div>
          <div className="admin-vendors__kpi-body">
            <span className="admin-vendors__kpi-label">Total vendors</span>
             <span className="admin-vendors__kpi-value">{activePagination?.total ?? activeVendors.length}</span>
          </div>
        </div>
        <div className="admin-vendors__kpi">
          <div className="admin-vendors__kpi-icon">
            <IconCheck size={24} stroke={1.8} />
          </div>
          <div className="admin-vendors__kpi-body">
            <span className="admin-vendors__kpi-label">Active vendors</span>
            <span className="admin-vendors__kpi-value">{activeCount}</span>
          </div>
        </div>
        <div className="admin-vendors__kpi">
          <div className="admin-vendors__kpi-icon">
            <IconAlertTriangle size={24} stroke={1.8} />
          </div>
          <div className="admin-vendors__kpi-body">
            <span className="admin-vendors__kpi-label">Pending approvals</span>
            <span className="admin-vendors__kpi-value">{pendingCount}</span>
          </div>
        </div>
      </div>

      <div className="admin-vendors__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'active'}
          className={`admin-vendors__tab${tab === 'active' ? ' admin-vendors__tab--active' : ''}`}
          onClick={() => handleTabChange('active')}
        >
          <span className="admin-vendors__tab-icon">
            <IconBuildingStore size={16} stroke={1.8} />
          </span>
          <span className="admin-vendors__tab-text">Active vendors</span>
          <span className="admin-vendors__tab-count">{activeCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'approvals'}
          className={`admin-vendors__tab${tab === 'approvals' ? ' admin-vendors__tab--active' : ''}`}
          onClick={() => handleTabChange('approvals')}
        >
          <span className="admin-vendors__tab-icon">
            <IconShieldCheck size={16} stroke={1.8} />
          </span>
          <span className="admin-vendors__tab-text">Pending approvals</span>
          {pendingCount > 0 && <span className="admin-vendors__tab-badge">{pendingCount}</span>}
        </button>
      </div>

      {tab === 'active' && (
        <>
          <div className="admin-vendors__filters">
            <div className="admin-vendors__search">
              <IconSearch size={16} stroke={1.8} />
              <input
                type="search"
                placeholder="Search vendors by name, campus or building..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search vendors"
              />
            </div>
            <div className="admin-vendors__chips" role="group" aria-label="Status filter">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={`admin-vendors__chip${statusFilter === filter.id ? ' admin-vendors__chip--active' : ''}`}
                  onClick={() => setStatusFilter(filter.id)}
                >
                  {filter.label}
                  <span className="admin-vendors__chip-count">{filter.count}</span>
                </button>
              ))}
            </div>
          </div>

          {filteredActive.length > 0 ? (
            <>
              <div className="admin-vendors__table-wrap">
                <table className="admin-vendors__table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>Status</th>
                      <th>Categories</th>
                      <th>Location</th>
                      <th>Revenue (30d)</th>
                      <th>Rating</th>
                      <th></th>
                    </tr>
                </thead>
                  <tbody>
                  {paginatedActive.map((vendor) => (
                    <tr key={vendor.id}>
                      <td>
                        <div className="admin-vendors__vendor-cell">
                          <VendorLogo src={vendor.logo_url} alt={vendor.name} />
                          <div className="admin-vendors__vendor-info">
                            <span className="admin-vendors__vendor-name">{vendor.name}</span>
                            <span className="admin-vendors__vendor-desc">{vendor.description}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusPill status={vendor.status} />
                      </td>
                      <td>
                        <div className="admin-vendors__category-pills">
                          {renderCategories(vendor.categories)}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                           {vendor.location?.site_name || `${vendor.location_count || 0} location(s)`}
                        </span>
                      </td>
                      <td>
                        <span className="admin-vendors__revenue">—</span>
                      </td>
                      <td>
                        <div className="admin-vendors__rating">
                          <IconStarFilled size={14} stroke={0} className="admin-vendors__rating-star" />
                           <span>{Number(vendor.average_rating || 0).toFixed(1)}</span>
                          <span className="admin-vendors__rating-count">({vendor.rating_count})</span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-vendors__row-actions">
                          <Link to={`/admin/vendors/${vendor.id}`} className="admin-link-cta">
                            Manage <IconChevronRight size={13} stroke={2} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalActivePages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalActivePages}
                totalItems={filteredActive.length}
                itemsPerPage={itemsPerPage}
                label="vendors"
                onPageChange={handlePageChange}
              />
            )}
          </>
        ) : (
          <>
            <div className="admin-empty">
              <img src={emptyStateAvatar} alt="" className="admin-empty__avatar" />
              <h3>No vendors match those filters</h3>
              <p>Try clearing the search or selecting a different status.</p>
              <button
                type="button"
                className="admin-action--ghost"
                onClick={() => { setQuery(''); setStatusFilter('all'); }}
              >
                Clear filters
              </button>
            </div>
          </>
        )}
        </>
      )}

      {tab === 'approvals' && (
        <>
          {pendingApprovals.length > 0 ? (
            <>
              <div className="admin-vendors__table-wrap">
                <table className="admin-vendors__table">
                  <thead>
                    <tr>
                      <th className="admin-vendors__th-check">
                        <input
                          type="checkbox"
                          className="admin-vendors__checkbox"
                          checked={selectedApprovals.length === paginatedApprovals.length && paginatedApprovals.length > 0}
                          onChange={handleSelectAll}
                          aria-label="Select all"
                        />
                      </th>
                      <th>Vendor</th>
                      <th>Categories</th>
                      <th>Location</th>
                      <th>Submitted</th>
                      <th>
                        <button
                          type="button"
                          className={`admin-vendors__bulk-approve${selectedApprovals.length === 0 ? ' admin-vendors__bulk-approve--hidden' : ''}`}
                          onClick={handleApproveSelected}
                        >
                          Approve ({selectedApprovals.length})
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedApprovals.map((vendor) => (
                      <tr key={vendor.id}>
                        <td className="admin-vendors__td-check">
                          <input
                            type="checkbox"
                            className="admin-vendors__checkbox"
                            checked={selectedApprovals.includes(vendor.id)}
                            onChange={() => handleSelectOne(vendor.id)}
                            aria-label={`Select ${vendor.name}`}
                          />
                        </td>
                        <td>
                          <div className="admin-vendors__vendor-cell">
                            <VendorLogo src={vendor.logo_url} alt={vendor.name} />
                            <div className="admin-vendors__vendor-info">
                              <span className="admin-vendors__vendor-name">{vendor.name}</span>
                              <span className="admin-vendors__vendor-desc">{vendor.description}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="admin-vendors__category-pills">
                            {renderCategories(vendor.categories)}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                             {vendor.location?.site_name || `${vendor.location_count || 0} location(s)`}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                            {formatDate(vendor.created_at)}
                          </span>
                        </td>
                        <td>
                          <div className="admin-vendors__row-actions">
                            <Link to={`/admin/vendors/${vendor.id}`} className="admin-link-cta">
                              Review <IconChevronRight size={13} stroke={2} />
                            </Link>
                            <button type="button" className="admin-action admin-action--approve" onClick={() => handleApprove(vendor)}>
                              Approve
                            </button>
                            <button type="button" className="admin-action admin-action--ghost" onClick={() => handleReject(vendor)}>
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalApprovalsPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalApprovalsPages}
                  totalItems={pendingApprovals.length}
                  itemsPerPage={itemsPerPage}
                  label="applications"
                  onPageChange={handlePageChange}
                />
              )}
            </>
          ) : (
            <>
              <div className="admin-empty">
                <img src={emptyStateAvatar} alt="" className="admin-empty__avatar" />
                <h3>No applications pending</h3>
                <p>Vendor applications will appear here as they come in.</p>
              </div>
            </>
          )}
        </>
      )}

      <ApprovalModal
        vendor={modal?.vendor}
        mode={modal?.mode}
        onConfirm={(vendor, mode) => handleConfirm(vendor, mode)}
        onCancel={() => setModal(null)}
      />
      {showAddVendor && <AddVendorModal onClose={() => setShowAddVendor(false)} onSubmit={handleAddVendor} submitting={addVendorLoading} />}
    </div>
  );
}
