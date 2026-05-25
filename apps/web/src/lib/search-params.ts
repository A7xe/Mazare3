import type { PropertySearchParams } from './api-properties';
import { PROPERTY_SORT_OPTIONS, PROPERTY_TYPES } from '@mazare3/shared';

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

export function parseSearchParams(
  raw: Record<string, string | string[] | undefined>,
): PropertySearchParams {
  const get = (key: string) => {
    const v = raw[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const sort = get('sort');
  const propertyType = get('propertyType');
  const amenitiesRaw = get('amenities');

  return {
    q: get('q') || undefined,
    area: get('area') || undefined,
    minPrice: get('minPrice') ? Number(get('minPrice')) : undefined,
    maxPrice: get('maxPrice') ? Number(get('maxPrice')) : undefined,
    guests: get('guests') ? Number(get('guests')) : undefined,
    propertyType:
      propertyType && (PROPERTY_TYPES as readonly string[]).includes(propertyType)
        ? (propertyType as PropertySearchParams['propertyType'])
        : undefined,
    amenities: amenitiesRaw ? amenitiesRaw.split(',').filter(Boolean) : undefined,
    hasPool: get('hasPool') === 'true' ? true : get('hasPool') === 'false' ? false : undefined,
    verifiedOnly: get('verifiedOnly') === 'true',
    sort:
      sort && (PROPERTY_SORT_OPTIONS as readonly string[]).includes(sort)
        ? (sort as PropertySearchParams['sort'])
        : 'recommended',
  };
}

export const SEARCH_AMENITY_KEYS = AMENITY_KEYS;
