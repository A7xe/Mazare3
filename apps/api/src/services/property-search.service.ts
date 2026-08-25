import { prisma, Prisma, PropertyStatus, VerificationStatus, AvailabilitySlotStatus } from '@mazare3/db';
import {
  calculateBookingFinancialSnapshot,
  expandCityAreaQuery,
  getPlatformTimeZone,
  propertySearchHasMore,
  todayDateIsoInZone,
  type AvailabilityPeriod,
  type PropertySearchMatch,
  type PropertySearchMeta,
  type PropertySearchQuery,
  type PropertySearchResponse,
  type PublicPropertySummary,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { SLOT_HOLDING_STATUSES } from '../lib/payment-hold.js';
import {
  decimalToNumber,
  formatDateOnlyUtc,
  holdingOverlapsRequested,
  mapTimedFields,
  occupancyTimes,
  parseDateOnlyUtc,
  slotTimesOrNull,
} from '../lib/availability-times.js';
import { toPublicPropertySummary, applyLiveRating } from '../mappers/public-property.mapper.js';
import {
  getPublishedReviewStats,
  listPropertyIdsOrderedByPublishedRating,
} from './review.service.js';
import { listPropertyIdsOrderedByDistance } from './property-popularity.service.js';
import {
  loadPaymentPolicyConfig,
  resolveDepositPercent,
} from '../config/payment-policy.config.js';
import { loadLivePromotionsByProperty, toPriceInput } from './promotion.service.js';
import {
  compareDistanceRank,
  comparePublishedRatingRank,
  distanceKmToApproxProperty,
  parseMarketplaceUserCoords,
  resolveSlotPromotion,
} from '@mazare3/shared';
import {
  applyPlacementFlags,
  liveFeaturedFilter,
  loadLivePlacementsByPropertyIds,
  type LivePlacementFlags,
} from './placement.service.js';
import {
  listPropertyIdsOrderedByRecommended,
  rankPropertyIdsByRecommended,
} from './recommended-ranking.service.js';

const searchInclude = {
  media: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
  amenities: { include: { amenity: true } },
} as const;

type SearchPropertyRow = Prisma.PropertyGetPayload<{ include: typeof searchInclude }>;

function cityOrAreaClause(value: string): Prisma.PropertyWhereInput {
  const variants = expandCityAreaQuery(value);
  return {
    OR: variants.flatMap((v) => [
      { city: { equals: v, mode: 'insensitive' as const } },
      { area: { contains: v, mode: 'insensitive' as const } },
    ]),
  };
}

export function buildPropertySearchWhere(query: PropertySearchQuery): Prisma.PropertyWhereInput {
  const where: Prisma.PropertyWhereInput = {
    status: PropertyStatus.published,
    owner: { status: 'approved' },
  };
  const and: Prisma.PropertyWhereInput[] = [];

  if (query.q) {
    const q = query.q.trim();
    and.push({
      OR: [
        { titleAr: { contains: q, mode: 'insensitive' } },
        { titleEn: { contains: q, mode: 'insensitive' } },
        { descriptionAr: { contains: q, mode: 'insensitive' } },
        { descriptionEn: { contains: q, mode: 'insensitive' } },
        { area: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { approximateAddress: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  if (query.city) and.push(cityOrAreaClause(query.city));
  if (query.area) and.push(cityOrAreaClause(query.area));

  if (query.propertyType) where.type = query.propertyType;
  if (query.guests) where.capacity = { gte: query.guests };

  if (query.hasPool === true) {
    and.push({
      OR: [
        { poolsCount: { gt: 0 } },
        { amenities: { some: { amenity: { key: 'pool' } } } },
      ],
    });
  } else if (query.hasPool === false) {
    where.poolsCount = 0;
  }

  if (query.allowsOvernight) where.allowsOvernight = true;
  if (query.allowsEvents) where.allowsEvents = true;
  if (query.featured) Object.assign(where, liveFeaturedFilter());

  if (query.verifiedOnly || query.verified) {
    where.verificationStatus = {
      in: [VerificationStatus.platform_reviewed, VerificationStatus.platform_verified],
    };
  }

  if (query.amenities?.length) {
    for (const key of query.amenities) {
      and.push({ amenities: { some: { amenity: { key } } } });
    }
  }

  if (and.length) where.AND = and;
  return where;
}

function verificationRank(status: string): number {
  if (status === 'platform_verified') return 2;
  if (status === 'platform_reviewed') return 1;
  return 0;
}

/** Higher = closer farm-name match for `q` (title preferred over area/description hits). */
function titleRelevanceScore(q: string, titleAr: string | null | undefined, titleEn: string | null | undefined): number {
  const needle = q.trim().toLowerCase();
  if (!needle) return 0;
  const titles = [titleAr, titleEn]
    .map((t) => (t ?? '').trim().toLowerCase())
    .filter(Boolean);
  let best = 0;
  for (const title of titles) {
    if (title === needle) best = Math.max(best, 1000);
    else if (title.startsWith(needle)) best = Math.max(best, 800 - Math.min(title.length, 200));
    else if (title.includes(needle)) {
      const idx = title.indexOf(needle);
      best = Math.max(best, 500 - idx);
    } else {
      const tokens = needle.split(/\s+/).filter((t) => t.length >= 2);
      if (tokens.length) {
        const hits = tokens.filter((t) => title.includes(t)).length;
        best = Math.max(best, Math.round((hits / tokens.length) * 300));
      }
    }
  }
  return best;
}

function browsePriceWhere(query: PropertySearchQuery): Prisma.PropertyWhereInput {
  const where = buildPropertySearchWhere(query);
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.basePrice = {};
    if (query.minPrice !== undefined) where.basePrice.gte = query.minPrice;
    if (query.maxPrice !== undefined) where.basePrice.lte = query.maxPrice;
  }
  return where;
}

function browseOrderBy(sort: PropertySearchQuery['sort']): Prisma.PropertyOrderByWithRelationInput[] {
  switch (sort) {
    case 'price_asc':
      return [{ basePrice: 'asc' }, { id: 'asc' }];
    case 'price_desc':
      return [{ basePrice: 'desc' }, { id: 'asc' }];
    case 'capacity_desc':
      return [{ capacity: 'desc' }, { id: 'asc' }];
    case 'newest':
      return [{ createdAt: 'desc' }, { id: 'asc' }];
    case 'rating_desc':
    case 'distance_asc':
      // Handled via batched id ranking — placeholder only.
      return [{ createdAt: 'desc' }, { id: 'asc' }];
    case 'recommended':
    default:
      return [{ createdAt: 'desc' }, { id: 'asc' }];
  }
}

function slotFinancials(price: number, depositPercent: number | null | undefined) {
  const config = loadPaymentPolicyConfig();
  const snap = calculateBookingFinancialSnapshot({
    bookingTotalAmount: price,
    depositPercent: resolveDepositPercent(
      depositPercent == null ? null : Number(depositPercent),
    ),
    platformCommissionPercent: config.platformCommissionPercent,
    customerServiceFeePercent: config.customerServiceFeePercent,
    currency: config.currency,
  });
  return { depositAmount: snap.depositAmount, remainingAmount: snap.remainingAmount };
}

function compareOrganic(
  a: { property: SearchPropertyRow; match: PropertySearchMatch | null },
  b: { property: SearchPropertyRow; match: PropertySearchMatch | null },
): number {
  const verified =
    verificationRank(b.property.verificationStatus) - verificationRank(a.property.verificationStatus);
  if (verified) return verified;
  const media = Number(b.property.media.length > 0) - Number(a.property.media.length > 0);
  if (media) return media;
  const periods =
    (b.match?.matchingPeriodsCount ?? 0) - (a.match?.matchingPeriodsCount ?? 0);
  if (periods) return periods;
  const created = b.property.createdAt.getTime() - a.property.createdAt.getTime();
  if (created) return created;
  return a.property.id.localeCompare(b.property.id);
}

function sortRows(
  rows: Array<{ property: SearchPropertyRow; match: PropertySearchMatch | null; sortPrice: number }>,
  sort: PropertySearchQuery['sort'],
  _ranks: Map<string, LivePlacementFlags>,
  q?: string,
  ratingStats?: Map<string, { averageRating: number; reviewCount: number }>,
  userCoords?: { lat: number; lng: number } | null,
) {
  const needle = q?.trim() ?? '';
  const copy = [...rows];
  copy.sort((a, b) => {
    if (needle) {
      const rel =
        titleRelevanceScore(needle, b.property.titleAr, b.property.titleEn) -
        titleRelevanceScore(needle, a.property.titleAr, a.property.titleEn);
      if (rel) return rel;
    }
    switch (sort) {
      case 'price_asc':
        return a.sortPrice - b.sortPrice || a.property.id.localeCompare(b.property.id);
      case 'price_desc':
        return b.sortPrice - a.sortPrice || a.property.id.localeCompare(b.property.id);
      case 'capacity_desc':
        return b.property.capacity - a.property.capacity || a.property.id.localeCompare(b.property.id);
      case 'newest':
        return (
          b.property.createdAt.getTime() - a.property.createdAt.getTime() ||
          a.property.id.localeCompare(b.property.id)
        );
      case 'rating_desc': {
        const sa = ratingStats?.get(a.property.id);
        const sb = ratingStats?.get(b.property.id);
        return comparePublishedRatingRank(
          {
            propertyId: a.property.id,
            averageRating: sa?.averageRating ?? 0,
            reviewCount: sa?.reviewCount ?? 0,
          },
          {
            propertyId: b.property.id,
            averageRating: sb?.averageRating ?? 0,
            reviewCount: sb?.reviewCount ?? 0,
          },
        );
      }
      case 'distance_asc': {
        if (!userCoords) return compareOrganic(a, b);
        return compareDistanceRank(
          {
            propertyId: a.property.id,
            distanceKm: distanceKmToApproxProperty(
              userCoords.lat,
              userCoords.lng,
              a.property.latitudeApprox,
              a.property.longitudeApprox,
            ),
          },
          {
            propertyId: b.property.id,
            distanceKm: distanceKmToApproxProperty(
              userCoords.lat,
              userCoords.lng,
              b.property.latitudeApprox,
              b.property.longitudeApprox,
            ),
          },
        );
      }
      case 'recommended':
        // Availability path ranks via rankPropertyIdsByRecommended; fallback organic without paid boost.
        return compareOrganic(a, b);
      default:
        return compareOrganic(a, b);
    }
  });
  return copy;
}

function toCard(
  property: SearchPropertyRow,
  match: PropertySearchMatch | null,
): PublicPropertySummary {
  return {
    ...toPublicPropertySummary(property),
    pricingMode: match ? 'exact_slot' : 'browse_from',
    searchMatch: match,
  };
}

async function applyLiveRatingsToCards(cards: PublicPropertySummary[]): Promise<PublicPropertySummary[]> {
  const stats = await getPublishedReviewStats(cards.map((c) => c.id));
  return cards.map((c) => applyLiveRating(c, stats.get(c.id)));
}

function withPromotionFlags(
  cards: PublicPropertySummary[],
  promoMap: Map<string, { id: string }[]>,
  exact: boolean,
): PublicPropertySummary[] {
  return cards.map((c) => ({
    ...c,
    hasActivePromotion: exact
      ? Boolean(c.searchMatch?.discountAmount && c.searchMatch.discountAmount > 0)
      : (promoMap.get(c.id) ?? []).length > 0,
  }));
}

function assertSearchDate(date: string) {
  const zone = getPlatformTimeZone();
  const today = todayDateIsoInZone(zone);
  if (date < today) {
    throw new AppError(400, 'PAST_DATE', 'Search date cannot be in the past');
  }
}

async function loadHoldings(propertyIds: string[]) {
  if (!propertyIds.length) return [];
  const rows = await prisma.booking.findMany({
    where: {
      propertyId: { in: propertyIds },
      status: { in: SLOT_HOLDING_STATUSES },
    },
    select: {
      propertyId: true,
      availabilitySlotId: true,
      bookingStartAt: true,
      bookingEndAt: true,
      slot: { select: { startAt: true, endAt: true } },
    },
  });
  return rows;
}

function isBookableSlot(
  slot: {
    id: string;
    status: string;
    startAt: Date | null;
    endAt: Date | null;
  },
  occupancy: Array<{ slotId: string; startAt: Date; endAt: Date }>,
): { bookable: boolean; reason: string | null } {
  if (slot.status !== 'available') {
    return { bookable: false, reason: slot.status };
  }
  const interval = slotTimesOrNull(slot);
  if (interval && holdingOverlapsRequested(occupancy, interval, slot.id)) {
    return { bookable: false, reason: 'overlapping_booking' };
  }
  return { bookable: true, reason: null };
}

type SlotRow = {
  id: string;
  propertyId: string;
  date: Date;
  period: AvailabilityPeriod;
  price: Prisma.Decimal;
  status: AvailabilitySlotStatus;
  startAt: Date | null;
  endAt: Date | null;
};

function buildMatch(
  slots: SlotRow[],
  occupancy: Array<{ slotId: string; startAt: Date; endAt: Date }>,
  depositPercent: number | null | undefined,
  requestedPeriod: AvailabilityPeriod | undefined,
): PropertySearchMatch | null {
  const zone = getPlatformTimeZone();
  const bookable = slots.filter((s) => isBookableSlot(s, occupancy).bookable);
  if (!bookable.length) return null;

  bookable.sort((a, b) => decimalToNumber(a.price) - decimalToNumber(b.price));
  const chosen = requestedPeriod
    ? bookable.find((s) => s.period === requestedPeriod) ?? bookable[0]!
    : bookable[0]!;
  const timed = mapTimedFields(chosen);
  const price = decimalToNumber(chosen.price);
  const money = slotFinancials(price, depositPercent);
  const dateIso = formatDateOnlyUtc(chosen.date);

  return {
    matchedDate: dateIso,
    matchedPeriod: requestedPeriod ? chosen.period : bookable.length === 1 ? chosen.period : null,
    matchedSlotId: requestedPeriod || bookable.length === 1 ? chosen.id : null,
    startAt: timed.startAt,
    endAt: timed.endAt,
    startAtLocal: timed.startAtLocal,
    endAtLocal: timed.endAtLocal,
    usesLegacyTiming: timed.usesLegacyTiming,
    slotPrice: price,
    originalSlotPrice: price,
    depositAmount: money.depositAmount,
    remainingAmount: money.remainingAmount,
    matchingPeriodsCount: bookable.length,
    matchingPeriods: bookable.map((s) => {
      const t = mapTimedFields(s);
      return {
        period: s.period,
        price: decimalToNumber(s.price),
        startAtLocal: t.startAtLocal,
        endAtLocal: t.endAtLocal,
        usesLegacyTiming: t.usesLegacyTiming,
        bookable: true,
      };
    }),
    bookable: true,
    availabilityReason: null,
    timeZone: zone,
  };
}

function buildSearchMeta(
  partial: Omit<PropertySearchMeta, 'hasMore'>,
): PropertySearchMeta {
  return {
    ...partial,
    hasMore: propertySearchHasMore(partial),
  };
}

/**
 * Authoritative availability eligibility: same slot / hold / overlap / price rules as search.
 * Returns property IDs only — no public card hydration.
 */
export async function listAvailabilityEligiblePropertyIds(
  query: Pick<
    PropertySearchQuery,
    | 'city'
    | 'area'
    | 'guests'
    | 'date'
    | 'period'
    | 'q'
    | 'propertyType'
    | 'hasPool'
    | 'amenities'
    | 'allowsOvernight'
    | 'allowsEvents'
    | 'verifiedOnly'
    | 'featured'
    | 'minPrice'
    | 'maxPrice'
    | 'verified'
  >,
): Promise<string[]> {
  if (!query.date) return [];
  const matches = await computeAvailabilityMatches({
    ...query,
    date: query.date,
    page: 1,
    pageSize: 1,
    sort: 'newest',
  });
  return Array.from(matches.keys());
}

type AvailabilityLightProperty = {
  id: string;
  titleAr: string;
  titleEn: string | null;
  createdAt: Date;
  verificationStatus: string;
  latitudeApprox: number | null;
  longitudeApprox: number | null;
  capacity: number;
  basePrice: Prisma.Decimal;
  depositPercent: Prisma.Decimal | null;
  mediaCount: number;
};

async function computeAvailabilityMatches(
  query: PropertySearchQuery,
): Promise<Map<string, PropertySearchMatch>> {
  const date = query.date!;
  assertSearchDate(date);
  const dateUtc = parseDateOnlyUtc(date);
  const propertyWhere = buildPropertySearchWhere(query);

  const slots = await prisma.availabilitySlot.findMany({
    where: {
      date: dateUtc,
      status: AvailabilitySlotStatus.available,
      ...(query.period ? { period: query.period } : {}),
      property: propertyWhere,
    },
    select: {
      id: true,
      propertyId: true,
      date: true,
      period: true,
      price: true,
      status: true,
      startAt: true,
      endAt: true,
    },
  });

  const propertyIds = Array.from(new Set(slots.map((s) => s.propertyId)));
  const holdingRows = await loadHoldings(propertyIds);
  const occupancyByProperty = new Map<string, Array<{ slotId: string; startAt: Date; endAt: Date }>>();
  for (const h of holdingRows) {
    const times = occupancyTimes(h);
    if (!times) continue;
    const list = occupancyByProperty.get(h.propertyId) ?? [];
    list.push({ slotId: h.availabilitySlotId, ...times });
    occupancyByProperty.set(h.propertyId, list);
  }

  const byProperty = new Map<string, SlotRow[]>();
  for (const slot of slots) {
    const list = byProperty.get(slot.propertyId) ?? [];
    list.push(slot);
    byProperty.set(slot.propertyId, list);
  }

  const matchById = new Map<string, PropertySearchMatch>();
  for (const [propertyId, propertySlots] of byProperty) {
    const occupancy = occupancyByProperty.get(propertyId) ?? [];
    const match = buildMatch(propertySlots, occupancy, null, query.period);
    if (!match) continue;
    if (query.minPrice !== undefined && (match.slotPrice ?? 0) < query.minPrice) continue;
    if (query.maxPrice !== undefined && (match.slotPrice ?? 0) > query.maxPrice) continue;
    matchById.set(propertyId, match);
  }
  return matchById;
}

async function loadAvailabilityLightProperties(
  propertyIds: string[],
): Promise<AvailabilityLightProperty[]> {
  if (!propertyIds.length) return [];
  const rows = await prisma.property.findMany({
    where: { id: { in: propertyIds } },
    select: {
      id: true,
      titleAr: true,
      titleEn: true,
      createdAt: true,
      verificationStatus: true,
      latitudeApprox: true,
      longitudeApprox: true,
      capacity: true,
      basePrice: true,
      depositPercent: true,
      _count: { select: { media: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    titleAr: r.titleAr,
    titleEn: r.titleEn,
    createdAt: r.createdAt,
    verificationStatus: r.verificationStatus,
    latitudeApprox: r.latitudeApprox,
    longitudeApprox: r.longitudeApprox,
    capacity: r.capacity,
    basePrice: r.basePrice,
    depositPercent: r.depositPercent,
    mediaCount: r._count.media,
  }));
}

function sortAvailabilityLightRows(
  rows: Array<{
    property: AvailabilityLightProperty;
    match: PropertySearchMatch;
    sortPrice: number;
  }>,
  sort: PropertySearchQuery['sort'],
  q?: string,
  ratingStats?: Map<string, { averageRating: number; reviewCount: number }>,
  userCoords?: { lat: number; lng: number } | null,
) {
  const needle = q?.trim() ?? '';
  const copy = [...rows];
  copy.sort((a, b) => {
    if (needle) {
      const rel =
        titleRelevanceScore(needle, b.property.titleAr, b.property.titleEn) -
        titleRelevanceScore(needle, a.property.titleAr, a.property.titleEn);
      if (rel) return rel;
    }
    switch (sort) {
      case 'price_asc':
        return a.sortPrice - b.sortPrice || a.property.id.localeCompare(b.property.id);
      case 'price_desc':
        return b.sortPrice - a.sortPrice || a.property.id.localeCompare(b.property.id);
      case 'capacity_desc':
        return b.property.capacity - a.property.capacity || a.property.id.localeCompare(b.property.id);
      case 'newest':
        return (
          b.property.createdAt.getTime() - a.property.createdAt.getTime() ||
          a.property.id.localeCompare(b.property.id)
        );
      case 'rating_desc': {
        const sa = ratingStats?.get(a.property.id);
        const sb = ratingStats?.get(b.property.id);
        return comparePublishedRatingRank(
          {
            propertyId: a.property.id,
            averageRating: sa?.averageRating ?? 0,
            reviewCount: sa?.reviewCount ?? 0,
          },
          {
            propertyId: b.property.id,
            averageRating: sb?.averageRating ?? 0,
            reviewCount: sb?.reviewCount ?? 0,
          },
        );
      }
      case 'distance_asc': {
        if (!userCoords) {
          return (
            verificationRank(b.property.verificationStatus) -
              verificationRank(a.property.verificationStatus) ||
            b.property.mediaCount - a.property.mediaCount ||
            (b.match.matchingPeriodsCount ?? 0) - (a.match.matchingPeriodsCount ?? 0) ||
            b.property.createdAt.getTime() - a.property.createdAt.getTime() ||
            a.property.id.localeCompare(b.property.id)
          );
        }
        return compareDistanceRank(
          {
            propertyId: a.property.id,
            distanceKm: distanceKmToApproxProperty(
              userCoords.lat,
              userCoords.lng,
              a.property.latitudeApprox,
              a.property.longitudeApprox,
            ),
          },
          {
            propertyId: b.property.id,
            distanceKm: distanceKmToApproxProperty(
              userCoords.lat,
              userCoords.lng,
              b.property.latitudeApprox,
              b.property.longitudeApprox,
            ),
          },
        );
      }
      case 'recommended':
      default:
        return (
          verificationRank(b.property.verificationStatus) -
            verificationRank(a.property.verificationStatus) ||
          Number(b.property.mediaCount > 0) - Number(a.property.mediaCount > 0) ||
          (b.match.matchingPeriodsCount ?? 0) - (a.match.matchingPeriodsCount ?? 0) ||
          b.property.createdAt.getTime() - a.property.createdAt.getTime() ||
          a.property.id.localeCompare(b.property.id)
        );
    }
  });
  return copy;
}

async function searchAvailability(query: PropertySearchQuery): Promise<PropertySearchResponse> {
  const zone = getPlatformTimeZone();
  const matchById = await computeAvailabilityMatches(query);
  const survivingIds = Array.from(matchById.keys());
  const userCoords = parseMarketplaceUserCoords(query.lat, query.lng);

  if (!survivingIds.length) {
    const dateUtc = parseDateOnlyUtc(query.date!);
    const propertyWhere = buildPropertySearchWhere(query);
    const otherPeriods = new Set<AvailabilityPeriod>();
    if (query.period) {
      const altSlots = await prisma.availabilitySlot.findMany({
        where: {
          date: dateUtc,
          status: AvailabilitySlotStatus.available,
          period: { not: query.period },
          property: propertyWhere,
        },
        select: { propertyId: true, period: true, id: true, startAt: true, endAt: true, status: true },
      });
      const altIds = Array.from(new Set(altSlots.map((s) => s.propertyId)));
      const altHoldings = await loadHoldings(altIds);
      const occ = new Map<string, Array<{ slotId: string; startAt: Date; endAt: Date }>>();
      for (const h of altHoldings) {
        const times = occupancyTimes(h);
        if (!times) continue;
        const list = occ.get(h.propertyId) ?? [];
        list.push({ slotId: h.availabilitySlotId, ...times });
        occ.set(h.propertyId, list);
      }
      for (const s of altSlots) {
        if (isBookableSlot(s, occ.get(s.propertyId) ?? []).bookable) {
          otherPeriods.add(s.period);
        }
      }
    }
    return {
      data: [],
      meta: buildSearchMeta({
        mode: 'availability',
        total: 0,
        page: query.page,
        pageSize: query.pageSize,
        timeZone: zone,
        suggestions: {
          otherBookablePeriods: Array.from(otherPeriods),
          tryWithoutDate: true,
        },
      }),
    };
  }

  const lightProperties = await loadAvailabilityLightProperties(survivingIds);
  const promoMap = await loadLivePromotionsByProperty(survivingIds);

  for (const p of lightProperties) {
    const match = matchById.get(p.id);
    if (!match) continue;
    const money = slotFinancials(match.slotPrice ?? 0, p.depositPercent?.toNumber() ?? null);
    match.depositAmount = money.depositAmount;
    match.remainingAmount = money.remainingAmount;

    if (match.slotPrice == null || !match.matchedPeriod) continue;
    const applied = resolveSlotPromotion(
      match.originalSlotPrice ?? match.slotPrice,
      match.matchedPeriod,
      (promoMap.get(p.id) ?? []).map(toPriceInput),
    );
    if (!applied) continue;
    match.originalSlotPrice = applied.originalPrice;
    match.discountAmount = applied.discountAmount;
    match.slotPrice = applied.finalPrice;
    match.promotionTitleAr = applied.titleAr ?? null;
    match.promotionTitleEn = applied.titleEn ?? null;
    const promoMoney = slotFinancials(applied.finalPrice, p.depositPercent?.toNumber() ?? null);
    match.depositAmount = promoMoney.depositAmount;
    match.remainingAmount = promoMoney.remainingAmount;
  }

  const lightRows = lightProperties
    .map((property) => {
      const match = matchById.get(property.id);
      if (!match) return null;
      return {
        property,
        match,
        sortPrice: match.slotPrice ?? decimalToNumber(property.basePrice),
      };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  let orderedIds: string[];
  if (query.sort === 'recommended') {
    const ranked = await rankPropertyIdsByRecommended({
      candidates: lightRows.map((r) => ({
        id: r.property.id,
        titleAr: r.property.titleAr,
        titleEn: r.property.titleEn,
        createdAt: r.property.createdAt,
        verificationStatus: r.property.verificationStatus,
        latitudeApprox: r.property.latitudeApprox,
        longitudeApprox: r.property.longitudeApprox,
        mediaCount: r.property.mediaCount,
      })),
      skip: 0,
      take: lightRows.length,
      q: query.q,
      userLat: userCoords?.lat,
      userLng: userCoords?.lng,
    });
    orderedIds = ranked.ordered.map((o) => o.propertyId);
  } else {
    const ratingForSort =
      query.sort === 'rating_desc'
        ? await getPublishedReviewStats(lightRows.map((r) => r.property.id))
        : undefined;
    orderedIds = sortAvailabilityLightRows(
      lightRows,
      query.sort,
      query.q,
      ratingForSort,
      userCoords,
    ).map((r) => r.property.id);
  }

  const total = orderedIds.length;
  const start = (query.page - 1) * query.pageSize;
  const pageIds = orderedIds.slice(start, start + query.pageSize);

  const pageProperties = pageIds.length
    ? await prisma.property.findMany({
        where: { id: { in: pageIds } },
        include: searchInclude,
      })
    : [];
  const byId = new Map(pageProperties.map((p) => [p.id, p]));
  const orderedPage = pageIds
    .map((id) => byId.get(id))
    .filter((p): p is SearchPropertyRow => Boolean(p));

  const ranks = await loadLivePlacementsByPropertyIds(pageIds);
  const pagePromoMap = new Map(
    pageIds.map((id) => [id, promoMap.get(id) ?? []] as const),
  );

  return {
    data: applyPlacementFlags(
      withPromotionFlags(
        await applyLiveRatingsToCards(
          orderedPage.map((property) => toCard(property, matchById.get(property.id) ?? null)),
        ),
        pagePromoMap,
        true,
      ),
      ranks,
    ),
    meta: buildSearchMeta({
      mode: 'availability',
      total,
      page: query.page,
      pageSize: query.pageSize,
      timeZone: zone,
    }),
  };
}

async function searchBrowse(query: PropertySearchQuery): Promise<PropertySearchResponse> {
  const zone = getPlatformTimeZone();
  const where = browsePriceWhere(query);
  const userCoords = parseMarketplaceUserCoords(query.lat, query.lng);
  const useRecommendedRank = query.sort === 'recommended';
  const useMemoryRank = Boolean(query.q?.trim()) && !useRecommendedRank;
  const useRatingRank = query.sort === 'rating_desc' && !useMemoryRank;
  const useDistanceRank = query.sort === 'distance_asc' && !useMemoryRank && Boolean(userCoords);

  let properties: SearchPropertyRow[];
  let total: number;

  if (useRecommendedRank) {
    const page = await listPropertyIdsOrderedByRecommended({
      propertyWhere: where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      q: query.q,
      userLat: userCoords?.lat,
      userLng: userCoords?.lng,
    });
    total = page.total;
    properties = page.ids.length
      ? await prisma.property.findMany({
          where: { id: { in: page.ids } },
          include: searchInclude,
        })
      : [];
    const byId = new Map(properties.map((p) => [p.id, p]));
    properties = page.ids.map((id) => byId.get(id)).filter((p): p is SearchPropertyRow => Boolean(p));
  } else if (useRatingRank) {
    const page = await listPropertyIdsOrderedByPublishedRating({
      propertyWhere: where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    total = page.total;
    properties = page.ids.length
      ? await prisma.property.findMany({
          where: { id: { in: page.ids } },
          include: searchInclude,
        })
      : [];
    const byId = new Map(properties.map((p) => [p.id, p]));
    properties = page.ids.map((id) => byId.get(id)).filter((p): p is SearchPropertyRow => Boolean(p));
  } else if (useDistanceRank && userCoords) {
    const page = await listPropertyIdsOrderedByDistance({
      propertyWhere: where,
      lat: userCoords.lat,
      lng: userCoords.lng,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    total = page.total;
    properties = page.ids.length
      ? await prisma.property.findMany({
          where: { id: { in: page.ids } },
          include: searchInclude,
        })
      : [];
    const byId = new Map(properties.map((p) => [p.id, p]));
    properties = page.ids.map((id) => byId.get(id)).filter((p): p is SearchPropertyRow => Boolean(p));
  } else {
    total = await prisma.property.count({ where });
    properties = await prisma.property.findMany({
      where,
      include: searchInclude,
      ...(useMemoryRank
        ? {}
        : {
            orderBy: browseOrderBy(query.sort),
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
    });
  }

  const promoMap = await loadLivePromotionsByProperty(properties.map((p) => p.id));
  const ranks = await loadLivePlacementsByPropertyIds(properties.map((p) => p.id));
  const rows = properties.map((property) => ({
    property,
    match: null,
    sortPrice: decimalToNumber(property.basePrice),
  }));

  let pageRows: Array<{
    property: SearchPropertyRow;
    match: PropertySearchMatch | null;
    sortPrice: number;
  }> = rows;
  if (useMemoryRank) {
    const ratingForSort =
      query.sort === 'rating_desc'
        ? await getPublishedReviewStats(properties.map((p) => p.id))
        : undefined;
    const sorted = sortRows(rows, query.sort, ranks, query.q, ratingForSort, userCoords);
    pageRows = sorted.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);
  }

  const cards = applyPlacementFlags(
    withPromotionFlags(
      await applyLiveRatingsToCards(pageRows.map((p) => toCard(p.property, null))),
      promoMap,
      false,
    ),
    ranks,
  );

  return {
    data: cards,
    meta: buildSearchMeta({
      mode: 'browse',
      total,
      page: query.page,
      pageSize: query.pageSize,
      timeZone: zone,
    }),
  };
}

export async function searchPublishedProperties(
  query: PropertySearchQuery,
): Promise<PropertySearchResponse> {
  if (query.date) return searchAvailability(query);
  return searchBrowse(query);
}

const HOMEPAGE_CATALOG_LIMIT = Math.max(
  1,
  Number.parseInt(process.env.HOMEPAGE_CATALOG_LIMIT ?? '150', 10) || 150,
);

/** One batched catalog for organic homepage rails (Recently Added). */
export async function loadPublicPropertyCatalog(
  query: Pick<PropertySearchQuery, 'city' | 'area' | 'guests' | 'date' | 'period'>,
): Promise<PublicPropertySummary[]> {
  const full: PropertySearchQuery = {
    city: query.city,
    area: query.area,
    guests: query.guests,
    date: query.date,
    period: query.period,
    page: 1,
    pageSize: 48,
    sort: 'recommended',
  };
  if (query.date) {
    const res = await searchPublishedProperties(full);
    return res.data;
  }
  const where = browsePriceWhere(full);
  const properties = await prisma.property.findMany({
    where,
    include: searchInclude,
    take: HOMEPAGE_CATALOG_LIMIT,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  });
  return hydratePublicCards(properties);
}

/** Batch-load public cards for known property ids (commercial rails). */
export async function loadPublicPropertyCardsByIds(
  propertyIds: string[],
  query: Pick<PropertySearchQuery, 'city' | 'area' | 'guests'> = {},
): Promise<PublicPropertySummary[]> {
  if (!propertyIds.length) return [];
  const unique = [...new Set(propertyIds)];
  const where: Prisma.PropertyWhereInput = {
    id: { in: unique },
    ...browsePriceWhere({
      city: query.city,
      area: query.area,
      guests: query.guests,
      page: 1,
      pageSize: 48,
      sort: 'recommended',
    }),
  };
  const properties = await prisma.property.findMany({
    where,
    include: searchInclude,
  });
  const cards = await hydratePublicCards(properties);
  const byId = new Map(cards.map((c) => [c.id, c]));
  return unique.map((id) => byId.get(id)).filter((c): c is PublicPropertySummary => Boolean(c));
}

async function hydratePublicCards(
  properties: SearchPropertyRow[],
): Promise<PublicPropertySummary[]> {
  const promoMap = await loadLivePromotionsByProperty(properties.map((p) => p.id));
  const ranks = await loadLivePlacementsByPropertyIds(properties.map((p) => p.id));
  return applyPlacementFlags(
    withPromotionFlags(
      await applyLiveRatingsToCards(properties.map((p) => toCard(p, null))),
      promoMap,
      false,
    ),
    ranks,
  );
}

/** Published property counts by city for homepage destination badges. */
export async function countPublishedPropertiesByCity(
  query: Pick<PropertySearchQuery, 'city' | 'area' | 'guests'>,
): Promise<Record<string, number>> {
  const where = browsePriceWhere({
    city: query.city,
    area: query.area,
    guests: query.guests,
    page: 1,
    pageSize: 48,
    sort: 'recommended',
  });
  const rows = await prisma.property.groupBy({
    by: ['city'],
    where,
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.city] = row._count._all;
  }
  return counts;
}

/** Property filter fragment for commercial rails (city/area/guests only). */
export function discoveryPropertyFilter(
  query: Pick<PropertySearchQuery, 'city' | 'area' | 'guests'>,
): Prisma.PropertyWhereInput {
  const where = browsePriceWhere({
    city: query.city,
    area: query.area,
    guests: query.guests,
    page: 1,
    pageSize: 48,
    sort: 'recommended',
  });
  const { status: _status, owner: _owner, ...rest } = where;
  return rest;
}
