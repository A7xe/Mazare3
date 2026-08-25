import type { PropertySearchQuery } from './schemas/property-search';

/** Textual Explore search mode: free-text `q` is active. */
export function isExploreTextSearchMode(query: Partial<PropertySearchQuery>): boolean {
  return Boolean(query.q?.trim());
}

export const EXPLORE_SECONDARY_RECOMMENDATION_LIMIT = 8;

/**
 * Build params for organic "other farms you may like" under the same filters,
 * without free-text q. Always uses recommended sort for organic fallback.
 */
export function buildExploreSecondaryRecommendationParams(
  query: Partial<PropertySearchQuery>,
): Partial<PropertySearchQuery> {
  return {
    city: query.city,
    area: query.area,
    date: query.date,
    period: query.period,
    guests: query.guests,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    propertyType: query.propertyType,
    amenities: query.amenities,
    hasPool: query.hasPool,
    allowsEvents: query.allowsEvents,
    allowsOvernight: query.allowsOvernight,
    verifiedOnly: query.verifiedOnly,
    lat: query.lat,
    lng: query.lng,
    sort: 'recommended',
    page: 1,
    pageSize: EXPLORE_SECONDARY_RECOMMENDATION_LIMIT,
    q: undefined,
  };
}

/** Show secondary recommendations only when primary direct set is complete (no more pages). */
export function shouldShowExploreSecondaryRecommendations(meta: {
  total: number;
  hasMore: boolean;
}): boolean {
  return !meta.hasMore;
}
