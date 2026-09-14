const imageCache = new Map();
const loaders = new Map();

export function preloadImage(src) {
  if (!src) return Promise.resolve();
  if (imageCache.has(src)) return imageCache.get(src);

  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { imageCache.set(src, true); resolve(); };
    img.onerror = () => { imageCache.set(src, false); reject(new Error(`Image failed: ${src}`)); };
    img.src = src;
  });

  loaders.set(src, promise);
  return promise;
}

export function isImageCached(src) {
  if (!src) return false;
  return imageCache.get(src) === true;
}

export function getImageStatus(src) {
  if (!src) return 'idle';
  if (imageCache.has(src)) return imageCache.get(src) ? 'loaded' : 'error';
  return 'idle';
}

export function preloadImages(sources) {
  return Promise.allSettled(
    sources.filter(Boolean).map((src) => preloadImage(src).catch(() => {}))
  );
}

export function clearImageCache() {
  imageCache.clear();
  loaders.clear();
}
