import { prisma, PropertyStatus, OwnerStatus } from '@mazare3/db';
import type { PropertySearchQuery } from '@mazare3/shared';
import { toPublicPropertyDetail, toPublicPropertySummary, applyLiveRating } from '../mappers/public-property.mapper.js';
import { searchPublishedProperties } from './property-search.service.js';
import { getPublishedReviewStats, listPublishedReviewsForProperty } from './review.service.js';
import { loadLivePromotionsByProperty } from './promotion.service.js';
import { applyPlacementFlags, loadLivePlacementsByPropertyIds } from './placement.service.js';

const publishedInclude = {
  media: { orderBy: { sortOrder: 'asc' as const } },
  amenities: { include: { amenity: true } },
  rules: { orderBy: { sortOrder: 'asc' as const } },
} as const;

export async function listPublishedProperties(query: PropertySearchQuery) {
  return searchPublishedProperties(query);
}

export async function getPublishedPropertyBySlug(slug: string) {
  const row = await prisma.property.findFirst({
    where: { slug, status: PropertyStatus.published },
    include: { ...publishedInclude, owner: { select: { status: true } } },
  });

  if (!row) return null;
  const [stats, reviews, promoMap, placeMap] = await Promise.all([
    getPublishedReviewStats([row.id]),
    listPublishedReviewsForProperty(row.id),
    loadLivePromotionsByProperty([row.id]),
    loadLivePlacementsByPropertyIds([row.id]),
  ]);
  const detail = applyPlacementFlags(
    [applyLiveRating(toPublicPropertyDetail(row), stats.get(row.id))],
    placeMap,
  )[0]!;
  const bookable = row.owner.status === OwnerStatus.approved;
  const offers = promoMap.get(row.id) ?? [];
  return {
    ...detail,
    reviews,
    hasActivePromotion: offers.length > 0,
    activeOffers: offers.map((o) => ({
      id: o.id,
      titleAr: o.titleAr,
      titleEn: o.titleEn,
      discountType: o.discountType,
      discountValue: o.discountValue,
      period: o.period,
      startsAt: o.startsAt,
      endsAt: o.endsAt,
    })),
    bookingDisabled: !bookable,
    bookingDisabledReason: bookable
      ? null
      : 'This property is not accepting new bookings',
  };
}

export async function listSimilarProperties(slug: string, city: string, limit = 2) {
  const rows = await prisma.property.findMany({
    where: {
      status: PropertyStatus.published,
      slug: { not: slug },
      city,
    },
    include: publishedInclude,
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  const stats = await getPublishedReviewStats(rows.map((r) => r.id));
  const ids = rows.map((r) => r.id);
  const [promoMap, placeMap] = await Promise.all([
    loadLivePromotionsByProperty(ids),
    loadLivePlacementsByPropertyIds(ids),
  ]);
  return applyPlacementFlags(
    rows.map((r) => ({
      ...applyLiveRating(toPublicPropertySummary(r), stats.get(r.id)),
      hasActivePromotion: (promoMap.get(r.id) ?? []).length > 0,
    })),
    placeMap,
  );
}
