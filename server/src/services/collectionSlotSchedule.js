const SLOT_INTERVAL_MINUTES = 30;
const SLOT_CAPACITY = 10;
const SCHEDULE_HORIZON_DAYS = 7;
const DAY_MINUTES = 24 * 60;

function localDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function dateAtOffset(year, month, day, minuteOffset) {
  const date = new Date(Date.UTC(year, month - 1, day + Math.floor(minuteOffset / DAY_MINUTES)));
  const minuteOfDay = ((minuteOffset % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
  };
}

function localDateTimeToDate(parts, timeZone) {
  const desiredUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  let timestamp = desiredUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const represented = localDateParts(new Date(timestamp), timeZone);
    const representedUtc = Date.UTC(
      Number(represented.year),
      Number(represented.month) - 1,
      Number(represented.day),
      Number(represented.hour),
      Number(represented.minute),
    );
    const difference = desiredUtc - representedUtc;
    timestamp += difference;
    if (difference === 0) break;
  }

  const check = localDateParts(new Date(timestamp), timeZone);
  if (Number(check.year) !== parts.year
    || Number(check.month) !== parts.month
    || Number(check.day) !== parts.day
    || Number(check.hour) !== parts.hour
    || Number(check.minute) !== parts.minute) {
    return null;
  }
  return new Date(timestamp);
}

function parseTime(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function generateCollectionSlotSchedule(location, {
  now = new Date(),
  horizonDays = SCHEDULE_HORIZON_DAYS,
  intervalMinutes = SLOT_INTERVAL_MINUTES,
  capacity = SLOT_CAPACITY,
} = {}) {
  const site = Array.isArray(location?.sites) ? location.sites[0] : location?.sites;
  const timeZone = site?.timezone;
  if (!timeZone) throw new Error(`Location ${location?.id || '(unknown)'} has no site timezone`);
  if (!Number.isInteger(horizonDays) || horizonDays < 1) throw new Error('horizonDays must be a positive integer');
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1) throw new Error('intervalMinutes must be a positive integer');
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error('capacity must be a positive integer');

  const currentLocal = localDateParts(now, timeZone);
  const localToday = new Date(Date.UTC(Number(currentLocal.year), Number(currentLocal.month) - 1, Number(currentLocal.day)));
  const rowsByStart = new Map();
  const hours = Array.isArray(location.operating_hours) ? location.operating_hours : [];

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset += 1) {
    const localDate = new Date(localToday.getTime() + dayOffset * DAY_MINUTES * 60_000);
    const year = localDate.getUTCFullYear();
    const month = localDate.getUTCMonth() + 1;
    const day = localDate.getUTCDate();
    const dayOfWeek = localDate.getUTCDay();
    const hoursForDay = hours.find((row) => Number(row.day_of_week) === dayOfWeek);
    if (!hoursForDay || hoursForDay.is_closed) continue;

    const opensAt = parseTime(hoursForDay.opens_at);
    const closesAt = parseTime(hoursForDay.closes_at);
    if (opensAt === null || closesAt === null) continue;
    const closeMinute = closesAt <= opensAt ? closesAt + DAY_MINUTES : closesAt;

    for (let startMinute = opensAt; startMinute < closeMinute; startMinute += intervalMinutes) {
      const endMinute = Math.min(startMinute + intervalMinutes, closeMinute);
      const localStart = dateAtOffset(year, month, day, startMinute);
      const localEnd = dateAtOffset(year, month, day, endMinute);
      const startsAt = localDateTimeToDate(localStart, timeZone);
      const endsAt = localDateTimeToDate(localEnd, timeZone);
      if (!startsAt || !endsAt || startsAt <= now || endsAt <= startsAt) continue;

      rowsByStart.set(startsAt.toISOString(), {
        vendor_location_id: location.id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        capacity,
        auto_generated: true,
      });
    }
  }

  return [...rowsByStart.values()];
}

export const collectionSlotScheduleDefaults = Object.freeze({
  intervalMinutes: SLOT_INTERVAL_MINUTES,
  capacity: SLOT_CAPACITY,
  horizonDays: SCHEDULE_HORIZON_DAYS,
});
