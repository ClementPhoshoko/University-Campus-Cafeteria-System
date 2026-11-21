import { useEffect, useState } from 'react';
import { IMAGE_REFRESH_COOLDOWN_MS } from '../../services/imageRefresh.js';

const DEFAULT_RETRY_AFTER_MS = IMAGE_REFRESH_COOLDOWN_MS + 1000;

const FALLBACK = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="transparent"/><g fill="none" stroke="#c4cdd6" stroke-width="5"><rect x="18" y="26" width="64" height="48" rx="6" /><circle cx="41" cy="43" r="9" fill="#c4cdd6" stroke="none" /><path d="M24 66 L40 52 L52 62 L64 52 L76 64" stroke-linecap="round" stroke-linejoin="round" /></g></svg>',
)}`;

export default function SmartImage({
  src,
  alt = '',
  className,
  width,
  height,
  eager = false,
  style,
  onError,
  retryAfterMs = DEFAULT_RETRY_AFTER_MS,
  ...rest
}) {
  const current = src || '';
  const [failedSrc, setFailedSrc] = useState(null);

  const handleError = (event) => {
    setFailedSrc(current);
    onError?.(event);
  };

  useEffect(() => {
    setFailedSrc(null);
  }, [current]);

  useEffect(() => {
    if (!failedSrc || retryAfterMs <= 0 || typeof window === 'undefined') return undefined;
    const timer = window.setTimeout(() => setFailedSrc(null), retryAfterMs);
    return () => window.clearTimeout(timer);
  }, [failedSrc, retryAfterMs]);

  if (!current || failedSrc === current) {
    return <img src={FALLBACK} alt={alt} className={className} width={width} height={height} loading="lazy" decoding="async" style={style} {...rest} />;
  }

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : 'auto'}
      onError={handleError}
      style={style}
      {...rest}
    />
  );
}
