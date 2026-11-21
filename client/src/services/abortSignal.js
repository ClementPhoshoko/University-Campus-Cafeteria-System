/**
 * Bridge an externally supplied cancel signal into a local AbortController.
 *
 * Browsers normally expose EventTarget methods on AbortSignal, but embedded
 * WebViews and older engines can provide only `onabort`. API wrappers must not
 * fail before the request is even sent just because that method is missing.
 */
export function attachAbortListener(signal, onAbort) {
  if (!signal || (typeof signal !== 'object' && typeof signal !== 'function')) {
    return () => {};
  }

  if (typeof signal.addEventListener === 'function') {
    signal.addEventListener('abort', onAbort, { once: true });
    return () => {
      if (typeof signal.removeEventListener === 'function') {
        signal.removeEventListener('abort', onAbort);
      }
    };
  }

  if ('onabort' in signal) {
    const previous = signal.onabort;
    signal.onabort = (event) => {
      if (typeof previous === 'function') previous.call(signal, event);
      onAbort(event);
    };
    return () => {
      signal.onabort = previous;
    };
  }

  return () => {};
}
