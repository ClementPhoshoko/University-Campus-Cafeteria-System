/** True when Supabase rejected a stored session rather than simply having none. */
export function isSessionRejection(error) {
  if (!error) return false;
  const details = `${error.name || ''} ${error.code || ''} ${error.message || ''}`;

  // A fresh browser profile has no stored session; that is not an expiry.
  if (/session\s*missing/i.test(details)) return false;
  if (error.status === 401 || error.code === '401') return true;
  return /refresh\s*token|access\s*token|jwt|session.*(expired|invalid|revoked)|token.*(expired|invalid)|expired/i.test(details);
}
