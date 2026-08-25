import { AMENITY_KEYS, JORDAN_CITIES, PROPERTY_TYPES, type PropertyType } from './constants';
import type { PropertySearchQuery } from './schemas/property-search';
import { EXPLORE_PROPERTY_TYPE_CATEGORY_ORDER } from './explore-categories';

/** Amenity keys exposed in Explore Filter sheet (authoritative public catalog). */
export const EXPLORE_FILTER_SHEET_AMENITY_KEYS = AMENITY_KEYS;

/** Dimensions owned by the Filter sheet (not search bar / sort pills / booking intent). */
export const EXPLORE_FILTER_SHEET_OWNED_KEYS = [
  'city',
  'minPrice',
  'maxPrice',
  'propertyType',
  'hasPool',
  'amenities',
  'allowsOvernight',
  'allowsEvents',
  'verifiedOnly',
] as const;

export type ExploreFilterSheetOwnedKey = (typeof EXPLORE_FILTER_SHEET_OWNED_KEYS)[number];

export type ExploreFilterSheetInput = {
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  propertyType?: PropertyType;
  hasPool?: boolean;
  amenities?: string[];
  allowsOvernight?: boolean;
  allowsEvents?: boolean;
  verifiedOnly?: boolean;
};

export type ExplorePriceValidation =
  | { ok: true; minPrice?: number; maxPrice?: number }
  | { ok: false; reason: 'negative_min' | 'negative_max' | 'min_gt_max' };

export function exploreFilterCityOptions() {
  return JORDAN_CITIES;
}

export function exploreFilterPropertyTypeOptions(): readonly PropertyType[] {
  return EXPLORE_PROPERTY_TYPE_CATEGORY_ORDER.length
    ? EXPLORE_PROPERTY_TYPE_CATEGORY_ORDER
    : PROPERTY_TYPES;
}

/** Canonical amenity matching in API: each selected amenity is AND-required. */
export const EXPLORE_AMENITY_MATCH_MODE = 'ALL' as const;

export function validateExplorePriceRange(
  minRaw: unknown,
  maxRaw: unknown,
): ExplorePriceValidation {
  const parseOpt = (v: unknown): number | undefined => {
    if (v === '' || v == null) return undefined;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return undefined;
    return n;
  };
  const minPrice = parseOpt(minRaw);
  const maxPrice = parseOpt(maxRaw);
  if (minPrice != null && minPrice < 0) return { ok: false, reason: 'negative_min' };
  if (maxPrice != null && maxPrice < 0) return { ok: false, reason: 'negative_max' };
  if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
    return { ok: false, reason: 'min_gt_max' };
  }
  return { ok: true, minPrice, maxPrice };
}

function sanitizeAmenities(amenities: string[] | undefined): string[] | undefined {
  if (!amenities?.length) return undefined;
  const allowed = new Set<string>(AMENITY_KEYS);
  const next = [...new Set(amenities.map((a) => a.trim()).filter((a) => allowed.has(a)))];
  return next.length ? next : undefined;
}

/**
 * Apply Filter-sheet values onto current Explore URL state.
 * Preserves q, sort, date, period, guests, lat/lng (and area).
 * Does not write featured (commercial placement is not a customer filter).
 */
export function buildExploreFilterApplyParams(
  current: Partial<PropertySearchQuery>,
  sheet: ExploreFilterSheetInput,
): Partial<PropertySearchQuery> {
  const prices = validateExplorePriceRange(sheet.minPrice, sheet.maxPrice);
  if (!prices.ok) {
    throw new Error(prices.reason);
  }

  return {
    q: current.q,
    sort: current.sort,
    date: current.date,
    period: current.period,
    guests: current.guests,
    lat: current.lat,
    lng: current.lng,
    area: current.area,
    city: sheet.city || undefined,
    minPrice: prices.minPrice,
    maxPrice: prices.maxPrice,
    propertyType: sheet.propertyType,
    hasPool: sheet.hasPool === true ? true : undefined,
    amenities: sanitizeAmenities(sheet.amenities),
    allowsOvernight: sheet.allowsOvernight === true ? true : undefined,
    allowsEvents: sheet.allowsEvents === true ? true : undefined,
    verifiedOnly: sheet.verifiedOnly === true ? true : undefined,
    page: undefined,
    // Explicitly omit featured — paid placement is not a customer requirement filter.
  };
}

/**
 * Reset only Filter-sheet-owned dimensions.
 * Preserves search q, sort pills, booking intent, and geo context.
 */
export function buildExploreFilterResetParams(
  current: Partial<PropertySearchQuery>,
): Partial<PropertySearchQuery> {
  return {
    q: current.q,
    sort: current.sort,
    date: current.date,
    period: current.period,
    guests: current.guests,
    lat: current.lat,
    lng: current.lng,
    area: current.area,
    page: undefined,
  };
}

/** verifiedOnly → Property.verificationStatus in platform_reviewed | platform_verified */
export const EXPLORE_VERIFIED_ONLY_MEANING =
  'Mazare3 platform verification (platform_reviewed or platform_verified)' as const;
