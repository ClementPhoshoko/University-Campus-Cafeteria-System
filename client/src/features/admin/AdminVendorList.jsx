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
  IconCoin,
  IconTrendingUp,
} from '@tabler/icons-react';
import Pagination from '../../components/ui/Pagination.jsx';
import { ACTIVE_VENDORS, PENDING_VENDOR_APPROVALS, formatCurrency } from './adminMockData.js';
import emptyStateAvatar from '../../assets/avatars/Disappointed_Student_with_Error_Icon.png';

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
            />
          </label>
        )}

        <footer className="admin-modal__foot">
          <button type="button" className="admin-action admin-action--ghost" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className={`admin-action ${isApprove ? 'admin-action--approve' : 'admin-action--reject'}`}
            onClick={() => onConfirm(vendor, mode)}
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
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'approvals' ? 'approvals' : 'active';
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [campusFilter, setCampusFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [approvals, setApprovals] = useState(PENDING_VENDOR_APPROVALS);
  const [selectedApprovals, setSelectedApprovals] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter, campusFilter]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleTabChange = (next) => {
    setTab(next);
    setCurrentPage(1);
    setSelectedApprovals([]);
    if (next === 'approvals') setSearchParams({ tab: 'approvals' });
    else setSearchParams({});
  };

  const CAMPUS_FILTERS = useMemo(() => {
    const campuses = [...new Set(ACTIVE_VENDORS.map(v => v.vendor_location_name.split(' - ')[0]))];
    return [{ id: 'all', label: 'All campuses' }, ...campuses.map(c => ({ id: c, label: c }))];
  }, []);

  const STATUS_FILTERS = useMemo(() => {
    const filters = [
      { id: 'all', label: 'All' },
      { id: 'open', label: 'Open' },
      { id: 'busy', label: 'Busy' },
      { id: 'closed', label: 'Closed' },
    ];
    return filters.map(f => ({
      ...f,
      count: f.id === 'all'
        ? ACTIVE_VENDORS.length
        : ACTIVE_VENDORS.filter(v => v.status === f.id).length,
    }));
  }, []);

  const handleApprove = (vendor) => setModal({ vendor, mode: 'approve' });
  const handleReject = (vendor) => setModal({ vendor, mode: 'reject' });

  const handleConfirm = (vendor, mode) => {
    setApprovals((items) => items.filter((i) => i.id !== vendor.id));
    setSelectedApprovals((prev) => prev.filter((id) => id !== vendor.id));
    setModal(null);
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

  const handleApproveSelected = () => {
    setApprovals((items) => items.filter((i) => !selectedApprovals.includes(i.id)));
    setSelectedApprovals([]);
  };

  const filteredActive = useMemo(() => {
    return ACTIVE_VENDORS.filter((v) => {
      const matchesQuery = !query
        || `${v.name} ${v.vendor_location_name}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      const matchesCampus = campusFilter === 'all' || v.vendor_location_name.startsWith(campusFilter);
      return matchesQuery && matchesStatus && matchesCampus;
    });
  }, [query, statusFilter, campusFilter]);

  const totalActivePages = Math.ceil(filteredActive.length / itemsPerPage);
  const paginatedActive = filteredActive.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalApprovalsPages = Math.ceil(approvals.length / itemsPerPage);
  const paginatedApprovals = approvals.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalVendors = ACTIVE_VENDORS.length + PENDING_VENDOR_APPROVALS.length;
  const activeCount = ACTIVE_VENDORS.filter(v => v.status === 'approved').length;
  const pendingCount = approvals.length;
  const totalRevenue = ACTIVE_VENDORS.reduce((sum, v) => sum + (v.revenue_30d || 0), 0);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const renderCategories = (categories, maxShow = 2) => {
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
          <button type="button" className="admin-action admin-action--ghost">
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
            <span className="admin-vendors__kpi-value">{totalVendors}</span>
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
        <div className="admin-vendors__kpi">
          <div className="admin-vendors__kpi-icon">
            <IconCoin size={24} stroke={1.8} />
          </div>
          <div className="admin-vendors__kpi-body">
            <span className="admin-vendors__kpi-label">Total revenue (30d)</span>
            <span className="admin-vendors__kpi-value">
              {formatCurrency(totalRevenue)}
              <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-medium)' }}><IconTrendingUp size={12} stroke={2} /></span>
            </span>
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
                          {vendor.vendor_location_name}
                        </span>
                      </td>
                      <td>
                        <span className="admin-vendors__revenue">{formatCurrency(vendor.revenue_30d)}</span>
                      </td>
                      <td>
                        <div className="admin-vendors__rating">
                          <IconStarFilled size={14} stroke={0} className="admin-vendors__rating-star" />
                          <span>{vendor.average_rating.toFixed(1)}</span>
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
          )}
        </>
      )}

      {tab === 'approvals' && (
        <>
          {approvals.length > 0 ? (
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
                            {vendor.vendor_location_name}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                            {formatDate(vendor.created_at)}
                          </span>
                        </td>
                        <td>
                          <Link to={`/admin/vendors/${vendor.id}`} className="admin-link-cta">
                            Review <IconChevronRight size={13} stroke={2} />
                          </Link>
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
                  totalItems={approvals.length}
                  itemsPerPage={itemsPerPage}
                  label="applications"
                  onPageChange={handlePageChange}
                />
              )}
            </>
          ) : (
            <div className="admin-empty">
              <img src={emptyStateAvatar} alt="" className="admin-empty__avatar" />
              <h3>No applications pending</h3>
              <p>Vendor applications will appear here as they come in.</p>
            </div>
          )}
        </>
      )}

      <ApprovalModal
        vendor={modal?.vendor}
        mode={modal?.mode}
        onConfirm={handleConfirm}
        onCancel={() => setModal(null)}
      />
    </div>
  );
}
