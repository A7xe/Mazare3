import { PlacementType } from '@mazare3/db';
import {
  type DiscoveryQuery,
  type MarketplaceDiscoveryResponse,
  type MarketplaceDiscoverySection,
  type PublicPropertySummary,
  getPlatformTimeZone,
  parseMarketplaceUserCoords,
} from '@mazare3/shared';
import { listLivePlacementPropertyIds } from './placement.service.js';
import { listLivePromotionPropertyIds } from './promotion.service.js';
import { listTopRatedPublicPropertyIds } from './review.service.js';
import {
  listMostBookedPublicPropertyIds,
  listNearbyPublicPropertyIds,
} from './property-popularity.service.js';
import {
  countPublishedPropertiesByCity,
  discoveryPropertyFilter,
  listAvailabilityEligiblePropertyIds,
  loadPublicPropertyCardsByIds,
  loadPublicPropertyCatalog,
} from './property-search.service.js';

const SECTION_SIZE = 8;
const EXPLORE_NEAR_SIZE = 3;
const EXPLORE_MOST_BOOKED_SIZE = 3;
const SOURCE_TAKE = SECTION_SIZE * 2;
const RECENTLY_ADDED_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function pick(
  list: PublicPropertySummary[],
  used: Set<string>,
  n = SECTION_SIZE,
): PublicPropertySummary[] {
  const chosen = list.filter((p) => !used.has(p.id)).slice(0, n);
  for (const p of chosen) used.add(p.id);
  return chosen;
}

function section(
  id: string,
  properties: PublicPropertySummary[],
): MarketplaceDiscoverySection | null {
  if (!properties.length) return null;
  return { id, propertyIds: properties.map((p) => p.id), properties };
}

function byCreatedThenId(a: PublicPropertySummary, b: PublicPropertySummary): number {
  const created = (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  if (created) return created;
  return a.id.localeCompare(b.id);
}

function byTopRated(a: PublicPropertySummary, b: PublicPropertySummary): number {
  if (b.rating !== a.rating) return b.rating - a.rating;
  if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
  return a.id.localeCompare(b.id);
}

function orderByIds(cards: PublicPropertySummary[], ids: string[]): PublicPropertySummary[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return ids.map((id) => byId.get(id)).filter((c): c is PublicPropertySummary => Boolean(c));
}

/** Availability-eligible property ids when date intent exists; otherwise null (browse-all). */
async function resolveEligiblePropertyIds(query: DiscoveryQuery): Promise<string[] | null> {
  if (!query.date) return null;
  // Lightweight ID path — full eligible set, no card hydration / no 48-page search loop.
  return listAvailabilityEligiblePropertyIds({
    city: query.city,
    area: query.area,
    guests: query.guests,
    date: query.date,
    period: query.period,
  });
}

export async function getMarketplaceDiscovery(
  query: DiscoveryQuery,
): Promise<MarketplaceDiscoveryResponse> {
  const zone = getPlatformTimeZone();
  const scope = { city: query.city, area: query.area, guests: query.guests };
  const propertyFilter = discoveryPropertyFilter(scope);
  const userCoords = parseMarketplaceUserCoords(query.lat, query.lng);
  const eligiblePropertyIds = await resolveEligiblePropertyIds(query);

  const [sponsoredIds, featuredIds, offerIds, topRatedRows, catalog, cityPropertyCounts] =
    await Promise.all([
      listLivePlacementPropertyIds({
        placementType: PlacementType.sponsored,
        propertyWhere: propertyFilter,
        take: SOURCE_TAKE,
      }),
      listLivePlacementPropertyIds({
        placementType: PlacementType.featured,
        propertyWhere: propertyFilter,
        take: SOURCE_TAKE,
      }),
      listLivePromotionPropertyIds({
        propertyWhere: propertyFilter,
        take: SOURCE_TAKE,
      }),
      listTopRatedPublicPropertyIds({
        propertyWhere: propertyFilter,
        take: SOURCE_TAKE,
        eligiblePropertyIds,
      }),
      loadPublicPropertyCatalog({
        city: query.city,
        area: query.area,
        guests: query.guests,
        date: query.date,
        period: query.period,
      }),
      countPublishedPropertiesByCity(scope),
    ]);

  const nearbyRows = userCoords
    ? await listNearbyPublicPropertyIds({
        lat: userCoords.lat,
        lng: userCoords.lng,
        propertyWhere: propertyFilter,
        take: EXPLORE_NEAR_SIZE,
        eligiblePropertyIds,
      })
    : [];

  const mostBookedRows = await listMostBookedPublicPropertyIds({
    propertyWhere: propertyFilter,
    take: EXPLORE_MOST_BOOKED_SIZE,
    eligiblePropertyIds,
    preferExcludeIds: nearbyRows.map((r) => r.propertyId),
  });

  const topRatedIds = topRatedRows.map((r) => r.propertyId);
  const mostBookedIds = mostBookedRows.map((r) => r.propertyId);
  const nearbyIds = nearbyRows.map((r) => r.propertyId);
  const commercialIds = [
    ...new Set([
      ...sponsoredIds,
      ...featuredIds,
      ...offerIds,
      ...topRatedIds,
      ...mostBookedIds,
      ...nearbyIds,
    ]),
  ];
  const commercialCards = await loadPublicPropertyCardsByIds(commercialIds, scope);

  const used = new Set<string>();
  const sponsored = pick(orderByIds(commercialCards, sponsoredIds), used);
  const featured = pick(orderByIds(commercialCards, featuredIds), used);
  const offers = pick(
    orderByIds(commercialCards, offerIds).filter((p) => p.hasActivePromotion),
    used,
  );
  const topRated = pick(
    orderByIds(commercialCards, topRatedIds)
      .filter((p) => p.reviewCount > 0)
      .sort(byTopRated),
    used,
  );

  // Truthful rails: do not share the commercial `used` set — labels must not hide real nearby/popular.
  const mostBooked = orderByIds(commercialCards, mostBookedIds).slice(0, EXPLORE_MOST_BOOKED_SIZE);
  const nearby = orderByIds(commercialCards, nearbyIds).slice(0, EXPLORE_NEAR_SIZE);

  const recentCutoffMs = Date.now() - RECENTLY_ADDED_WINDOW_DAYS * MS_PER_DAY;
  const recentlyAdded = [...catalog]
    .filter((p) => {
      if (!p.createdAt) return false;
      return new Date(p.createdAt).getTime() >= recentCutoffMs;
    })
    .sort(byCreatedThenId)
    .slice(0, SECTION_SIZE);

  const sections: MarketplaceDiscoverySection[] = [];
  for (const s of [
    section('sponsored', sponsored),
    section('featured', featured),
    section('offers', offers),
    section('topRated', topRated),
    section('mostBooked', mostBooked),
    section('nearby', nearby),
    section('recentlyAdded', recentlyAdded),
  ]) {
    if (s) sections.push(s);
  }

  return {
    timeZone: zone,
    mode: query.date ? 'availability' : 'browse',
    sections,
    cityPropertyCounts,
  };
}
