const JOHANNESBURG = 'Africa/Johannesburg';

function localDateParts(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JOHANNESBURG,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  return Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
}

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function southAfricanPublicHolidays(year) {
  const fixed = [
    [0, 1], [2, 21], [3, 27], [4, 1], [5, 16],
    [7, 9], [8, 24], [11, 16], [11, 25], [11, 26],
  ];
  const dates = fixed.map(([month, day]) => new Date(Date.UTC(year, month, day, 12)));
  const easter = easterSunday(year);
  dates.push(
    new Date(easter.getTime() - 2 * 86400000),
    new Date(easter.getTime() + 86400000),
  );

  const holidays = new Set();
  dates.forEach((date) => {
    const key = date.toISOString().slice(0, 10);
    holidays.add(key);
    if (date.getUTCDay() === 0) {
      const observed = new Date(date.getTime() + 86400000);
      holidays.add(observed.toISOString().slice(0, 10));
    }
  });
  return holidays;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

/** Return end-of-day Johannesburg time after the requested number of SA business days. */
export function addSouthAfricanBusinessDays(from, businessDays = 3) {
  if (!Number.isInteger(businessDays) || businessDays < 1) {
    throw new RangeError('businessDays must be a positive integer');
  }
  const start = from instanceof Date ? from : new Date(from);
  if (Number.isNaN(start.getTime())) throw new TypeError('from must be a valid date');

  const parts = localDateParts(start);
  const cursor = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12));
  let counted = 0;
  while (counted < businessDays) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    const key = dateKey(cursor);
    const holidays = southAfricanPublicHolidays(cursor.getUTCFullYear());
    if (day !== 0 && day !== 6 && !holidays.has(key)) counted += 1;
  }

  const expiryParts = localDateParts(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), 12)));
  // Johannesburg is UTC+02:00 and does not observe daylight saving time.
  return new Date(Date.UTC(Number(expiryParts.year), Number(expiryParts.month) - 1, Number(expiryParts.day) + 1) - 2 * 60 * 60 * 1000 - 1);
}
