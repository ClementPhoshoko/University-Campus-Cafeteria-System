import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocationServiceStatus, getSiteServiceStatus } from '../src/utils/vendorAvailability.js';

const siteTimezone = { timezone: 'Africa/Johannesburg' };

test('service status respects the current day and site timezone schedule', () => {
  const location = {
    is_active: true,
    service_status: 'open',
    sites: siteTimezone,
    operating_hours: [
      { day_of_week: 1, opens_at: '09:00:00', closes_at: '17:00:00', is_closed: false },
    ],
  };

  assert.equal(getLocationServiceStatus(location, new Date('2026-10-12T08:00:00Z')), 'open');
  assert.equal(getLocationServiceStatus(location, new Date('2026-10-12T18:00:00Z')), 'closed');
});

test('service status preserves manual busy and closed states', () => {
  const base = {
    is_active: true,
    sites: siteTimezone,
    operating_hours: [
      { day_of_week: 1, opens_at: '09:00:00', closes_at: '17:00:00', is_closed: false },
    ],
  };
  const duringHours = new Date('2026-10-12T08:00:00Z');

  assert.equal(getLocationServiceStatus({ ...base, service_status: 'busy' }, duringHours), 'busy');
  assert.equal(getLocationServiceStatus({ ...base, service_status: 'temporarily_unavailable' }, duringHours), 'closed');
  assert.equal(getLocationServiceStatus({ ...base, service_status: 'open', is_active: false }, duringHours), 'closed');
});

test('site availability uses open first, then busy, and handles overnight hours', () => {
  const now = new Date('2026-10-17T22:30:00Z');
  const locations = [
    {
      is_active: true,
      service_status: 'busy',
      sites: siteTimezone,
      operating_hours: [{ day_of_week: 6, opens_at: '09:00:00', closes_at: '17:00:00', is_closed: false }],
    },
    {
      is_active: true,
      service_status: 'open',
      sites: siteTimezone,
      operating_hours: [{ day_of_week: 6, opens_at: '22:00:00', closes_at: '02:00:00', is_closed: false }],
    },
  ];

  assert.equal(getSiteServiceStatus(locations, now), 'open');
  assert.equal(getSiteServiceStatus(locations.slice(0, 1), now), 'closed');
});

test('missing service statuses do not default to open', () => {
  assert.equal(getLocationServiceStatus({ is_active: true }), 'closed');
  assert.equal(getSiteServiceStatus([]), 'closed');
});
