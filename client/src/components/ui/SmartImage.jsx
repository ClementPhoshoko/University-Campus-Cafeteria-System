import { useEffect, useState } from 'react';

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
  ...rest
}) {
  const [failed, setFailed] = useState(false);
  const [current, setCurrent] = useState(src || '');

  useEffect(() => {
    setCurrent(src || '');
    setFailed(false);
  }, [src]);

  if (!current || failed) {
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
      onError={() => setFailed(true)}
      style={style}
      {...rest}
    />
  );
}