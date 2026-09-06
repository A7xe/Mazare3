import {
  AVAILABILITY_PERIODS,
  PROPERTY_SORT_OPTIONS,
  PROPERTY_TYPES,
  serializePropertySearchQuery,
  type AvailabilityPeriod,
  type PropertySearchQuery,
} from '@mazare3/shared';
import type { PropertySearchParams } from './api-properties';

const AMENITY_KEYS = [
  'pool',
  'heated_pool',
  'indoor_pool',
  'bbq',
  'football',
  'wifi',
  'parking',
  'ac',
  'garden',
  'events',
  'kids_pool',
] as const;

function first(raw: Record<string, string | string[] | undefined>, key: string) {
  const v = raw[key];
  return Array.isArray(v) ? v[0] : v;
}

export function parseSearchParams(
  raw: Record<string, string | string[] | undefined>,
): PropertySearchParams {
  const get = (key: string) => first(raw, key);
  const sort = get('sort');
  const propertyType = get('propertyType');
  const period = get('period');
  const amenitiesRaw = get('amenities');
  const guests = get('guests');
  const minPrice = get('minPrice');
  const maxPrice = get('maxPrice');
  const page = get('page');
  const latRaw = get('lat');
  const lngRaw = get('lng');
  const latNum = latRaw != null && latRaw !== '' ? Number(latRaw) : undefined;
  const lngNum = lngRaw != null && lngRaw !== '' ? Number(lngRaw) : undefined;

  return {
    q: get('q') || undefined,
    city: get('city') || undefined,
    area: get('area') || undefined,
    date: get('date') || undefined,
    period:
      period && (AVAILABILITY_PERIODS as readonly string[]).includes(period)
        ? (period as AvailabilityPeriod)
        : undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    guests: guests ? Number(guests) : undefined,
    propertyType:
      propertyType && (PROPERTY_TYPES as readonly string[]).includes(propertyType)
        ? (propertyType as PropertySearchQuery['propertyType'])
        : undefined,
    amenities: amenitiesRaw ? amenitiesRaw.split(',').filter(Boolean) : undefined,
    hasPool: get('hasPool') === 'true' ? true : get('hasPool') === 'false' ? false : undefined,
    allowsOvernight: get('allowsOvernight') === 'true' ? true : undefined,
    allowsEvents: get('allowsEvents') === 'true' ? true : undefined,
    featured: get('featured') === 'true' ? true : undefined,
    offersOnly: get('offersOnly') === 'true' ? true : undefined,
    newlyAdded: get('newlyAdded') === 'true' ? true : undefined,
    verifiedOnly: get('verifiedOnly') === 'true' || get('verified') === 'true' ? true : undefined,
    sort:
      sort && (PROPERTY_SORT_OPTIONS as readonly string[]).includes(sort)
        ? (sort as PropertySearchQuery['sort'])
        : 'recommended',
    lat:
      latNum != null && Number.isFinite(latNum) && latNum >= -90 && latNum <= 90
        ? latNum
        : undefined,
    lng:
      lngNum != null && Number.isFinite(lngNum) && lngNum >= -180 && lngNum <= 180
        ? lngNum
        : undefined,
    page: page ? Number(page) : 1,
  };
}

export function searchQueryString(params: PropertySearchParams): string {
  return serializePropertySearchQuery(params);
}

export const SEARCH_AMENITY_KEYS = AMENITY_KEYS;
