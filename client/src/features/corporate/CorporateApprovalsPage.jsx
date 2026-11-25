import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconEdit,
  IconFileText,
  IconInfoCircle,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import PageContainer from '../../components/layout/PageContainer.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import {
  decideCorporateApproval,
  getCorporateRequestForApproval,
  listPendingCorporateRequests,
} from '../../services/corporateApi.js';
import './corporate-catering.css';

const PAGE_SIZE = 8;
const money = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
const dateTimeFormat = new Intl.DateTimeFormat('en-ZA', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

function formatDateTime(value) {
  if (!value) return '—';
  try { return dateTimeFormat.format(new Date(value)); } catch { return value; }
}

function formatStatus(value) {
  return String(value || '').replaceAll('_', ' ');
}

export default function CorporateApprovalsPage() {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedOrderId = searchParams.get('orderId') || '';
  const token = session?.access_token;
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  useEffect(() => {
    if (requestedOrderId) setSelectedId(requestedOrderId);
  }, [requestedOrderId]);

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    setLoadingList(true);
    listPendingCorporateRequests({ token, page, limit: PAGE_SIZE, signal: controller.signal })
      .then((response) => {
        setRequests(response?.requests || []);
        setPagination(response?.pagination || pagination);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message || 'Could not load pending approvals.');
      })
      .finally(() => setLoadingList(false));
    return () => controller.abort();
  }, [token, page, refreshKey]);

  useEffect(() => {
    if (!token || !selectedId) {
      setDetail(null);
      return undefined;
    }
    const controller = new AbortController();
    setLoadingDetail(true);
    setMessage('');
    getCorporateRequestForApproval(selectedId, { token, signal: controller.signal })
      .then((response) => setDetail(response))
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message || 'Could not load approval details.');
      })
      .finally(() => setLoadingDetail(false));
    return () => controller.abort();
  }, [token, selectedId, refreshKey]);

  const makeDecision = async (decision) => {
    if (!detail || busy) return;
    if ((decision === 'rejected' || decision === 'amendment_requested') && !comments.trim()) {
      setError('Add a reason before rejecting or requesting an amendment.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await decideCorporateApproval(detail.request.orderId, decision, comments.trim() || null, { token });
      setMessage(`${response.approvalStatus} · order status ${response.orderStatus}`);
      setComments('');
      setSelectedId('');
      refresh();
    } catch (err) {
      setError(err.message || 'Could not record the decision.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Approval operations"
        title="Catering approvals"
        subtitle="Review cost-centre catering requests. Approval confirms the charge and releases the request to the vendor workflow."
        actions={(
          <PrimaryButton type="button" onClick={refresh}>
            Refresh
          </PrimaryButton>
        )}
      />

      {error && <p className="corporate-alert corporate-alert--error" role="alert">{error}</p>}
      {message && <p className="corporate-alert corporate-alert--success" role="status">{message}</p>}

      <div className="corporate-layout">
        <section className="corporate-card">
          <div className="corporate-card__heading">
            <IconClock size={20} />
            <div>
              <h3>Pending requests</h3>
              <p>Oldest required delivery first.</p>
            </div>
          </div>
          {loadingList ? (
            <div className="corporate-loading"><Skeleton /><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>
          ) : requests.length === 0 ? (
            <p className="corporate-empty">No requests are waiting for approval.</p>
          ) : (
            <div className="corporate-request-list">
              {requests.map((request) => (
                <button
                  key={request.orderId}
                  type="button"
                  className={`corporate-request${selectedId === request.orderId ? ' is-active' : ''}`}
                  onClick={() => setSelectedId(request.orderId)}
                >
                  <span className="corporate-request__top">
                    <strong>{request.eventName}</strong>
                    <span className={`corporate-badge is-${request.reapprovalRequired ? 'error' : 'warning'}`}>
                      {request.reapprovalRequired ? 'Quote re-approval' : (request.costCentre || 'No cost centre')}
                    </span>
                  </span>
                  <span>{request.reference} · {request.vendorName}</span>
                  <span>{formatDateTime(request.requiredDeliveryAt)} · {request.attendees} attendees</span>
                  <span className="corporate-request__foot">
                    <strong>{money.format(Number(request.total || 0))}</strong>
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

        <section className="corporate-card corporate-approval-detail">
          <div className="corporate-card__heading">
            <IconInfoCircle size={20} />
            <div>
              <h3>Review detail</h3>
              <p>Approver actions are attributed in the audit log.</p>
            </div>
          </div>

          {loadingDetail ? (
            <div className="corporate-loading"><Skeleton /><Skeleton /><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>
          ) : !detail ? (
            <p className="corporate-empty">Select a pending request to review its items and requirements.</p>
          ) : (
            <>
              <div className="corporate-detail__head">
                <div>
                  <span>{detail.request.reference}</span>
                  <h4>{detail.request.eventName}</h4>
                </div>
                <span className={`corporate-badge is-${detail.request.reapprovalRequired ? 'error' : 'warning'}`}>
                  {detail.request.reapprovalRequired ? 'Quote re-approval' : formatStatus(detail.request.approvalStatus)}
                </span>
              </div>
              {detail.request.reapprovalRequired && (
                <p className="corporate-alert corporate-alert--success" role="status">
                  <IconAlertTriangle size={17} />
                  <span>Accepted quote total {money.format(Number(detail.request.quotedTotal || 0))} exceeds the originally approved charge. Approve this step to release dispatch.</span>
                </p>
              )}

              <dl className="corporate-detail">
                <div><dt>Requester</dt><dd>{detail.request.department || '—'}</dd></div>
                <div><dt>Cost centre</dt><dd>{detail.request.costCentre || '—'}</dd></div>
                <div><dt>Venue</dt><dd>{detail.request.venue}</dd></div>
                <div><dt>Delivery</dt><dd>{formatDateTime(detail.request.requiredDeliveryAt)}</dd></div>
                <div><dt>Meeting</dt><dd>{formatDateTime(detail.request.meetingStartAt)} – {formatDateTime(detail.request.meetingEndAt)}</dd></div>
                <div><dt>Total</dt><dd>{money.format(Number(detail.order?.total || 0))}</dd></div>
              </dl>

              <ul className="corporate-detail__items">
                {detail.items.map((item) => (
                  <li key={item.id}><span>{item.name} × {item.quantity}</span><strong>{money.format(Number(item.lineTotal || 0))}</strong></li>
                ))}
              </ul>

              {detail.quotes.length > 0 && (
                <div className="corporate-workflow-panel">
                  <div className="corporate-workflow-panel__head">
                    <IconFileText size={16} />
                    <strong>Quotes</strong>
                  </div>
                  {detail.quotes.map((quote) => (
                    <div className="corporate-quote" key={quote.id}>
                      <div className="corporate-quote__top">
                        <strong>{money.format(Number(quote.total || 0))}</strong>
                        <span className={`corporate-badge is-${quote.status === 'accepted' ? 'success' : 'info'}`}>{formatStatus(quote.status)}</span>
                      </div>
                      <span>Valid until {formatDateTime(quote.validUntil)}</span>
                      {quote.notes && <p>{quote.notes}</p>}
                    </div>
                  ))}
                </div>
              )}

              {(detail.request.dietaryRequirements.length > 0 || detail.request.allergyRequirements.length > 0) && (
                <p className="corporate-detail__step">
                  Dietary: {detail.request.dietaryRequirements.join(', ') || 'none'} · Allergies: {detail.request.allergyRequirements.join(', ') || 'none'}
                </p>
              )}

              <label className="corporate-field">
                <span>Decision notes</span>
                <textarea
                  rows="3"
                  value={comments}
                  onChange={(event) => setComments(event.target.value)}
                  maxLength={1000}
                  placeholder="Required when rejecting or requesting an amendment"
                />
              </label>

              <div className="corporate-approval-actions">
                <PrimaryButton
                  icon={IconCheck}
                  disabled={busy}
                  onClick={() => makeDecision('approved')}
                >
                  Approve
                </PrimaryButton>
                <button
                  type="button"
                  className="corporate-decision corporate-decision--amend"
                  disabled={busy}
                  onClick={() => makeDecision('amendment_requested')}
                >
                  <IconEdit size={16} /> Request amendment
                </button>
                <button
                  type="button"
                  className="corporate-decision corporate-decision--reject"
                  disabled={busy}
                  onClick={() => makeDecision('rejected')}
                >
                  <IconX size={16} /> Reject
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
