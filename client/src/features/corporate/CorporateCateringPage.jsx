import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  IconAlertTriangle,
  IconBuilding,
  IconCalendarEvent,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconFileText,
  IconInfoCircle,
  IconRefresh,
  IconTruck,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { useConfirm } from '../../components/confirmation/ConfirmProvider.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import PageContainer from '../../components/layout/PageContainer.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useRoles } from '../../hooks/useRoles.js';
import { listVendorMenu, listVendors } from '../../services/employeeApi.js';
import {
  acceptCorporateQuote,
  confirmCorporateDelivery,
  createCorporateRequest,
  getMyCorporateRequest,
  listMyCorporateRequests,
  rejectCorporateQuote,
  requestCorporateReapproval,
} from '../../services/corporateApi.js';
import './corporate-catering.css';

const PAGE_SIZE = 8;
const REQUESTER_ROLES = ['catering_requester'];
const money = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
const dateTimeFormat = new Intl.DateTimeFormat('en-ZA', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

function pad(value) {
  return String(value).padStart(2, '0');
}

function toLocalInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultSchedule() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start);
  end.setHours(12, 0, 0, 0);
  const delivery = new Date(start);
  delivery.setHours(9, 0, 0, 0);
  return {
    meetingStartAt: toLocalInput(start),
    meetingEndAt: toLocalInput(end),
    requiredDeliveryAt: toLocalInput(delivery),
  };
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatDateTime(value) {
  if (!value) return '—';
  try { return dateTimeFormat.format(new Date(value)); } catch { return value; }
}

function statusTone(status) {
  if (status === 'approved' || status === 'payment_confirmed') return 'success';
  if (['rejected', 'cancelled'].includes(status)) return 'error';
  if (['pending', 'submitted'].includes(status)) return 'warning';
  return 'info';
}

function formatStatus(value) {
  return String(value || '').replaceAll('_', ' ');
}

function ReasonModal({ config, value, onChange, onSubmit, onCancel, saving }) {
  if (!config) return null;
  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="corporate-reason-title">
      <button type="button" className="admin-modal__overlay" aria-label="Close" onClick={onCancel} />
      <form className="admin-modal__card corporate-reason-modal" onSubmit={onSubmit}>
        <header className="admin-modal__head">
          <div>
            <h3 className="admin-modal__title" id="corporate-reason-title">{config.title}</h3>
            <p className="admin-modal__sub">{config.message}</p>
          </div>
          <button type="button" className="admin-role-modal__close" onClick={onCancel} aria-label="Close"><IconX size={16} /></button>
        </header>
        <div className="admin-modal__body admin-modal__body--single">
          <label className="corporate-field">
            <span>{config.label}</span>
            <textarea
              rows="4"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              maxLength={config.maxLength || 2000}
              placeholder={config.placeholder}
              required={config.required}
              autoFocus
            />
          </label>
        </div>
        <footer className="admin-modal__foot">
          <PrimaryButton type="button" disabled={saving} onClick={onCancel}>Cancel</PrimaryButton>
          <PrimaryButton type="submit" disabled={saving || (config.required && !value.trim())}>
            {saving ? 'Saving…' : config.confirmLabel}
          </PrimaryButton>
        </footer>
      </form>
    </div>
  );
}

