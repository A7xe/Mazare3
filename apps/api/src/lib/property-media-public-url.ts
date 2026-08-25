import {
  buildPublicPropertyMediaUrl,
  isPublicR2MediaKey,
  peekPublicMediaBaseUrl,
} from '../config/property-media-storage.config.js';

export function resolvePropertyMediaPublicUrl(row: {
  url: string;
  storageKey?: string | null;
}): string {
  const key = (row.storageKey ?? '').replace(/\\/g, '/');
  if (key && isPublicR2MediaKey(key)) {
    const base = peekPublicMediaBaseUrl();
    if (base) return buildPublicPropertyMediaUrl(base, key);
  }
  return row.url;
}
