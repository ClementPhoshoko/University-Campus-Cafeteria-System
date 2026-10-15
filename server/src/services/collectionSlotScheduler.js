import { supabaseAdmin } from '../config/supabase.js';
import { collectionSlotScheduleDefaults, generateCollectionSlotSchedule } from './collectionSlotSchedule.js';

const SCHEDULE_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const UPSERT_BATCH_SIZE = 500;
const db = () => supabaseAdmin;

async function syncLocationSlots(location, now) {
  const desiredSlots = generateCollectionSlotSchedule(location, { now });
  const desiredStarts = new Set(desiredSlots.map((slot) => new Date(slot.starts_at).getTime()));
  const { data: existing, error: existingError } = await db()
    .from('collection_slots')
    .select('id, starts_at, reserved_count')
    .eq('vendor_location_id', location.id)
    .eq('auto_generated', true)
    .gte('ends_at', now.toISOString());
  if (existingError) throw existingError;

  const obsolete = (existing || []).filter((slot) => !desiredStarts.has(new Date(slot.starts_at).getTime()));
  const obsoleteIds = obsolete.filter((slot) => Number(slot.reserved_count) === 0).map((slot) => slot.id);
  const reservedObsoleteIds = obsolete.filter((slot) => Number(slot.reserved_count) > 0).map((slot) => slot.id);

  if (obsoleteIds.length) {
    const { error } = await db().from('collection_slots').delete().in('id', obsoleteIds);
    if (error) throw error;
  }
  if (reservedObsoleteIds.length) {
    const { error } = await db()
      .from('collection_slots')
      .update({ paused: true })
      .in('id', reservedObsoleteIds);
    if (error) throw error;
  }

  for (let index = 0; index < desiredSlots.length; index += UPSERT_BATCH_SIZE) {
    const batch = desiredSlots.slice(index, index + UPSERT_BATCH_SIZE);
    const { error } = await db()
      .from('collection_slots')
      .upsert(batch, {
        onConflict: 'vendor_location_id,starts_at',
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }
  return desiredSlots.length;
}

export async function refreshCollectionSlots(now = new Date()) {
  const { data: locations, error } = await db()
    .from('vendor_locations')
    .select('id, is_active, operating_hours(day_of_week, opens_at, closes_at, is_closed), sites(timezone)')
    .order('id', { ascending: true });
  if (error) throw error;

  let processed = 0;
  for (const location of locations || []) {
    try {
      if (!location.is_active) {
        await syncLocationSlots({ ...location, operating_hours: [] }, now);
      } else {
        await syncLocationSlots(location, now);
      }
      processed += 1;
    } catch (locationError) {
      console.error(`[Collection slots] Failed to refresh location ${location.id}:`, locationError.message);
    }
  }
  return processed;
}

export function startCollectionSlotScheduler() {
  let isRunning = false;
  const run = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const count = await refreshCollectionSlots();
      console.log(`[Collection slots] Refreshed schedules for ${count} locations using ${collectionSlotScheduleDefaults.intervalMinutes}-minute slots, capacity ${collectionSlotScheduleDefaults.capacity}, ${collectionSlotScheduleDefaults.horizonDays}-day horizon.`);
    } catch (error) {
      console.error('[Collection slots] Schedule refresh failed:', error.message);
    } finally {
      isRunning = false;
    }
  };

  void run();
  const timer = setInterval(run, SCHEDULE_REFRESH_INTERVAL_MS);
  timer.unref?.();
  return timer;
}
