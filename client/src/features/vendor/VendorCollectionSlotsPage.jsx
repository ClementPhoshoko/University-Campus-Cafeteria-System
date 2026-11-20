import { useCallback, useEffect, useRef, useState } from 'react';
import { IconArrowLeft, IconCalendarTime, IconInfoCircle, IconRefresh } from '@tabler/icons-react';
import Pagination from '../../components/ui/Pagination.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import CustomDropdown from '../../components/ui/CustomDropdown.jsx';
import { VendorCollectionSlotsPageSkeleton } from './VendorLoadingSkeletons.jsx';
import {
  getVendorCollectionSlots,
  setVendorCollectionSlotPaused,
} from '../../services/vendorApi.js';
import './vendor-collection-slots.css';

const SLOT_PAGE_SIZE = 8;
const EMPTY_PAGINATION = { page: 1, limit: SLOT_PAGE_SIZE, total: 0, totalPages: 1 };
const EMPTY_COUNTS = { total: 0, available: 0, paused: 0, full: 0, ended: 0, reserved_units: 0 };

function formatSlotTime(value, timeZone) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en-ZA', {
      timeZone: timeZone || 'Africa/Johannesburg',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString('en-ZA');
  }
}

export default function VendorCollectionSlotsPage({ vendorId, vendorName, token, onBack }) {
  const selectedLocationRef = useRef('');
  const requestKeysRef = useRef(new Map());
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [location, setLocation] = useState(null);
  const [slots, setSlots] = useState([]);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [page, setPage] = useState(1);
  const [busySlotId, setBusySlotId] = useState('');
  const [reason, setReason] = useState('Manager collection slot update');
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const loadSlots = useCallback(async (signal, targetPage, requestedLocationId) => {
    if (!vendorId) return;
    setState('loading');
    setError('');
    try {
      const response = await getVendorCollectionSlots(vendorId, {
        token,
        signal,
        vendorLocationId: requestedLocationId || undefined,
        page: targetPage,
        limit: SLOT_PAGE_SIZE,
      });
      if (signal?.aborted) return;
      const nextLocation = response.location || null;
      selectedLocationRef.current = nextLocation?.id || '';
      setSelectedLocationId(selectedLocationRef.current);
      setLocations(response.locations || []);
      setLocation(nextLocation);
      setSlots(response.slots || []);
      setCounts(response.counts || EMPTY_COUNTS);
      setPagination(response.pagination || EMPTY_PAGINATION);
      setState('ready');
    } catch (loadError) {
      if (loadError.name !== 'AbortError' && !signal?.aborted) {
        setError(loadError.message || 'Could not load collection slots.');
        setState('error');
      }
    }
  }, [token, vendorId]);

  useEffect(() => {
    const controller = new AbortController();
    loadSlots(controller.signal, page, selectedLocationRef.current || undefined);
    return () => controller.abort();
  }, [loadSlots, page, reloadKey]);

  function selectLocation(locationId) {
    if (!locationId || locationId === selectedLocationRef.current) return;
    selectedLocationRef.current = locationId;
    setSelectedLocationId(locationId);
    setPage(1);
    setReloadKey((current) => current + 1);
    setNotice('');
  }

  function getRequestKey(slotId, paused, adjustmentReason) {
    const seed = `${slotId}:${paused}:${adjustmentReason}`;
    if (!requestKeysRef.current.has(seed)) requestKeysRef.current.set(seed, crypto.randomUUID());
    return requestKeysRef.current.get(seed);
  }

  async function toggleSlot(slot) {
    if (!location || busySlotId) return;
    const paused = !slot.paused;
    const adjustmentReason = reason.trim();
    if (!adjustmentReason) return;
    setBusySlotId(slot.id);
    setError('');
    setNotice('');
    try {
      const response = await setVendorCollectionSlotPaused(slot.id, {
        vendor_id: vendorId,
        vendor_location_id: location.id,
        paused,
        reason: adjustmentReason,
        idempotency_key: getRequestKey(slot.id, paused, adjustmentReason),
      }, { token });
      setNotice(response?.unchanged
        ? `${formatSlotTime(slot.starts_at, location.timezone)} was already ${paused ? 'paused' : 'available'}.`
        : `${formatSlotTime(slot.starts_at, location.timezone)} ${paused ? 'paused' : 'resumed'}.`);
      setReloadKey((current) => current + 1);
    } catch (saveError) {
      setError(saveError.message || 'Could not update this collection slot.');
    } finally {
      setBusySlotId('');
    }
  }

  const locationOptions = locations.map((row) => ({ id: row.id, name: row.label, available: true }));
  const selectedOption = locationOptions.find((option) => option.id === selectedLocationId) || null;
  const showSkeleton = state === 'loading' && !locations.length && !location && !slots.length;

  return <div className="vendor-slots-page">
    <header className="vendor-slots-page__heading">
      <div>
        <p>Manager workspace</p>
        <h2>Collection slots</h2>
        <span>Control which collection times are open at {vendorName || 'your vendor'}.</span>
      </div>
      <PrimaryButton size="sm" icon={IconArrowLeft} onClick={onBack}>Back to dashboard</PrimaryButton>
    </header>

    {notice && <p className="vendor-slots-page__notice" role="status">{notice}</p>}
    {error && <p className="vendor-slots-page__error" role="alert">{error}</p>}

    {showSkeleton ? <VendorCollectionSlotsPageSkeleton /> : <>
    <section className="vendor-slots-page__card" aria-labelledby="vendor-slots-location-title">
      <header className="vendor-slots-page__card-heading">
        <span className="vendor-slots-page__card-icon"><IconCalendarTime size={19} /></span>
        <div>
          <h3 id="vendor-slots-location-title">Collection location</h3>
          <p>Slots are generated from this location’s operating hours for the next seven days.</p>
        </div>
      </header>
      {state === 'error' && !locations.length ? (
        <p className="vendor-slots-page__inline-error" role="alert">
          {error} <button type="button" onClick={() => setReloadKey((current) => current + 1)}>Retry</button>
        </p>
      ) : (
        <div className="vendor-slots-page__location-grid">
          <div className="vendor-slots-page__field">
            <span className="vendor-slots-page__label">Active vendor location</span>
            <CustomDropdown
              label=""
              ariaLabel="Active vendor location"
              placeholder="Choose a location"
              options={locationOptions}
              value={selectedOption}
              onChange={(option) => selectLocation(option.id)}
              disabled={state === 'loading' || !locationOptions.length}
              showAvailabilityStatus={false}
            />
            {!locationOptions.length && state === 'ready' && (
              <small className="vendor-slots-page__hint">No active collection locations are configured for this vendor.</small>
            )}
          </div>
          <div className="vendor-slots-page__metrics" aria-label="Collection slot summary">
            <article><span>Available</span><strong>{counts.available}</strong></article>
            <article><span>Paused</span><strong>{counts.paused}</strong></article>
            <article><span>Full</span><strong>{counts.full}</strong></article>
            <article><span>Reserved orders</span><strong>{counts.reserved_units}</strong></article>
          </div>
        </div>
      )}
    </section>

    <section className="vendor-slots-page__card" aria-labelledby="vendor-slots-list-title">
      <header className="vendor-slots-page__card-heading vendor-slots-page__card-heading--split">
        <div className="vendor-slots-page__title-copy">
          <h3 id="vendor-slots-list-title">Upcoming collection times</h3>
          <p>Pause a slot to stop new orders. Existing orders keep their place and are not removed.</p>
        </div>
        <div className="vendor-slots-page__table-actions">
          <label className="vendor-slots-page__reason">
            <span>Change reason</span>
            <input
              className="admin-input"
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Staff shortage"
            />
          </label>
          <button
            type="button"
            className="vendor-slots-page__refresh"
            disabled={state === 'loading'}
            onClick={() => setReloadKey((current) => current + 1)}
            aria-label="Refresh collection slots"
          ><IconRefresh size={17} /></button>
        </div>
      </header>

      {!location ? (
        <p className="vendor-slots-page__empty">Select an active location to manage its collection slots.</p>
      ) : !slots.length ? (
        <p className="vendor-slots-page__empty">No collection slots have been generated for this location yet.</p>
      ) : <>
        <div className="vendor-slots-page__table" role="table" aria-label="Collection slots">
          <div className="vendor-slots-page__table-head" role="row">
            <span role="columnheader">Collection time</span>
            <span role="columnheader">Reserved</span>
            <span role="columnheader">State</span>
            <span role="columnheader"><span className="vendor-slots-page__sr-only">Actions</span></span>
          </div>
          {slots.map((slot) => {
            const pausing = !slot.paused;
            const blockedByReservations = pausing && slot.reserved_count > 0;
            const canToggle = slot.can_change && !blockedByReservations && Boolean(reason.trim()) && !busySlotId;
            const fill = slot.capacity > 0 ? Math.min(100, (slot.reserved_count / slot.capacity) * 100) : 0;
            return <div className="vendor-slots-page__table-row" key={slot.id} role="row">
              <span className="vendor-slots-page__time" role="cell">
                <strong>{formatSlotTime(slot.starts_at, location.timezone)}</strong>
                <small>Capacity {slot.capacity}</small>
              </span>
              <span role="cell">
                <span className="vendor-slots-page__capacity-label">
                  <span>{slot.reserved_count} of {slot.capacity}</span>
                </span>
                <span
                  className="vendor-slots-page__capacity-track"
                  role="progressbar"
                  aria-label={`${slot.reserved_count} of ${slot.capacity} orders reserved`}
                  aria-valuemin={0}
                  aria-valuemax={slot.capacity}
                  aria-valuenow={slot.reserved_count}
                ><span style={{ width: `${fill}%` }} /></span>
              </span>
              <span role="cell">
                <span className={`vendor-slots-page__badge is-${slot.state.toLowerCase().replaceAll(' ', '-')}`}>
                  {slot.state}
                </span>
              </span>
              <span role="cell" className="vendor-slots-page__row-action">
                <PrimaryButton
                  size="sm"
                  disabled={!canToggle}
                  title={!slot.can_change
                    ? 'Collection has already started for this slot'
                    : blockedByReservations
                      ? 'Let reserved orders settle before pausing'
                      : undefined}
                  onClick={() => toggleSlot(slot)}
                >{busySlotId === slot.id ? 'Saving…' : slot.paused ? 'Resume' : 'Pause'}</PrimaryButton>
              </span>
            </div>;
          })}
        </div>
        <div className="vendor-slots-page__pagination">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            label="collection slots"
            onPageChange={setPage}
          />
        </div>
      </>}
    </section>
    </>}

    <p className="vendor-slots-page__footnote">
      <IconInfoCircle size={15} /> Paused slots disappear from the employee picker immediately and checkout rejects them. Intervals, preparation capacity, and slot capacity are controlled by the generated schedule.
    </p>
  </div>;
}
