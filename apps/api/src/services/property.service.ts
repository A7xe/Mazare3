import { prisma, PropertyStatus } from '@mazare3/db';
import type { PropertySearchQuery } from '@mazare3/shared';
import { toPublicPropertyDetail, applyLiveRating } from '../mappers/public-property.mapper.js';
import { searchPublishedProperties, loadPublicPropertyCardsByIds } from './property-search.service.js';
import { getPublishedReviewStats, listPublishedReviewsForProperty } from './review.service.js';
import { loadLivePromotionsByProperty, buildActivePromotionSummary } from './promotion.service.js';
import { applyPlacementFlags, loadLivePlacementsByPropertyIds } from './placement.service.js';

const publishedInclude = {
  media: {
    where: { removedFromListingAt: null },
    orderBy: { sortOrder: 'asc' as const },
  },
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
  // Phase 3C.4D.4B — public canBook from central evaluator (generic reason only)
  const { evaluatePropertyBookability, customerUnavailableBookingMessage } = await import(
    './property-bookability.service.js'
  );
  const bookability = await evaluatePropertyBookability(row.id, 'public_display');
  const bookable = bookability.canBook;
  const offers = promoMap.get(row.id) ?? [];
  const summary = buildActivePromotionSummary(detail.basePrice, offers);
  return {
    ...detail,
    reviews,
    hasActivePromotion: offers.length > 0,
    activePromotionSummary: summary,
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
    canBook: bookable,
    bookingDisabled: !bookable,
    bookingDisabledReason: bookable ? null : customerUnavailableBookingMessage('en'),
    poolSafetyDisclosure: await (async () => {
      const { getPublicPoolSafetyDisclosure } = await import(
        './property-pool-safety.service.js'
      );
      return getPublicPoolSafetyDisclosure(row.id);
    })(),
  };
}

export async function listSimilarProperties(slug: string, city: string, limit = 2) {
  const rows = await prisma.property.findMany({
    where: {
      status: PropertyStatus.published,
      slug: { not: slug },
      city,
    },
    select: { id: true },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  // Batched public cards include promotion summaries.
  return loadPublicPropertyCardsByIds(rows.map((r) => r.id));
}
