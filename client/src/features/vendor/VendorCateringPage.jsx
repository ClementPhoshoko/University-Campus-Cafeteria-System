import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IconBuilding,
  IconCheck,
  IconChevronLeft,
  IconFileText,
  IconRefresh,
  IconTruck,
} from '@tabler/icons-react';
import Pagination from '../../components/ui/Pagination.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import { useConfirm } from '../../components/confirmation/ConfirmProvider.jsx';
import {
  createVendorCateringQuote,
  dispatchVendorCateringOrder,
  getVendorCateringOrder,
  listVendorCateringOrders,
  markVendorCateringDelivered,
  submitVendorCateringQuote,
  withdrawVendorCateringQuote,
} from '../../services/vendorApi.js';
import './vendor-catering.css';

const PAGE_SIZE = 8;
const money = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
const dateTimeFormat = new Intl.DateTimeFormat('en-ZA', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

function pad(value) {
  return String(value).padStart(2, '0');
}

function toLocalInput(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) date.setTime(Date.now());
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultQuoteForm() {
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 7);
  return { subtotal: '', service_fee: '', tax: '0', valid_until: toLocalInput(validUntil), notes: '' };
}

function formatDateTime(value) {
  if (!value) return '—';
  try { return dateTimeFormat.format(new Date(value)); } catch { return value; }
}

function formatStatus(value) {
  return String(value || '').replaceAll('_', ' ');
}

function statusTone(status) {
  if (['approved', 'completed', 'delivered', 'accepted'].includes(status)) return 'success';
  if (['rejected', 'cancelled', 'expired'].includes(status)) return 'error';
  if (['pending', 'submitted', 'preparing', 'delivery_in_progress', 'draft'].includes(status)) return 'warning';
  return 'info';
}

