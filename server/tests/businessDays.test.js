import test from 'node:test';
import assert from 'node:assert/strict';
import { addSouthAfricanBusinessDays } from '../src/utils/businessDays.js';

test('three business days skip weekends and South African public holidays', () => {
  assert.equal(
    addSouthAfricanBusinessDays(new Date('2026-04-02T10:00:00.000Z')).toISOString(),
    '2026-04-09T21:59:59.999Z',
  );
});

test('a Sunday public holiday is observed on the following Monday', () => {
  assert.equal(
    addSouthAfricanBusinessDays(new Date('2026-08-07T10:00:00.000Z')).toISOString(),
    '2026-08-13T21:59:59.999Z',
  );
});

test('business day utility rejects invalid arguments', () => {
  assert.throws(() => addSouthAfricanBusinessDays('invalid'), /valid date/);
  assert.throws(() => addSouthAfricanBusinessDays(new Date(), 0), /positive integer/);
});
