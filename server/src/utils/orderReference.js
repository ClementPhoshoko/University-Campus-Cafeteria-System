import crypto from 'node:crypto';

const REFERENCE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateOrderReference() {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()).replaceAll('-', '');
  const suffix = Array.from({ length: 8 }, () => REFERENCE_ALPHABET[crypto.randomInt(REFERENCE_ALPHABET.length)]).join('');
  return `MM-${date}-${suffix}`;
}
