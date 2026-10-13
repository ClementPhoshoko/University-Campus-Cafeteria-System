import test from 'node:test';
import assert from 'node:assert/strict';
import { getCafeteriaDescription } from '../src/utils/cafeteriaDescription.js';

const vendors = [
  { name: 'Zest Cafe', description: 'Fresh wraps, salads, and smoothies.' },
  { name: 'Campus Kitchen', description: 'Hot meals made throughout the day.' },
];

test('prefers a meaningful site description', () => {
  assert.equal(
    getCafeteriaDescription({ description: 'A welcoming campus dining hub.' }, vendors),
    'A welcoming campus dining hub.',
  );
});

test('uses the saved site description as the source of truth', () => {
  assert.equal(
    getCafeteriaDescription({
      description: 'A convenient dining spot for campus visitors.',
      street_address: '12 Main Road',
      city: 'Johannesburg',
    }, vendors),
    'A convenient dining spot for campus visitors.',
  );
});

test('falls back to a vendor description when the site description is empty', () => {
  assert.equal(
    getCafeteriaDescription({
      description: null,
    }, vendors),
    'Hot meals made throughout the day.',
  );
});

test('returns null when neither site nor vendor has a description', () => {
  assert.equal(
    getCafeteriaDescription({ description: null }, [{ name: 'Cafe', description: ' ' }]),
    null,
  );
});
