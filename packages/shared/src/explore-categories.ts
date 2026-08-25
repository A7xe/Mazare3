import { PROPERTY_TYPES, type PropertyType } from './constants';
import type { PropertySearchQuery } from './schemas/property-search';
import { searchHref } from './search-query';

/**
 * Stable Explore primary category order: All (handled separately), then core types.
 * Matches authoritative PROPERTY_TYPES — product-defined, not popularity-sorted.
 */
export const EXPLORE_PROPERTY_TYPE_CATEGORY_ORDER: readonly PropertyType[] = PROPERTY_TYPES;

export type ExploreCategoryFilters = Partial<
  Pick<
    PropertySearchQuery,
    | 'q'
    | 'city'
    | 'area'
    | 'date'
    | 'period'
    | 'guests'
    | 'minPrice'
    | 'maxPrice'
    | 'propertyType'
    | 'amenities'
    | 'hasPool'
    | 'allowsOvernight'
    | 'allowsEvents'
    | 'featured'
    | 'verifiedOnly'
    | 'sort'
    | 'lat'
    | 'lng'
    | 'page'
    | 'pageSize'
  >
>;

/** Preserve browse context; clear only propertyType. */
export function exploreCategoryAllParams(base: ExploreCategoryFilters): ExploreCategoryFilters {
  const { propertyType: _cleared, ...rest } = base;
  return { ...rest, propertyType: undefined, page: undefined };
}

/** Set/replace propertyType only; keep unrelated filters (pool, city, date, …). */
export function exploreCategoryTypeParams(
  base: ExploreCategoryFilters,
  propertyType: PropertyType,
): ExploreCategoryFilters {
  return {
    ...base,
    propertyType,
    page: undefined,
  };
}

export function isExploreCategoryAllActive(filters: ExploreCategoryFilters): boolean {
  return !filters.propertyType;
}

export function activeExplorePropertyTypeCategory(
  filters: ExploreCategoryFilters,
): PropertyType | 'all' {
  const pt = filters.propertyType;
  if (pt && (PROPERTY_TYPES as readonly string[]).includes(pt)) return pt;
  return 'all';
}

export function exploreCategoryHref(
  path: string,
  base: ExploreCategoryFilters,
  propertyType: PropertyType | null,
): string {
  const params =
    propertyType == null
      ? exploreCategoryAllParams(base)
      : exploreCategoryTypeParams(base, propertyType);
  return searchHref(path, params);
}

/** Primary category row must not advertise these non-type concepts. */
export const EXPLORE_REMOVED_MIXED_CATEGORY_IDS = [
  'families',
  'pool',
  'football',
  'lounges',
] as const;
