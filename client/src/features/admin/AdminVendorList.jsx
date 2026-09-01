import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  IconSearch,
  IconBuildingStore,
  IconStarFilled,
  IconReceipt,
  IconAlertTriangle,
  IconChevronRight,
  IconCheck,
  IconX,
  IconShieldCheck,
} from '@tabler/icons-react';
import { ACTIVE_VENDORS, PENDING_VENDOR_APPROVALS, formatCurrency } from './adminMockData.js';

const STATUS_FILTERS = [
  { id: 'all', label: 'All statuses' },
  { id: 'open', label: 'Open' },
  { id: 'busy', label: 'Busy' },
  { id: 'closed', label: 'Closed' },
];

function VendorLogo({ src, alt }) {
  return (
    <div className="admin-vendors__logo">
      <img src={src} alt={alt || ''} />
    </div>
  );
}

function StatusPill({ status }) {
  return <span className={`admin-status admin-status--${status}`}>{status}</span>;
}

function ApprovalRow({ vendor, onApprove, onReject }) {
  return (
    <li className="admin-vendors__approval-row">
      <div className="admin-vendors__approval-head">
        <div className="admin-vendors__approval-id">
          <VendorLogo src={vendor.logo_url} alt={vendor.name} />
          <div>
            <span className="admin-vendors__approval-name">{vendor.name}</span>
            <span className="admin-vendors__approval-slug">/{vendor.slug}</span>
          </div>
        </div>
        <span className="admin-vendors__approval-pending">
          <IconAlertTriangle size={13} stroke={2} /> Awaiting review
        </span>
      </div>

      <p className="admin-vendors__approval-desc">{vendor.description}</p>

      <div className="admin-vendors__approval-meta">
        <div className="admin-vendors__meta-item">
          <span className="admin-vendors__meta-label">Campus</span>
          <span className="admin-vendors__meta-value">{vendor.campus}</span>
        </div>
        <div className="admin-vendors__meta-item">
          <span className="admin-vendors__meta-label">Building</span>
          <span className="admin-vendors__meta-value">{vendor.building}</span>
        </div>
        <div className="admin-vendors__meta-item">
          <span className="admin-vendors__meta-label">Categories</span>
          <span className="admin-vendors__meta-value">{vendor.categories.join(', ')}</span>
        </div>
        <div className="admin-vendors__meta-item">
          <span className="admin-vendors__meta-label">Submitted</span>
          <span className="admin-vendors__meta-value">{vendor.submittedAt}</span>
        </div>
      </div>

      <div className="admin-vendors__approval-foot">
        <Link to={`/admin/vendors/${vendor.id}`} className="admin-link-cta">
          Review application <IconChevronRight size={13} stroke={2} />
        </Link>
        <div className="admin-vendors__approval-actions">
          <button type="button" className="admin-action admin-action--reject" onClick={() => onReject(vendor)}>
            <IconX size={13} stroke={2} /> Reject
          </button>
          <button type="button" className="admin-action admin-action--approve" onClick={() => onApprove(vendor)}>
            <IconCheck size={13} stroke={2} /> Approve
          </button>
        </div>
      </div>
    </li>
  );
}

function VendorCard({ vendor }) {
  return (
    <Link to={`/admin/vendors/${vendor.id}`} className="admin-vendors__card">
      <div className="admin-vendors__card-head">
        <VendorLogo src={vendor.logo_url} alt={vendor.name} />
        <div className="admin-vendors__card-id">
          <span className="admin-vendors__card-name">{vendor.name}</span>
          <span className="admin-vendors__card-loc">{vendor.campus} · {vendor.building}</span>
        </div>
        <StatusPill status={vendor.status} />
      </div>

      <p className="admin-vendors__card-desc">{vendor.description}</p>

      <div className="admin-vendors__card-tags">
        {vendor.categories.map((cat) => (
          <span key={cat} className="admin-tag">{cat}</span>
        ))}
      </div>

      <div className="admin-vendors__card-stats">
        <div className="admin-vendors__stat">
          <IconReceipt size={14} stroke={2} />
          <span><strong>{vendor.ordersToday}</strong> orders today</span>
        </div>
        <div className="admin-vendors__stat">
          <IconStarFilled size={14} stroke={0} />
          <span><strong>{vendor.rating.toFixed(1)}</strong> ({vendor.ratingCount})</span>
        </div>
        <div className="admin-vendors__stat">
          <span><strong>{vendor.menuItems}</strong> menu items</span>
        </div>
      </div>

      <div className="admin-vendors__card-foot">
        <span className="admin-vendors__card-revenue">
          30d revenue <strong>{formatCurrency(vendor.revenue30d)}</strong>
        </span>
        <span className="admin-link-cta">
          Manage <IconChevronRight size={13} stroke={2} />
        </span>
      </div>
    </Link>
  );
}

