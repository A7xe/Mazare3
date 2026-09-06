import { JORDAN_CITIES } from './constants';
import type { PropertySearchQuery } from './schemas/property-search';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Expand a city/area query into match variants (key + AR/EN labels). */
export function expandCityAreaQuery(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  const found = JORDAN_CITIES.find(
    (c) => c.key === lower || c.labelEn.toLowerCase() === lower || c.labelAr === trimmed,
  );
  if (!found) return [trimmed];
  return Array.from(new Set([found.key, found.labelEn, found.labelAr]));
}

export function isIsoDateString(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m! - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Serialize public search state for URLs. Omits empty values and default sort/page.
 * Does not invent a date when none was provided.
 */
export function serializePropertySearchQuery(
  query: Partial<PropertySearchQuery> & Record<string, unknown>,
): string {
  const sp = new URLSearchParams();
  const set = (key: string, value: string | number | boolean | undefined | null) => {
    if (value === undefined || value === null || value === '') return;
    if (value === false) return;
    sp.set(key, String(value));
  };

  set('q', typeof query.q === 'string' ? query.q.trim() || undefined : undefined);
  set('city', typeof query.city === 'string' ? query.city.trim() || undefined : undefined);
  set('area', typeof query.area === 'string' ? query.area.trim() || undefined : undefined);
  set('date', typeof query.date === 'string' ? query.date : undefined);
  set('period', typeof query.period === 'string' ? query.period : undefined);
  set('guests', typeof query.guests === 'number' ? query.guests : undefined);
  set('minPrice', typeof query.minPrice === 'number' ? query.minPrice : undefined);
  set('maxPrice', typeof query.maxPrice === 'number' ? query.maxPrice : undefined);
  set('propertyType', typeof query.propertyType === 'string' ? query.propertyType : undefined);
  if (Array.isArray(query.amenities) && query.amenities.length) {
    sp.set('amenities', query.amenities.join(','));
  }
  if (query.hasPool === true) sp.set('hasPool', 'true');
  if (query.hasPool === false) sp.set('hasPool', 'false');
  if (query.allowsOvernight === true) sp.set('allowsOvernight', 'true');
  if (query.allowsEvents === true) sp.set('allowsEvents', 'true');
  if (query.featured === true) sp.set('featured', 'true');
  if (query.offersOnly === true) sp.set('offersOnly', 'true');
  if (query.newlyAdded === true) sp.set('newlyAdded', 'true');
  if (query.verifiedOnly === true || query.verified === true) sp.set('verifiedOnly', 'true');
  if (query.sort && query.sort !== 'recommended') sp.set('sort', String(query.sort));
  if (typeof query.lat === 'number' && Number.isFinite(query.lat)) sp.set('lat', String(query.lat));
  if (typeof query.lng === 'number' && Number.isFinite(query.lng)) sp.set('lng', String(query.lng));
  if (typeof query.page === 'number' && query.page > 1) sp.set('page', String(query.page));
  if (typeof query.pageSize === 'number' && query.pageSize > 0) sp.set('pageSize', String(query.pageSize));

  return sp.toString();
}

export function searchHref(path: string, query: Partial<PropertySearchQuery>): string {
  const qs = serializePropertySearchQuery(query);
  return qs ? `${path}?${qs}` : path;
}