export default function VendorCateringPage({ vendorId, vendorName, token, onBack }) {
  const confirm = useConfirm();
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [quoteForm, setQuoteForm] = useState(defaultQuoteForm);
  const [deliveryForm, setDeliveryForm] = useState({ delivery_person_name: '', delivery_person_contact: '', delivery_notes: '' });
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !vendorId) return undefined;
    const controller = new AbortController();
    setLoadingList(true);
    listVendorCateringOrders(vendorId, { token, page, limit: PAGE_SIZE, signal: controller.signal })
      .then((response) => {
        setRequests(response?.requests || []);
        setPagination(response?.pagination || pagination);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message || 'Could not load catering requests.');
      })
      .finally(() => setLoadingList(false));
    return () => controller.abort();
  }, [token, vendorId, page, refreshKey]);

  useEffect(() => {
    if (!token || !selectedId) {
      setDetail(null);
      return undefined;
    }
    const controller = new AbortController();
    setLoadingDetail(true);
    setNotice('');
    getVendorCateringOrder(selectedId, { token, signal: controller.signal })
      .then((response) => setDetail(response))
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message || 'Could not load catering request details.');
      })
      .finally(() => setLoadingDetail(false));
    return () => controller.abort();
  }, [token, selectedId, refreshKey]);

  const draftQuote = useMemo(
    () => (detail?.quotes || []).find((quote) => quote.status === 'draft') || null,
    [detail],
  );
  const submittedQuote = useMemo(
    () => (detail?.quotes || []).find((quote) => quote.status === 'submitted') || null,
    [detail],
  );
  const acceptedQuote = useMemo(
    () => (detail?.quotes || []).find((quote) => quote.status === 'accepted') || null,
    [detail],
  );

  useEffect(() => {
    setQuoteForm(draftQuote ? {
      subtotal: String(draftQuote.subtotal ?? ''),
      service_fee: String(draftQuote.serviceFee ?? ''),
      tax: String(draftQuote.tax ?? '0'),
      valid_until: toLocalInput(draftQuote.validUntil),
      notes: draftQuote.notes || '',
    } : defaultQuoteForm());
  }, [draftQuote?.id]);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  const updateQuote = (field) => (event) => {
    setQuoteForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const saveQuote = async (event, { submit = false } = {}) => {
    event?.preventDefault?.();
    if (!detail) return;
    if (submit) {
      const approved = await confirm({
        title: 'Submit this quote?',
        message: 'The requester will be notified and can accept or decline it.',
        confirmLabel: 'Submit quote',
      });
      if (!approved) return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        subtotal: Number(quoteForm.subtotal),
        service_fee: Number(quoteForm.service_fee),
        tax: Number(quoteForm.tax || 0),
        valid_until: new Date(quoteForm.valid_until).toISOString(),
        notes: quoteForm.notes.trim() || null,
      };
      const saved = await createVendorCateringQuote(detail.request.orderId, payload, { token });
      if (submit) {
        await submitVendorCateringQuote(saved?.quote?.id || draftQuote?.id, { token });
        setNotice('Quote submitted to the requester.');
      } else {
        setNotice('Quote draft saved.');
      }
      refresh();
    } catch (err) {
      setError(err.message || 'Could not save the quote.');
    } finally {
      setBusy(false);
    }
  };

  const withdrawQuote = async () => {
    if (!submittedQuote) return;
    const approved = await confirm({
      title: 'Withdraw this quote?',
      message: 'The requester will no longer be able to accept it. You can submit a revised quote afterwards.',
      confirmLabel: 'Withdraw quote',
      tone: 'danger',
    });
    if (!approved) return;
    setBusy(true);
    setError('');
    try {
      await withdrawVendorCateringQuote(submittedQuote.id, { token });
      setNotice('Quote withdrawn.');
      refresh();
    } catch (err) {
      setError(err.message || 'Could not withdraw the quote.');
    } finally {
      setBusy(false);
    }
  };

  const dispatch = async (event) => {
    event.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await dispatchVendorCateringOrder(detail.request.orderId, {
        delivery_person_name: deliveryForm.delivery_person_name.trim(),
        delivery_person_contact: deliveryForm.delivery_person_contact.trim() || null,
        delivery_notes: deliveryForm.delivery_notes.trim() || null,
      }, { token });
      setNotice('Order dispatched. The requester has been notified.');
      refresh();
    } catch (err) {
      setError(err.message || 'Could not dispatch the order.');
    } finally {
      setBusy(false);
    }
  };

  const markDelivered = async () => {
    if (!detail) return;
    const approved = await confirm({
      title: 'Mark this order delivered?',
      message: 'The requester will be asked to confirm receipt.',
      confirmLabel: 'Mark delivered',
    });
    if (!approved) return;
    setBusy(true);
    setError('');
    try {
      await markVendorCateringDelivered(detail.request.orderId, { token });
      setNotice('Delivery recorded. Awaiting requester confirmation.');
      refresh();
    } catch (err) {
      setError(err.message || 'Could not mark the order delivered.');
    } finally {
      setBusy(false);
    }
  };

  const canQuote = Boolean(detail
    && detail.request.approvalStatus === 'approved'
    && detail.request.orderStatus === 'payment_confirmed'
    && !detail.request.acceptedQuoteId
    && !submittedQuote);
  const canDispatch = Boolean(detail
    && ['payment_confirmed', 'preparing'].includes(detail.request.orderStatus)
    && detail.request.acceptedQuoteId);
  const canDeliver = Boolean(detail && detail.request.orderStatus === 'delivery_in_progress');

  return (
    <div className="vendor-catering">
      <div className="vendor-catering__head">
        <div>
          <button type="button" className="vendor-catering__back" onClick={onBack}>
            <IconChevronLeft size={15} /> Back to overview
          </button>
          <h3>Corporate catering</h3>
          <p>Quote approved requests, manage dispatch, and record delivery for {vendorName || 'your vendor'}.</p>
        </div>
        <PrimaryButton icon={IconRefresh} onClick={refresh}>Refresh</PrimaryButton>
      </div>

      {error && <p className="vendor-catering__alert vendor-catering__alert--error" role="alert">{error}</p>}
      {notice && <p className="vendor-catering__alert vendor-catering__alert--success" role="status">{notice}</p>}

      <div className="vendor-catering__grid">
        <section className="vendor-catering__panel">
          <h4><IconFileText size={17} /> Requests</h4>
          {loadingList ? (
            <div className="vendor-catering__skeletons"><Skeleton /><Skeleton /><Skeleton /></div>
          ) : requests.length === 0 ? (
            <p className="vendor-catering__empty">No corporate catering requests yet.</p>
          ) : (
            <div className="vendor-catering__list">
              {requests.map((request) => (
                <button
                  key={request.orderId}
                  type="button"
                  className={`vendor-catering__request${selectedId === request.orderId ? ' is-active' : ''}`}
                  onClick={() => setSelectedId(request.orderId)}
                >
                  <span className="vendor-catering__request-top">
                    <strong>{request.eventName}</strong>
                    <span className={`vendor-catering__badge is-${statusTone(request.approvalStatus)}`}>
                      {formatStatus(request.approvalStatus)}
                    </span>
                  </span>
                  <span>{request.reference} · {request.attendees} attendees</span>
                  <span>{formatDateTime(request.requiredDeliveryAt)}</span>
                  <span className="vendor-catering__request-foot">
                    <strong>{money.format(Number(request.total || 0))}</strong>
                    <span>{formatStatus(request.orderStatus)}</span>
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
        </section>

        <section className="vendor-catering__panel vendor-catering__detail">
          <h4><IconBuilding size={17} /> Request detail</h4>
          {loadingDetail ? (
            <div className="vendor-catering__skeletons"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>
          ) : !detail ? (
            <p className="vendor-catering__empty">Select a request to review its quote and delivery status.</p>
          ) : (
            <>
              <dl className="vendor-catering__facts">
                <div><dt>Reference</dt><dd>{detail.request.reference}</dd></div>
                <div><dt>Venue</dt><dd>{detail.request.venue}</dd></div>
                <div><dt>Delivery</dt><dd>{formatDateTime(detail.request.requiredDeliveryAt)}</dd></div>
                <div><dt>Cost centre</dt><dd>{detail.request.costCentre || '—'}</dd></div>
                <div><dt>Approval</dt><dd>{formatStatus(detail.request.approvalStatus)}</dd></div>
                <div><dt>Order</dt><dd>{formatStatus(detail.request.orderStatus)}</dd></div>
              </dl>
              {detail.items.length > 0 && (
                <ul className="vendor-catering__items">
                  {detail.items.map((item) => (
                    <li key={item.id}><span>{item.name} × {item.quantity}</span><strong>{money.format(Number(item.lineTotal || 0))}</strong></li>
                  ))}
                </ul>
              )}

              {detail.quotes.length > 0 && (
                <div className="vendor-catering__section">
                  <h5>Quotes</h5>
                  {detail.quotes.map((quote) => (
                    <div className="vendor-catering__quote" key={quote.id}>
                      <span>{money.format(Number(quote.total || 0))} · {formatStatus(quote.status)}</span>
                      <span>Valid until {formatDateTime(quote.validUntil)}</span>
                    </div>
                  ))}
                </div>
              )}

              {canQuote && (
                <form className="vendor-catering__section vendor-catering__quote-form" onSubmit={saveQuote}>
                  <h5>{draftQuote ? 'Edit quote draft' : 'Create quote'}</h5>
                  <div className="vendor-catering__form-grid">
                    <label><span>Subtotal</span><input type="number" min="0" step="0.01" value={quoteForm.subtotal} onChange={updateQuote('subtotal')} required /></label>
                    <label><span>Service fee</span><input type="number" min="0" step="0.01" value={quoteForm.service_fee} onChange={updateQuote('service_fee')} required /></label>
                    <label><span>Tax</span><input type="number" min="0" step="0.01" value={quoteForm.tax} onChange={updateQuote('tax')} /></label>
                    <label><span>Valid until</span><input type="datetime-local" value={quoteForm.valid_until} onChange={updateQuote('valid_until')} required /></label>
                    <label className="vendor-catering__field-wide"><span>Notes</span><textarea rows="3" maxLength={2000} value={quoteForm.notes} onChange={updateQuote('notes')} /></label>
                  </div>
                  <div className="vendor-catering__actions">
                    <PrimaryButton type="submit" disabled={busy}>Save draft</PrimaryButton>
                    <button type="button" className="vendor-catering__secondary" disabled={busy} onClick={(event) => saveQuote(event, { submit: true })}>
                      <IconCheck size={15} /> Submit quote
                    </button>
                  </div>
                </form>
              )}

              {submittedQuote && !detail.request.acceptedQuoteId && (
                <div className="vendor-catering__actions">
                  <button type="button" className="vendor-catering__secondary" disabled={busy} onClick={withdrawQuote}>Withdraw quote</button>
                </div>
              )}

              {acceptedQuote && (
                <p className="vendor-catering__accepted">
                  <IconCheck size={15} /> Accepted quote: {money.format(Number(acceptedQuote.total || 0))}
                </p>
              )}

              {canDispatch && (
                <form className="vendor-catering__section" onSubmit={dispatch}>
                  <h5><IconTruck size={16} /> Dispatch order</h5>
                  <div className="vendor-catering__form-grid">
                    <label><span>Courier name</span><input maxLength={120} value={deliveryForm.delivery_person_name} onChange={(event) => setDeliveryForm((current) => ({ ...current, delivery_person_name: event.target.value }))} required /></label>
                    <label><span>Contact details</span><input maxLength={120} value={deliveryForm.delivery_person_contact} onChange={(event) => setDeliveryForm((current) => ({ ...current, delivery_person_contact: event.target.value }))} /></label>
                    <label className="vendor-catering__field-wide"><span>Delivery notes</span><textarea rows="3" maxLength={2000} value={deliveryForm.delivery_notes} onChange={(event) => setDeliveryForm((current) => ({ ...current, delivery_notes: event.target.value }))} /></label>
                  </div>
                  <div className="vendor-catering__actions"><PrimaryButton type="submit" disabled={busy}>Dispatch</PrimaryButton></div>
                </form>
              )}

              {canDeliver && (
                <div className="vendor-catering__actions">
                  <PrimaryButton icon={IconTruck} disabled={busy} onClick={markDelivered}>Mark delivered</PrimaryButton>
                </div>
              )}

              {detail.delivery && (
                <div className="vendor-catering__section">
                  <h5>Delivery</h5>
                  <dl className="vendor-catering__facts">
                    <div><dt>Status</dt><dd>{formatStatus(detail.delivery.status)}</dd></div>
                    <div><dt>Courier</dt><dd>{detail.delivery.deliveryPersonName || '—'}</dd></div>
                    <div><dt>Dispatched</dt><dd>{formatDateTime(detail.delivery.dispatchedAt)}</dd></div>
                    <div><dt>Delivered</dt><dd>{formatDateTime(detail.delivery.deliveredAt)}</dd></div>
                    <div><dt>Confirmed</dt><dd>{formatDateTime(detail.delivery.recipientConfirmedAt)}</dd></div>
                  </dl>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