export default function CorporateCateringPage() {
  const { session } = useAuth();
  const { roles, loading: rolesLoading } = useRoles();
  const confirm = useConfirm();
  const token = session?.access_token;
  const schedule = useMemo(defaultSchedule, []);

  const [form, setForm] = useState({
    event_name: '',
    venue: '',
    attendee_count: '',
    cost_centre: '',
    department: '',
    business_unit: '',
    purchase_order_number: '',
    meeting_start_at: schedule.meetingStartAt,
    meeting_end_at: schedule.meetingEndAt,
    required_delivery_at: schedule.requiredDeliveryAt,
    dietary_requirements: '',
    allergy_requirements: '',
    delivery_setup_requirements: '',
    special_instructions: '',
  });
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [menuItems, setMenuItems] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailId, setDetailId] = useState('');
  const [detail, setDetail] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [notice, setNotice] = useState('');
  const [reasonConfig, setReasonConfig] = useState(null);
  const [reasonValue, setReasonValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [error, setError] = useState('');

  const selectedVendor = vendors.find((vendor) => vendor.id === vendorId) || null;
  const locations = selectedVendor?.locations || [];
  const selectedLocation = locations.find((location) => location.id === locationId) || null;

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    setLoadingVendors(true);
    listVendors({ limit: 50, token, signal: controller.signal })
      .then((response) => {
        const eligible = (response?.vendors || []).filter((vendor) =>
          vendor.corporate_catering_enabled && (vendor.locations || []).some((location) => location.is_active));
        setVendors(eligible);
        if (eligible.length === 1) setVendorId(eligible[0].id);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message || 'Could not load catering vendors.');
      })
      .finally(() => setLoadingVendors(false));
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    setLoadingRequests(true);
    listMyCorporateRequests({ token, page, limit: PAGE_SIZE, signal: controller.signal })
      .then((response) => {
        setRequests(response?.requests || []);
        setPagination(response?.pagination || pagination);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message || 'Could not load catering requests.');
      })
      .finally(() => setLoadingRequests(false));
    return () => controller.abort();
  }, [token, page, refreshKey]);

  useEffect(() => {
    if (!token || !vendorId || !locationId) {
      setMenuItems([]);
      return undefined;
    }
    const controller = new AbortController();
    setLoadingMenu(true);
    setMenuItems([]);
    setQuantities({});
    listVendorMenu(vendorId, { token, locationId, signal: controller.signal })
      .then((response) => {
        setMenuItems((response?.categories || []).flatMap((category) => category.items || []));
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message || 'Could not load the selected menu.');
      })
      .finally(() => setLoadingMenu(false));
    return () => controller.abort();
  }, [token, vendorId, locationId]);

  useEffect(() => {
    if (!token || !detailId) {
      setDetail(null);
      return undefined;
    }
    const controller = new AbortController();
    getMyCorporateRequest(detailId, { token, signal: controller.signal })
      .then((response) => setDetail(response))
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message || 'Could not load request details.');
      });
    return () => controller.abort();
  }, [token, detailId, refreshKey]);

  const estimate = useMemo(() => menuItems.reduce((total, item) =>
    total + Number(item.base_price || 0) * Number(quantities[item.id] || 0), 0), [menuItems, quantities]);
  const selectedItemCount = Object.values(quantities).reduce((sum, quantity) => sum + Number(quantity || 0), 0);

  const updateForm = useCallback((field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  }, []);

  const handleVendorChange = (event) => {
    const nextVendorId = event.target.value;
    setVendorId(nextVendorId);
    setLocationId('');
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setConfirmation(null);
    const selectedItems = menuItems
      .filter((item) => Number(quantities[item.id] || 0) > 0)
      .map((item) => ({ menuItemId: item.id, quantity: Number(quantities[item.id]) }));
    if (!vendorId || !locationId || !selectedItems.length) {
      setError('Choose a vendor, location, and at least one menu item.');
      return;
    }

    setBusy(true);
    try {
      const response = await createCorporateRequest({
        vendor_id: vendorId,
        vendor_location_id: locationId,
        items: selectedItems,
        event_name: form.event_name,
        venue: form.venue,
        attendee_count: Number(form.attendee_count),
        meeting_start_at: new Date(form.meeting_start_at).toISOString(),
        meeting_end_at: new Date(form.meeting_end_at).toISOString(),
        required_delivery_at: new Date(form.required_delivery_at).toISOString(),
        cost_centre: form.cost_centre,
        department: form.department,
        business_unit: form.business_unit,
        purchase_order_number: form.purchase_order_number,
        dietary_requirements: splitList(form.dietary_requirements),
        allergy_requirements: splitList(form.allergy_requirements),
        delivery_setup_requirements: form.delivery_setup_requirements,
        special_instructions: form.special_instructions,
      }, { token });
      setConfirmation(response);
      setQuantities({});
      setPage(1);
      setRefreshKey((key) => key + 1);
      setForm((current) => ({ ...current, event_name: '', venue: '', attendee_count: '' }));
    } catch (err) {
      setError(err.message || 'Could not submit the catering request.');
    } finally {
      setBusy(false);
    }
  };

  const openReason = (config) => {
    setNotice('');
    setReasonValue('');
    setReasonConfig(config);
  };

  const handleAcceptQuote = async (quote) => {
    const approved = await confirm({
      title: 'Accept this quote?',
      message: `Accepting the ${money.format(Number(quote.total || 0))} quote confirms the charge to ${detail.request.costCentre || 'the cost centre'}.`,
      confirmLabel: 'Accept quote',
      tone: 'primary',
    });
    if (!approved) return;
    setWorkflowBusy(true);
    setNotice('');
    try {
      const response = await acceptCorporateQuote(quote.id, { token });
      setNotice(response?.reapprovalRequired
        ? 'Quote accepted. The updated total now needs approval before dispatch.'
        : 'Quote accepted. The vendor can begin preparing the order.');
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err.message || 'Could not accept the quote.');
    } finally {
      setWorkflowBusy(false);
    }
  };

  const submitReason = async (event) => {
    event.preventDefault();
    if (!reasonConfig) return;
    setWorkflowBusy(true);
    setNotice('');
    try {
      if (reasonConfig.type === 'reject') {
        await rejectCorporateQuote(reasonConfig.quoteId, reasonValue.trim(), { token });
        setNotice('The quote was declined. The vendor can submit a revised quote.');
      } else if (reasonConfig.type === 'reapproval') {
        await requestCorporateReapproval(detail.request.orderId, reasonValue.trim(), { token });
        setNotice('Re-approval requested. An admin or finance approver will review it.');
      } else {
        await confirmCorporateDelivery(detail.request.orderId, {
          token,
          missingOrIncorrectItems: reasonValue.trim() || null,
        });
        setNotice('Delivery confirmed. Thank you.');
      }
      setReasonConfig(null);
      setReasonValue('');
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err.message || 'Could not complete this action.');
    } finally {
      setWorkflowBusy(false);
    }
  };

  if (rolesLoading) {
    return (
      <PageContainer>
        <div className="corporate-loading"><Skeleton /><Skeleton /></div>
      </PageContainer>
    );
  }
  if (!roles.some((role) => REQUESTER_ROLES.includes(role))) {
    return <Navigate to="/" replace />;
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Corporate services"
        title="Catering requests"
        subtitle="Arrange catering for meetings and events. An admin or finance approver confirms the cost-centre charge before the vendor begins work."
        actions={(
          <PrimaryButton
            icon={IconRefresh}
            onClick={() => setRefreshKey((key) => key + 1)}
          >
            Refresh
          </PrimaryButton>
        )}
      />

      {error && <p className="corporate-alert corporate-alert--error" role="alert">{error}</p>}
      {notice && <p className="corporate-alert corporate-alert--success" role="status">{notice}</p>}
      {confirmation && (
        <div className="corporate-alert corporate-alert--success" role="status">
          <IconCheck size={18} />
          <div>
            <strong>Request {confirmation.reference} submitted.</strong>
            <span>Status: {formatStatus(confirmation.approvalStatus)} · Total: {money.format(Number(confirmation.total || 0))}</span>
          </div>
        </div>
      )}

      <div className="corporate-layout">
        <form className="corporate-card corporate-form" onSubmit={handleSubmit}>
          <div className="corporate-card__heading">
            <IconBuilding size={20} />
            <div>
              <h3>New catering request</h3>
              <p>Vendor prices are snapshotted when the request is submitted. The standard service fee is calculated by the server.</p>
            </div>
          </div>

          <div className="corporate-field-grid">
            <label className="corporate-field">
              <span>Catering vendor</span>
              <select value={vendorId} onChange={handleVendorChange} required>
                <option value="">Select a vendor</option>
                {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
              </select>
            </label>
            <label className="corporate-field">
              <span>Collection location</span>
              <select value={locationId} onChange={(event) => setLocationId(event.target.value)} required disabled={!vendorId}>
                <option value="">Select a location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.site_name || 'Site'} · {location.building_name || 'Building'}
                  </option>
                ))}
              </select>
            </label>
            <label className="corporate-field">
              <span>Event name</span>
              <input value={form.event_name} onChange={updateForm('event_name')} maxLength={160} required />
            </label>
            <label className="corporate-field">
              <span>Venue</span>
              <input value={form.venue} onChange={updateForm('venue')} maxLength={200} required />
            </label>
            <label className="corporate-field">
              <span>Attendees</span>
              <input type="number" min="1" max="20000" value={form.attendee_count} onChange={updateForm('attendee_count')} required />
            </label>
            <label className="corporate-field">
              <span>Cost centre</span>
              <input value={form.cost_centre} onChange={updateForm('cost_centre')} maxLength={120} required />
            </label>
            <label className="corporate-field">
              <span>Department</span>
              <input value={form.department} onChange={updateForm('department')} maxLength={120} />
            </label>
            <label className="corporate-field">
              <span>Business unit</span>
              <input value={form.business_unit} onChange={updateForm('business_unit')} maxLength={120} />
            </label>
            <label className="corporate-field">
              <span>Purchase order</span>
              <input value={form.purchase_order_number} onChange={updateForm('purchase_order_number')} maxLength={120} />
            </label>
          </div>

          <div className="corporate-subheading"><IconCalendarEvent size={17} /><span>Schedule</span></div>
          <div className="corporate-field-grid">
            <label className="corporate-field">
              <span>Required delivery</span>
              <input type="datetime-local" value={form.required_delivery_at} onChange={updateForm('required_delivery_at')} required />
            </label>
            <label className="corporate-field">
              <span>Meeting starts</span>
              <input type="datetime-local" value={form.meeting_start_at} onChange={updateForm('meeting_start_at')} required />
            </label>
            <label className="corporate-field">
              <span>Meeting ends</span>
              <input type="datetime-local" value={form.meeting_end_at} onChange={updateForm('meeting_end_at')} required />
            </label>
          </div>
          <p className="corporate-hint">Delivery must be before the meeting starts and in the future.</p>

          <div className="corporate-subheading"><IconUsers size={17} /><span>Requirements</span></div>
          <div className="corporate-field-grid">
            <label className="corporate-field">
              <span>Dietary requirements <small>comma separated</small></span>
              <input value={form.dietary_requirements} onChange={updateForm('dietary_requirements')} placeholder="Vegetarian, Halaal" />
            </label>
            <label className="corporate-field">
              <span>Allergy requirements <small>comma separated</small></span>
              <input value={form.allergy_requirements} onChange={updateForm('allergy_requirements')} placeholder="Nut-free, Gluten-free" />
            </label>
            <label className="corporate-field corporate-field--wide">
              <span>Delivery and setup</span>
              <textarea rows="3" value={form.delivery_setup_requirements} onChange={updateForm('delivery_setup_requirements')} maxLength={2000} />
            </label>
            <label className="corporate-field corporate-field--wide">
              <span>Special instructions</span>
              <textarea rows="3" value={form.special_instructions} onChange={updateForm('special_instructions')} maxLength={2000} />
            </label>
          </div>

          <div className="corporate-subheading"><IconBuilding size={17} /><span>Menu</span></div>
          {loadingVendors || loadingMenu ? (
            <div className="corporate-loading"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>
          ) : !selectedLocation ? (
            <p className="corporate-empty">Choose an active vendor location to load its menu.</p>
          ) : !menuItems.length ? (
            <p className="corporate-empty">This location has no currently available menu items.</p>
          ) : (
            <div className="corporate-menu">
              {menuItems.map((item) => (
                <div className="corporate-menu__item" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{money.format(Number(item.base_price || 0))} each</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    aria-label={`Quantity for ${item.name}`}
                    value={quantities[item.id] || 0}
                    onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="corporate-form__footer">
            <p>
              <IconInfoCircle size={15} />
              {selectedItemCount} items · estimated subtotal {money.format(estimate)} before service fee
            </p>
            <PrimaryButton
              type="submit"
              disabled={busy || !vendorId || !locationId || selectedItemCount === 0}
            >
              {busy ? 'Submitting…' : 'Submit request'}
            </PrimaryButton>
          </div>
        </form>

        <section className="corporate-card corporate-requests">
          <div className="corporate-card__heading">
            <IconClock size={20} />
            <div>
              <h3>My requests</h3>
              <p>Approval and vendor progress appear here as they change.</p>
            </div>
          </div>

          {loadingRequests ? (
            <div className="corporate-loading"><Skeleton /><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>
          ) : requests.length === 0 ? (
            <p className="corporate-empty">No catering requests yet.</p>
          ) : (
            <div className="corporate-request-list">
              {requests.map((request) => (
                <button
                  key={request.orderId}
                  type="button"
                  className={`corporate-request${detailId === request.orderId ? ' is-active' : ''}`}
                  onClick={() => setDetailId(request.orderId)}
                >
                  <span className="corporate-request__top">
                    <strong>{request.eventName}</strong>
                    <span className={`corporate-badge is-${statusTone(request.approvalStatus)}`}>
                      {formatStatus(request.approvalStatus)}
                    </span>
                  </span>
                  <span>{request.reference} · {request.vendorName}</span>
                  <span>{formatDateTime(request.requiredDeliveryAt)} · {request.attendees} attendees</span>
                  <span className="corporate-request__foot">
                    <strong>{money.format(Number(request.total || 0))}</strong>
                    <IconChevronRight size={16} />
                  </span>
                </button>
              ))}
            </div>
          )}
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            label="requests"
            onPageChange={setPage}
          />

          {detail && (
            <div className="corporate-detail">
              <div className="corporate-detail__head">
                <div>
                  <span>Request detail</span>
                  <h4>{detail.request.eventName}</h4>
                </div>
                <span className={`corporate-badge is-${statusTone(detail.request.approvalStatus)}`}>
                  {formatStatus(detail.request.approvalStatus)}
                </span>
              </div>
              <dl>
                <div><dt>Venue</dt><dd>{detail.request.venue}</dd></div>
                <div><dt>Cost centre</dt><dd>{detail.request.costCentre || '—'}</dd></div>
                <div><dt>Meeting</dt><dd>{formatDateTime(detail.request.meetingStartAt)} – {formatDateTime(detail.request.meetingEndAt)}</dd></div>
                <div><dt>Delivery</dt><dd>{formatDateTime(detail.request.requiredDeliveryAt)}</dd></div>
                <div><dt>Total</dt><dd>{money.format(Number(detail.order?.total || 0))}</dd></div>
              </dl>
              {detail.items.length > 0 && (
                <ul className="corporate-detail__items">
                  {detail.items.map((item) => (
                    <li key={item.id}><span>{item.name} × {item.quantity}</span><strong>{money.format(Number(item.lineTotal || 0))}</strong></li>
                  ))}
                </ul>
              )}
              {detail.approvalSteps.length > 0 && (
                <p className="corporate-detail__step">
                  Approval: {formatStatus(detail.approvalSteps[0].status)}
                  {detail.approvalSteps[0].comments ? ` — ${detail.approvalSteps[0].comments}` : ''}
                </p>
              )}
              {detail.quotes.length > 0 && (
                <div className="corporate-workflow-panel">
                  <div className="corporate-workflow-panel__head">
                    <IconFileText size={16} />
                    <strong>Quotes</strong>
                    {detail.request.reapprovalRequired && (
                      <span className="corporate-badge is-warning">Re-approval required</span>
                    )}
                  </div>
                  {detail.quotes.map((quote) => (
                    <div className="corporate-quote" key={quote.id}>
                      <div className="corporate-quote__top">
                        <strong>{money.format(Number(quote.total || 0))}</strong>
                        <span className={`corporate-badge is-${statusTone(quote.status)}`}>{formatStatus(quote.status)}</span>
                      </div>
                      <span>Valid until {formatDateTime(quote.validUntil)}</span>
                      <span>Subtotal {money.format(Number(quote.subtotal || 0))} · Fee {money.format(Number(quote.serviceFee || 0))} · Tax {money.format(Number(quote.tax || 0))}</span>
                      {quote.notes && <p>{quote.notes}</p>}
                      {quote.status === 'submitted' && detail.request.canAcceptQuote && (
                        <div className="corporate-workflow-actions">
                          <button type="button" className="corporate-decision" disabled={workflowBusy} onClick={() => handleAcceptQuote(quote)}>
                            <IconCheck size={14} /> Accept quote
                          </button>
                          <button
                            type="button"
                            className="corporate-decision corporate-decision--reject"
                            disabled={workflowBusy}
                            onClick={() => openReason({
                              type: 'reject',
                              quoteId: quote.id,
                              title: 'Decline this quote?',
                              message: 'Tell the vendor why this quote does not work. They can then submit a revised quote.',
                              label: 'Reason for declining',
                              placeholder: 'For example, the proposed total exceeds the approved budget.',
                              confirmLabel: 'Decline quote',
                              required: true,
                              maxLength: 1000,
                              tone: 'danger',
                            })}
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {detail.request.acceptedQuoteId && detail.request.approvalStatus === 'approved' && (
                    <button
                      type="button"
                      className="corporate-decision"
                      disabled={workflowBusy}
                      onClick={() => openReason({
                        type: 'reapproval',
                        title: 'Request re-approval?',
                        message: 'An admin or finance approver will review the accepted quote before the vendor continues.',
                        label: 'Reason for re-approval',
                        placeholder: 'Explain what changed since the quote was accepted.',
                        confirmLabel: 'Request re-approval',
                        required: true,
                        maxLength: 1000,
                      })}
                    >
                      <IconAlertTriangle size={14} /> Request re-approval
                    </button>
                  )}
                </div>
              )}
              {detail.delivery && (
                <div className="corporate-workflow-panel">
                  <div className="corporate-workflow-panel__head">
                    <IconTruck size={16} />
                    <strong>Delivery</strong>
                    <span className={`corporate-badge is-${statusTone(detail.delivery.status)}`}>{formatStatus(detail.delivery.status)}</span>
                  </div>
                  <dl>
                    <div><dt>Courier</dt><dd>{detail.delivery.deliveryPersonName || '—'}</dd></div>
                    <div><dt>Contact</dt><dd>{detail.delivery.deliveryPersonContact || '—'}</dd></div>
                    <div><dt>Dispatched</dt><dd>{formatDateTime(detail.delivery.dispatchedAt)}</dd></div>
                    <div><dt>Delivered</dt><dd>{formatDateTime(detail.delivery.deliveredAt)}</dd></div>
                    <div><dt>Confirmed</dt><dd>{formatDateTime(detail.delivery.recipientConfirmedAt)}</dd></div>
                  </dl>
                  {detail.delivery.deliveryNotes && <p className="corporate-detail__step">{detail.delivery.deliveryNotes}</p>}
                  {detail.delivery.missingOrIncorrectItems && (
                    <p className="corporate-detail__step">Reported issues: {detail.delivery.missingOrIncorrectItems}</p>
                  )}
                  {detail.request.canConfirmDelivery && (
                    <button
                      type="button"
                      className="corporate-decision"
                      disabled={workflowBusy}
                      onClick={() => openReason({
                        type: 'delivery',
                        title: 'Confirm delivery?',
                        message: 'Confirm that the catering arrived. You can optionally report missing or incorrect items.',
                        label: 'Missing or incorrect items',
                        placeholder: 'Optional: describe anything that was missing or incorrect.',
                        confirmLabel: 'Confirm delivery',
                        required: false,
                        maxLength: 2000,
                      })}
                    >
                      <IconCheck size={14} /> Confirm delivery
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
      <ReasonModal
        config={reasonConfig}
        value={reasonValue}
        onChange={setReasonValue}
        onSubmit={submitReason}
        onCancel={() => { setReasonConfig(null); setReasonValue(''); }}
        saving={workflowBusy}
      />
    </PageContainer>
  );
}
