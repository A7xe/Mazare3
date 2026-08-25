import { PROPERTY_TYPES, type PropertyType } from './constants';
import type { PropertySearchQuery } from './schemas/property-search';

/**
 * Stable Explore primary-category order: property types only.
 * All is handled separately in the UI.
 */
export const EXPLORE_PROPERTY_TYPE_CATEGORY_ORDER: readonly PropertyType[] = [
  'farm',
  'chalet',
  'villa',
  'istiraha',
  'private_resort',
  'pool_house',
] as const;

/** Guard: every catalogued public type appears exactly once in the category row. */
export function assertExploreCategoryTypesCoverCatalog(): boolean {
  const ordered = new Set(EXPLORE_PROPERTY_TYPE_CATEGORY_ORDER);
  if (ordered.size !== PROPERTY_TYPES.length) return false;
  return PROPERTY_TYPES.every((t) => ordered.has(t));
}

/**
 * "All" clears ONLY propertyType; preserves city/date/period/guests/pool/amenities/events/sort/geo/…
 */
export function exploreCategoryAllParams(
  base: Partial<PropertySearchQuery>,
): Partial<PropertySearchQuery> {
  return {
    ...base,
    propertyType: undefined,
  };
}

/**
 * Selecting a type sets/replaces propertyType only; preserves unrelated filters (including hasPool).
 */
export function exploreCategoryTypeParams(
  base: Partial<PropertySearchQuery>,
  propertyType: PropertyType,
): Partial<PropertySearchQuery> {
  return {
    ...base,
    propertyType,
  };
}

export function exploreCategoryActiveId(
  propertyType: PropertyType | string | null | undefined,
): 'all' | PropertyType {
  if (propertyType && (PROPERTY_TYPES as readonly string[]).includes(propertyType)) {
    return propertyType as PropertyType;
  }
  return 'all';
}

/** Primary category row must not advertise these non-type concepts. */
export const EXPLORE_REMOVED_MIXED_CATEGORY_IDS = [
  'families',
  'pool',
  'football',
  'lounges',
] as const;
