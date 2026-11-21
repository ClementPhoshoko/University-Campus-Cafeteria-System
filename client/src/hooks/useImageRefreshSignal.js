import { useEffect, useState } from 'react';

/**
 * Page-scoped AbortSignal for best-effort image refresh requests.
 * A fresh controller is created on each effect mount so React StrictMode's
 * remount does not leave callers with an already-aborted signal.
 */
export function useImageRefreshSignal() {
  const [controller, setController] = useState(null);

  useEffect(() => {
    const next = new AbortController();
    setController(next);
    return () => next.abort();
  }, []);

  return controller?.signal;
}