function ApprovalModal({ vendor, mode, onConfirm, onCancel }) {
  if (!vendor) return null;
  const isApprove = mode === 'approve';
  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <div className="admin-modal__overlay" onClick={onCancel} />
      <div className="admin-modal__card">
        <header className="admin-modal__head">
          <div className="admin-modal__icon admin-modal__icon--success">
            {isApprove ? <IconCheck size={20} stroke={2} /> : <IconX size={20} stroke={2} />}
          </div>
          <div>
            <h3 className="admin-modal__title">
              {isApprove ? 'Approve vendor?' : 'Reject application?'}
            </h3>
            <p className="admin-modal__sub">
              {vendor.name} · {vendor.campus}
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
          <button type="button" className="admin-action" onClick={onCancel}>Cancel</button>
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
  const [modal, setModal] = useState(null);
  const [approvals, setApprovals] = useState(PENDING_VENDOR_APPROVALS);

  const handleTab = (next) => {
    setTab(next);
    if (next === 'approvals') setSearchParams({ tab: 'approvals' });
    else setSearchParams({});
  };

  const handleApprove = (vendor) => setModal({ vendor, mode: 'approve' });
  const handleReject = (vendor) => setModal({ vendor, mode: 'reject' });

  const handleConfirm = (vendor, mode) => {
    setApprovals((items) => items.filter((i) => i.id !== vendor.id));
    setModal(null);
  };

  const filteredActive = useMemo(() => {
    return ACTIVE_VENDORS.filter((v) => {
      const matchesQuery = !query
        || `${v.name} ${v.campus} ${v.building}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter]);

  const activeCount = ACTIVE_VENDORS.length;
  const pendingCount = approvals.length;

  return (
    <div className="admin-vendors">
      <header className="admin-vendors__header">
        <div>
          <span className="admin-card__eyebrow">Vendor operations</span>
          <h2 className="admin-vendors__title">All vendors</h2>
          <p className="admin-vendors__sub">
            Manage active vendors, approve new applications and monitor performance across the platform.
          </p>
        </div>
        <div className="admin-vendors__actions">
          <span className="admin-vendors__count">
            <strong>{activeCount}</strong> active · <strong>{pendingCount}</strong> pending
          </span>
        </div>
      </header>

      <div className="admin-vendors__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'active'}
          className={`admin-vendors__tab${tab === 'active' ? ' admin-vendors__tab--active' : ''}`}
          onClick={() => handleTab('active')}
        >
          <IconBuildingStore size={16} stroke={1.8} />
          Active vendors
          <span className="admin-vendors__tab-count">{activeCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'approvals'}
          className={`admin-vendors__tab${tab === 'approvals' ? ' admin-vendors__tab--active' : ''}`}
          onClick={() => handleTab('approvals')}
        >
          <IconShieldCheck size={16} stroke={1.8} />
          Pending approvals
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
                </button>
              ))}
            </div>
          </div>

          {filteredActive.length > 0 ? (
            <div className="admin-vendors__grid">
              {filteredActive.map((vendor) => (
                <VendorCard key={vendor.id} vendor={vendor} />
              ))}
            </div>
          ) : (
            <div className="admin-empty">
              <IconBuildingStore size={32} stroke={1.4} />
              <h3>No vendors match those filters</h3>
              <p>Try clearing the search or selecting a different status.</p>
              <button
                type="button"
                className="admin-action"
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
            <ul className="admin-vendors__approvals">
              {approvals.map((vendor) => (
                <ApprovalRow
                  key={vendor.id}
                  vendor={vendor}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </ul>
          ) : (
            <div className="admin-empty">
              <IconShieldCheck size={32} stroke={1.4} />
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
