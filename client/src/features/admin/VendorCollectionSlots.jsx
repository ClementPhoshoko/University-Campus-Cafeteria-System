import { useCallback, useEffect, useState } from 'react';
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
      <summary className="vd-slot-manager__summary">Manage collection times</summary>
      <div className="vd-slot-manager__body">
        <aside className="vd-slot-manager__note" aria-label="How collection slots work">
          <strong>How automatic collection slots work</strong>
          <ul>
            <li>Every day, the system creates 30-minute slots from this location’s operating hours in {siteTimezone}, keeping the next 7 days available.</li>
            <li>Each slot starts with capacity for 10 orders. A successful checkout reserves one place; full or paused slots are unavailable to customers.</li>
            <li>Change this location’s operating hours to adjust future slots. Unreserved slots outside the updated hours are removed; slots with reservations are kept but paused.</li>
            <li>Use Pause or Resume below for a one-off change. No daily slot creation is needed.</li>
          </ul>
          <p>For deployment: the API scheduler must be running and migration 016 must be applied.</p>
        </aside>

        {error && <p className="vd-slot-manager__error" role="alert">{error}</p>}
        {loading ? (
          <p className="vd-slot-manager__hint" role="status">Loading collection times…</p>
        ) : slots.length === 0 ? (
          <p className="vd-slot-manager__hint">No collection times have been scheduled.</p>
        ) : (
          <ul className="vd-slot-list">
            {slots.map((slot) => {
              const state = slotState(slot, now);
              const ended = state === 'Ended';
              return (
                <li className="vd-slot-list__item" key={slot.id}>
                  <div className="vd-slot-list__info">
                    <strong>{formatSlotDate(slot.starts_at, siteTimezone)}–{new Date(slot.ends_at).toLocaleTimeString('en-ZA', { timeZone: siteTimezone, hour: '2-digit', minute: '2-digit' })}</strong>
                    <span>{slot.reserved_count}/{slot.capacity} orders · {state}</span>
                  </div>
                  {!ended && (
                    <button
                      type="button"
                      className="admin-action admin-action--ghost"
                      onClick={() => handlePauseChange(slot)}
                      disabled={saving}
                    >
                      {slot.paused ? 'Resume' : 'Pause'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
