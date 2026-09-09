const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const DEFAULT_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'REQUEST_FAILED', details, payload } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.payload = payload;
  }
}

export function buildUrl(path, query = {}) {
  const url = new URL(`${apiBaseUrl}${path}`, window.location.origin);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== '') {
          url.searchParams.append(key, String(item));
        }
      });
      return;
    }
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function getErrorMessage(payload, fallback) {
  if (payload?.error?.message) return payload.error.message;
  if (typeof payload === 'string' && payload.trim()) return payload;
  return fallback;
}

export async function apiRequest(path, {
  method = 'GET',
  token,
  query,
  body,
  headers = {},
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();

  if (signal) {
    if (signal.aborted) controller.abort();
    signal.addEventListener('abort', abortFromCaller, { once: true });
  }

  try {
    const response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const payload = await parseResponse(response);

    if (!response.ok) {
      throw new ApiError(
        getErrorMessage(payload, `Request failed (${response.status})`),
        { status: response.status, code: payload?.error?.code, details: payload?.error?.details, payload },
      );
    }

    return payload;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out', { code: 'TIMEOUT' });
    }
    throw err;
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', abortFromCaller);
  }
}

export async function getHealth() {
  const response = await fetch(`${apiBaseUrl}/health`);
  if (!response.ok) throw new Error('API health check failed');
  return response.json();
}
