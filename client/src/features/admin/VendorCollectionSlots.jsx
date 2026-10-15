import { useCallback, useEffect, useState } from 'react';
import { IconCalendarTime, IconChevronDown, IconClock, IconInfoCircle } from '@tabler/icons-react';
import {
  listVendorCollectionSlots,
  updateVendorCollectionSlot,
} from '../../services/adminApi.js';

function formatSlotDate(timestamp, timeZone) {
  return new Date(timestamp).toLocaleString('en-ZA', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function slotState(slot, now) {
  if (new Date(slot.ends_at).getTime() <= now) return 'Ended';
  if (slot.paused) return 'Paused';
  if (Number(slot.reserved_count) >= Number(slot.capacity)) return 'Full';
  if (new Date(slot.starts_at).getTime() <= now) return 'In progress';
  return 'Available';
}

export default function VendorCollectionSlots({ location, token }) {
  const siteTimezone = location.site_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [expanded, setExpanded] = useState(false);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const loadSlots = useCallback(async () => {
    if (!token || !location?.id) return;
    setLoading(true);
    setError('');
    try {
      const response = await listVendorCollectionSlots(token, location.id);
      setSlots(response?.collectionSlots || []);
    } catch (loadError) {
      console.error('Failed to load vendor collection slots:', loadError);
      setError(loadError?.message || 'Could not load collection slots.');
    } finally {
      setLoading(false);
    }
  }, [location?.id, token]);

  useEffect(() => {
    if (expanded) loadSlots();
  }, [expanded, loadSlots]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const handlePauseChange = async (slot) => {
    setSaving(true);
    setError('');
    try {
      await updateVendorCollectionSlot(token, slot.id, { paused: !slot.paused });
      await loadSlots();
    } catch (updateError) {
      console.error('Failed to update vendor collection slot:', updateError);
      setError(updateError?.message || 'Could not update collection slot.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <details
      className="vd-slot-manager"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary className="vd-slot-manager__summary">
        <span className="vd-slot-manager__summary-icon"><IconCalendarTime size={18} /></span>
        <span className="vd-slot-manager__summary-copy">
          <strong>Collection schedule</strong>
          <span>Automatic · 30-minute slots · 10 orders per slot</span>
        </span>
        <span className="vd-slot-manager__summary-range">Next 7 days</span>
        <IconChevronDown className="vd-slot-manager__chevron" size={17} />
      </summary>
      <div className="vd-slot-manager__body">
        <aside className="vd-slot-manager__note" aria-label="How collection slots work">
          <IconInfoCircle size={18} aria-hidden="true" />
          <div>
            <strong>How it works</strong>
          <ul>
              <li>Each day the schedule is generated from the operating hours in {siteTimezone}, maintaining the next seven local days.</li>
              <li>Successful checkouts reserve one place. Full or paused slots cannot be selected by customers.</li>
              <li>Changing operating hours updates future slots. Reserved slots outside the new hours are retained but paused.</li>
              <li>Pause or resume a slot below for a one-off adjustment. No daily slot creation is needed.</li>
          </ul>
            <p>The API scheduler must be running and migration 016 must be applied.</p>
          </div>
        </aside>

        {error && <p className="vd-slot-manager__error" role="alert">{error}</p>}
        {loading ? (
          <div className="vd-slot-manager__loading" role="status">
            <span />
            <span />
            <span>Loading collection times…</span>
          </div>
        ) : slots.length === 0 ? (
          <div className="vd-slot-manager__empty">
            <IconClock size={19} />
            <span>No collection times yet. The schedule will appear after the next refresh.</span>
          </div>
        ) : (
          <ul className="vd-slot-list">
            {slots.map((slot) => {
              const state = slotState(slot, now);
              const ended = state === 'Ended';
              const reserved = Number(slot.reserved_count);
              const capacity = Number(slot.capacity);
              const fill = capacity > 0 ? Math.min(100, (reserved / capacity) * 100) : 0;
              return (
                <li className="vd-slot-list__item" key={slot.id}>
                  <div className="vd-slot-list__info">
                    <span className="vd-slot-list__time">
                      {formatSlotDate(slot.starts_at, siteTimezone)}
                      <span aria-hidden="true">–</span>
                      {new Date(slot.ends_at).toLocaleTimeString('en-ZA', { timeZone: siteTimezone, hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`vd-slot-list__state vd-slot-list__state--${state.toLowerCase().replaceAll(' ', '-')}`}>{state}</span>
                  </div>
                  <div className="vd-slot-list__capacity">
                    <div className="vd-slot-list__capacity-label">
                      <span>{reserved} of {capacity} orders</span>
                      <span>{Math.round(fill)}%</span>
                    </div>
                    <span className="vd-slot-list__capacity-track" role="progressbar" aria-label={`${reserved} of ${capacity} orders reserved`} aria-valuemin="0" aria-valuemax={capacity} aria-valuenow={reserved}>
                      <span style={{ width: `${fill}%` }} />
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`vd-slot-list__action${slot.paused ? ' vd-slot-list__action--resume' : ''}`}
                    onClick={() => handlePauseChange(slot)}
                    disabled={saving || ended}
                  >
                    {ended ? 'Ended' : slot.paused ? 'Resume' : 'Pause'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
