const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getLocalDayAndMinute(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    day: WEEKDAYS.indexOf(values.weekday),
    minute: Number(values.hour) * 60 + Number(values.minute),
  };
}

function parseTime(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function scheduleIsOpen(hours, now, timezone) {
  if (!hours.length || !timezone) return true;
  const { day, minute } = getLocalDayAndMinute(now, timezone);
  if (day < 0) return false;

  const today = hours.find((row) => Number(row.day_of_week) === day);
  if (today && !today.is_closed) {
    const opensAt = parseTime(today.opens_at);
    const closesAt = parseTime(today.closes_at);
    if (opensAt !== null && closesAt !== null) {
      const openNow = closesAt > opensAt
        ? minute >= opensAt && minute < closesAt
        : minute >= opensAt;
      if (openNow) return true;
    }
  }

  const previousDay = (day + 6) % 7;
  const previous = hours.find((row) => Number(row.day_of_week) === previousDay);
  if (!previous || previous.is_closed) return false;
  const previousOpensAt = parseTime(previous.opens_at);
  const previousClosesAt = parseTime(previous.closes_at);
  return previousOpensAt !== null
    && previousClosesAt !== null
    && previousClosesAt <= previousOpensAt
    && minute < previousClosesAt;
}

export function getLocationServiceStatus(location, now = new Date()) {
  if (!location?.is_active) return 'closed';

  const status = String(location.service_status || '').toLowerCase();
  if (status === 'closed' || status === 'temporarily_unavailable') return 'closed';
  if (status !== 'open' && status !== 'busy') return 'closed';

  const hours = Array.isArray(location.operating_hours) ? location.operating_hours : [];
  const site = Array.isArray(location.sites) ? location.sites[0] : location.sites;
  if (!scheduleIsOpen(hours, now, site?.timezone)) return 'closed';
  return status;
}

export function getSiteServiceStatus(locations, now = new Date()) {
  const statuses = locations.map((location) => getLocationServiceStatus(location, now));
  if (statuses.includes('open')) return 'open';
  if (statuses.includes('busy')) return 'busy';
  return 'closed';
}

export function getVendorServiceStatus(locations) {
  const statuses = locations.map((location) => String(location?.service_status || '').toLowerCase());
  if (statuses.includes('open')) return 'open';
  if (statuses.includes('busy')) return 'busy';
  if (statuses.includes('temporarily_unavailable') && !statuses.includes('closed')) return 'temporarily_unavailable';
  return 'closed';
}
