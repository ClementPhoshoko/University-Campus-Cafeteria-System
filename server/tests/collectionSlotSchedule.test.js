import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCollectionSlotSchedule } from '../src/services/collectionSlotSchedule.js';

const location = {
  id: 'location-1',
  sites: { timezone: 'Africa/Johannesburg' },
  operating_hours: [
    { day_of_week: 4, opens_at: '12:00:00', closes_at: '13:15:00', is_closed: false },
  ],
};

test('generates 30-minute slots through the closing time with default capacity', () => {
  const slots = generateCollectionSlotSchedule(location, {
    now: new Date('2026-10-15T08:00:00.000Z'),
  });

  assert.deepEqual(slots.map((slot) => [slot.starts_at, slot.ends_at, slot.capacity]), [
    ['2026-10-15T10:00:00.000Z', '2026-10-15T10:30:00.000Z', 10],
    ['2026-10-15T10:30:00.000Z', '2026-10-15T11:00:00.000Z', 10],
    ['2026-10-15T11:00:00.000Z', '2026-10-15T11:15:00.000Z', 10],
  ]);
});

test('creates slots for an overnight schedule on the opening weekday', () => {
  const overnight = {
    ...location,
    operating_hours: [
      { day_of_week: 4, opens_at: '23:00:00', closes_at: '01:00:00', is_closed: false },
    ],
  };
  const slots = generateCollectionSlotSchedule(overnight, {
    now: new Date('2026-10-15T20:00:00.000Z'),
    horizonDays: 1,
  });

  assert.deepEqual(slots.map((slot) => [slot.starts_at, slot.ends_at]), [
    ['2026-10-15T21:00:00.000Z', '2026-10-15T21:30:00.000Z'],
    ['2026-10-15T21:30:00.000Z', '2026-10-15T22:00:00.000Z'],
    ['2026-10-15T22:00:00.000Z', '2026-10-15T22:30:00.000Z'],
    ['2026-10-15T22:30:00.000Z', '2026-10-15T23:00:00.000Z'],
  ]);
});

test('excludes closed days and slots that have already started', () => {
  const slots = generateCollectionSlotSchedule({
    ...location,
    operating_hours: [
      { day_of_week: 4, opens_at: '09:00:00', closes_at: '10:00:00', is_closed: true },
      { day_of_week: 5, opens_at: '09:00:00', closes_at: '10:00:00', is_closed: false },
    ],
  }, {
    now: new Date('2026-10-15T08:00:00.000Z'),
    horizonDays: 2,
  });

  assert.equal(slots.length, 2);
  assert.ok(slots.every((slot) => slot.starts_at.startsWith('2026-10-16T')));
});

test('rejects a location without a timezone rather than silently scheduling in server time', () => {
  assert.throws(
    () => generateCollectionSlotSchedule({ ...location, sites: null }),
    /no site timezone/,
  );
});
