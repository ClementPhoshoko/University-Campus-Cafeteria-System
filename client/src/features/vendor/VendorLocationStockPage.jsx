import { useCallback, useEffect, useRef, useState } from 'react';
import { IconArrowLeft, IconInfoCircle, IconMapPin, IconRefresh } from '@tabler/icons-react';
import Pagination from '../../components/ui/Pagination.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import CustomDropdown from '../../components/ui/CustomDropdown.jsx';
import {
  getVendorMenuInventory,
  setVendorLocationInventoryTracking,
  setVendorMenuItemStock,
} from '../../services/vendorApi.js';
import './vendor-location-stock.css';

const STOCK_PAGE_SIZE = 8;
const EMPTY_PAGINATION = { page: 1, limit: STOCK_PAGE_SIZE, total: 0, totalPages: 1 };
const EMPTY_COUNTS = {
  active_items: 0,
  configured_items: 0,
  unconfigured_items: 0,
  reserved_units: 0,
};

function quantityIsValid(value) {
  return value !== '' && value !== null && value !== undefined
    && Number.isInteger(Number(value)) && Number(value) >= 0;
}

export default function VendorLocationStockPage({ vendorId, vendorName, token, focusedItemId, onBack, onClearFocus }) {
  const selectedLocationRef = useRef('');
  const saveKeysRef = useRef(new Map());
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [location, setLocation] = useState(null);
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState({});
  const [savedQuantities, setSavedQuantities] = useState({});
  const [busyRows, setBusyRows] = useState({});
  const [reason, setReason] = useState('Location stock count update');
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const loadStock = useCallback(async (signal, targetPage, requestedLocationId) => {
    if (!vendorId) return;
    setState('loading');
    setError('');
    try {
      const response = await getVendorMenuInventory(vendorId, {
        token,
        signal,
        vendorLocationId: requestedLocationId || undefined,
        menuItemId: focusedItemId || undefined,
        page: targetPage,
        limit: STOCK_PAGE_SIZE,
      });
      if (signal?.aborted) return;
      const nextLocation = response.location || null;
      const nextItems = response.items || [];
      const nextDrafts = Object.fromEntries(nextItems.map((item) => [
        item.id,
        item.on_hand_quantity == null ? '' : String(item.on_hand_quantity),
      ]));
      selectedLocationRef.current = nextLocation?.id || '';
      setSelectedLocationId(selectedLocationRef.current);
      setLocations(response.locations || []);
      setLocation(nextLocation);
      setItems(nextItems);
      setCounts(response.counts || EMPTY_COUNTS);
      setPagination(response.pagination || EMPTY_PAGINATION);
      setDrafts(nextDrafts);
      setSavedQuantities(nextDrafts);
      setState('ready');
    } catch (loadError) {
      if (loadError.name !== 'AbortError' && !signal?.aborted) {
        setError(loadError.message || 'Could not load location stock.');
        setState('error');
      }
    }
  }, [focusedItemId, token, vendorId]);

  useEffect(() => {
    const controller = new AbortController();
    loadStock(controller.signal, focusedItemId ? 1 : page, selectedLocationRef.current || undefined);
    return () => controller.abort();
  }, [loadStock, page, reloadKey]);

  useEffect(() => { setPage(1); }, [vendorId, focusedItemId]);

  function selectLocation(locationId) {
    if (!locationId || locationId === selectedLocationRef.current) return;
    selectedLocationRef.current = locationId;
    setSelectedLocationId(locationId);
    setPage(1);
    setReloadKey((current) => current + 1);
    setNotice('');
  }

  function updateDraft(itemId, value) {
    setDrafts((current) => ({ ...current, [itemId]: value }));
    setNotice('');
  }

  function getSaveKey(itemId, quantity, adjustmentReason) {
    const seed = `${itemId}:${quantity}:${adjustmentReason}`;
    if (!saveKeysRef.current.has(seed)) saveKeysRef.current.set(seed, crypto.randomUUID());
    return saveKeysRef.current.get(seed);
  }

  async function saveRow(item) {
    const quantity = Number(drafts[item.id]);
    const adjustmentReason = reason.trim();
    if (!location || busyRows[item.id] || !quantityIsValid(drafts[item.id]) || !adjustmentReason) return;
    setBusyRows((current) => ({ ...current, [item.id]: true }));
    setError('');
    setNotice('');
    try {
      const response = await setVendorMenuItemStock(item.id, {
        vendor_id: vendorId,
        vendor_location_id: location.id,
        on_hand_quantity: quantity,
        reason: adjustmentReason,
        idempotency_key: getSaveKey(item.id, quantity, adjustmentReason),
      }, { token });
      const savedQuantity = String(response?.inventory?.on_hand_quantity ?? quantity);
      setDrafts((current) => ({ ...current, [item.id]: savedQuantity }));
      setSavedQuantities((current) => ({ ...current, [item.id]: savedQuantity }));
      setNotice(`${item.name} stock saved at ${location.label}.`);
      setReloadKey((current) => current + 1);
    } catch (saveError) {
      setError(saveError.message || `Could not save stock for ${item.name}.`);
    } finally {
      setBusyRows((current) => ({ ...current, [item.id]: false }));
    }
  }

  async function toggleTracking() {
    if (!location || trackingBusy) return;
    const enabled = !location.tracking_enabled;
    setTrackingBusy(true);
    setError('');
    setNotice('');
    try {
      await setVendorLocationInventoryTracking({
        vendor_id: vendorId,
        vendor_location_id: location.id,
        tracking_enabled: enabled,
      }, { token });
      setNotice(`Stock enforcement ${enabled ? 'enabled' : 'disabled'} at ${location.label}.`);
      setReloadKey((current) => current + 1);
    } catch (trackingError) {
      setError(trackingError.message || 'Could not update stock enforcement.');
    } finally {
      setTrackingBusy(false);
    }
  }

  const locationOptions = locations.map((row) => ({ id: row.id, name: row.label, available: true }));
  const selectedOption = locationOptions.find((option) => option.id === selectedLocationId) || null;
  const canEnableTracking = counts.unconfigured_items === 0;
  const canDisableTracking = counts.reserved_units === 0;
  const nextTracking = !location?.tracking_enabled;
  const trackingDisabled = trackingBusy || !location
    || (nextTracking && !canEnableTracking)
    || (!nextTracking && !canDisableTracking);
  const trackingHint = !location
    ? 'Choose a location to manage its stock.'
    : nextTracking && !canEnableTracking
      ? `Enter stock for the remaining ${counts.unconfigured_items} item(s) before enabling tracking.`
      : !nextTracking && !canDisableTracking
        ? 'Reserved stock must settle before tracking can be turned off.'
        : nextTracking
          ? 'Every active item has stock here. Checkout will reserve stock at this location.'
          : 'Turn off enforcement only when no orders hold reserved stock.';

  return <div className="vendor-stock-page">
    <header className="vendor-stock-page__heading">
      <div>
        <p>Manager workspace</p>
        <h2>Location stock</h2>
        <span>Set on-hand quantities for {vendorName || 'your vendor'} and control where stock is enforced.</span>
      </div>
      <div className="vendor-stock-page__heading-actions">
        {focusedItemId && <PrimaryButton size="sm" onClick={onClearFocus}>Show all items</PrimaryButton>}
        <PrimaryButton size="sm" icon={IconArrowLeft} onClick={onBack}>Back to dashboard</PrimaryButton>
      </div>
    </header>

    {notice && <p className="vendor-stock-page__notice" role="status">{notice}</p>}
    {error && <p className="vendor-stock-page__error" role="alert">{error}</p>}
    {focusedItemId && <p className="vendor-stock-page__context">
      <IconInfoCircle size={16} /> Showing the item selected in Menu &amp; categories.
    </p>}

    <section className="vendor-stock-page__card" aria-labelledby="vendor-stock-location-title">
      <header className="vendor-stock-page__card-heading">
        <span className="vendor-stock-page__card-icon"><IconMapPin size={19} /></span>
        <div>
          <h3 id="vendor-stock-location-title">Collection location</h3>
          <p>Stock is managed per collection point. Tracking stays off until a manager loads stock and enables it.</p>
        </div>
      </header>
      {state === 'error' && !locations.length ? (
        <p className="vendor-stock-page__inline-error" role="alert">{error} <button type="button" onClick={() => setReloadKey((current) => current + 1)}>Retry</button></p>
      ) : (
        <div className="vendor-stock-page__location-grid">
          <div className="vendor-stock-page__field">
            <span className="vendor-stock-page__label">Active vendor location</span>
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
            {!locationOptions.length && state === 'ready' && <small className="vendor-stock-page__hint">No active collection locations are configured for this vendor.</small>}
          </div>
          <div className="vendor-stock-page__metrics" aria-label="Location stock summary">
            <article>
              <span>Active items</span>
              <strong>{counts.active_items}</strong>
            </article>
            <article>
              <span>Stock configured</span>
              <strong>{counts.configured_items}/{counts.active_items}</strong>
            </article>
            <article>
              <span>Reserved units</span>
              <strong>{counts.reserved_units}</strong>
            </article>
          </div>
          <label className={`vendor-stock-page__tracking${trackingDisabled ? ' is-disabled' : ''}`}>
            <input
              type="checkbox"
              checked={location?.tracking_enabled === true}
              disabled={trackingDisabled}
              onChange={toggleTracking}
            />
            <span>
              <strong>Enforce stock at this location</strong>
              <small>{trackingHint}</small>
            </span>
            {trackingBusy && <em>Updating…</em>}
          </label>
        </div>
      )}
    </section>

    <section className="vendor-stock-page__card" aria-labelledby="vendor-stock-items-title">
      <header className="vendor-stock-page__card-heading vendor-stock-page__card-heading--split">
        <div className="vendor-stock-page__title-copy">
          <h3 id="vendor-stock-items-title">Stock by menu item</h3>
          <p>Change a quantity, then save that row. Reserved stock cannot be reduced below its current hold.</p>
        </div>
        <div className="vendor-stock-page__table-actions">
          <label className="vendor-stock-page__reason">
            <span>Adjustment reason</span>
            <input
              className="admin-input"
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Daily stock count"
            />
          </label>
          <button
            type="button"
            className="vendor-stock-page__refresh"
            disabled={state === 'loading'}
            onClick={() => setReloadKey((current) => current + 1)}
            aria-label="Refresh location stock"
          ><IconRefresh size={17} /></button>
        </div>
      </header>

      {state === 'loading' ? (
        <div className="vendor-stock-page__skeleton" role="status" aria-busy="true">
          <Skeleton /><Skeleton /><Skeleton /><Skeleton />
        </div>
      ) : !location ? (
        <p className="vendor-stock-page__empty">Select an active location to manage its stock.</p>
      ) : !items.length ? (
        <p className="vendor-stock-page__empty">No active catalogue items are available for stock management.</p>
      ) : <>
        <div className="vendor-stock-page__table" role="table" aria-label="Stock by menu item">
          <div className="vendor-stock-page__table-head" role="row">
            <span role="columnheader">Menu item</span>
            <span role="columnheader">On hand</span>
            <span role="columnheader">Reserved</span>
            <span role="columnheader">Orderable</span>
            <span role="columnheader">Status</span>
            <span role="columnheader"><span className="vendor-stock-page__sr-only">Actions</span></span>
          </div>
          {items.map((item) => {
            const draft = drafts[item.id] ?? '';
            const dirty = draft !== (savedQuantities[item.id] ?? '');
            const canSave = dirty && quantityIsValid(draft) && Boolean(reason.trim()) && !busyRows[item.id];
            const onHand = item.on_hand_quantity;
            return <div
              className={`vendor-stock-page__table-row${item.id === focusedItemId ? ' is-focused' : ''}`}
              key={item.id}
              role="row"
            >
              <span className="vendor-stock-page__item" role="cell">
                <strong>{item.name}</strong>
                {item.id === focusedItemId && <small>Selected item</small>}
              </span>
              <span role="cell">
                <label className="vendor-stock-page__sr-only" htmlFor={`stock-${item.id}`}>{item.name} on-hand quantity</label>
                <input
                  id={`stock-${item.id}`}
                  className="admin-input vendor-stock-page__quantity"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={draft}
                  onChange={(event) => updateDraft(item.id, event.target.value)}
                />
              </span>
              <span className="vendor-stock-page__metric" role="cell">{item.reserved_quantity}</span>
              <span className="vendor-stock-page__metric" role="cell">{item.orderable_quantity ?? '—'}</span>
              <span role="cell">
                <span className={`vendor-stock-page__badge${onHand == null ? ' is-warning' : ''}`}>
                  {onHand == null ? 'Missing' : 'Configured'}
                </span>
              </span>
              <span role="cell" className="vendor-stock-page__row-action">
                <PrimaryButton
                  size="sm"
                  disabled={!canSave}
                  onClick={() => saveRow(item)}
                >{busyRows[item.id] ? 'Saving…' : 'Save'}</PrimaryButton>
              </span>
            </div>;
          })}
        </div>
        <div className="vendor-stock-page__pagination">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            label="menu items"
            onPageChange={setPage}
          />
        </div>
      </>}
    </section>

    <p className="vendor-stock-page__footnote">
      <IconInfoCircle size={15} /> Global item availability still controls every location. Location stock adds an extra checkout check only where tracking is enabled.
    </p>
  </div>;
}
