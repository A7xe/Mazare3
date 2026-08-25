import { prisma, BookingStatus, Prisma } from '@mazare3/db';
import {
  MOST_BOOKED_QUALIFYING_STATUSES,
  MOST_BOOKED_WINDOW_DAYS,
  compareBookingPopularityRank,
  compareDistanceRank,
  distanceKmToApproxProperty,
  parseMarketplaceUserCoords,
} from '@mazare3/shared';
import { getPublishedReviewStats } from './review.service.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** ~165 km box — enough to cover Jordan-scale marketplace proximity in one batch. */
const NEARBY_BOX_DEGREES = 1.5;

function mostBookedSince(now = new Date()): Date {
  return new Date(now.getTime() - MOST_BOOKED_WINDOW_DAYS * MS_PER_DAY);
}

/** Batch 90-day confirmed booking counts for candidate property ids (no N+1). */
export async function getConfirmedBookingCounts90d(
  propertyIds: string[],
  now = new Date(),
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!propertyIds.length) return map;
  const grouped = await prisma.booking.groupBy({
    by: ['propertyId'],
    where: {
      propertyId: { in: propertyIds },
      status: { in: [...MOST_BOOKED_QUALIFYING_STATUSES] as BookingStatus[] },
      createdAt: { gte: mostBookedSince(now) },
    },
    _count: { _all: true },
  });
  for (const row of grouped) {
    map.set(row.propertyId, row._count._all);
  }
  return map;
}

/**
 * Real "Most Booked" ids: confirmed bookings in the last 90 days only.
 * Excludes pending*, cancelled, expired (and any non-confirmed status).
 */
export async function listMostBookedPublicPropertyIds(params: {
  propertyWhere?: Prisma.PropertyWhereInput;
  take?: number;
  eligiblePropertyIds?: string[] | null;
  now?: Date;
  /** Prefer skipping these ids when enough other inventory exists (rail diversification). */
  preferExcludeIds?: string[];
}): Promise<
  Array<{
    propertyId: string;
    bookingCount: number;
    averageRating: number;
    reviewCount: number;
  }>
> {
  const take = params.take ?? 16;
  const eligible = params.eligiblePropertyIds;
  if (eligible && eligible.length === 0) return [];

  const grouped = await prisma.booking.groupBy({
    by: ['propertyId'],
    where: {
      status: { in: [...MOST_BOOKED_QUALIFYING_STATUSES] as BookingStatus[] },
      createdAt: { gte: mostBookedSince(params.now) },
      ...(eligible ? { propertyId: { in: eligible } } : {}),
      property: {
        status: 'published',
        owner: { status: 'approved' },
        ...(params.propertyWhere ?? {}),
      },
    },
    _count: { _all: true },
  });

  if (!grouped.length) return [];

  const stats = await getPublishedReviewStats(grouped.map((g) => g.propertyId));
  const ranked = grouped
    .map((row) => {
      const rating = stats.get(row.propertyId);
      return {
        propertyId: row.propertyId,
        bookingCount: row._count._all,
        averageRating: rating?.averageRating ?? 0,
        reviewCount: rating?.reviewCount ?? 0,
      };
    })
    .filter((row) => row.bookingCount > 0)
    .sort(compareBookingPopularityRank);

  const exclude = new Set(params.preferExcludeIds ?? []);
  if (!exclude.size) return ranked.slice(0, take);

  const preferred = ranked.filter((r) => !exclude.has(r.propertyId));
  if (preferred.length >= take) return preferred.slice(0, take);
  // Not enough unique inventory — allow overlap rather than dishonest empty rail.
  const preferredIds = new Set(preferred.map((r) => r.propertyId));
  const fillers = ranked.filter((r) => !preferredIds.has(r.propertyId));
  return [...preferred, ...fillers].slice(0, take);
}

/**
 * Nearest public properties using privacy-safe approximate coordinates only.
 * Loads id+approx coords in one batch (bounding box), then Haversine-sorts.
 */
export async function listNearbyPublicPropertyIds(params: {
  lat: number;
  lng: number;
  propertyWhere?: Prisma.PropertyWhereInput;
  take?: number;
  eligiblePropertyIds?: string[] | null;
}): Promise<Array<{ propertyId: string; distanceKm: number }>> {
  const take = params.take ?? 16;
  const coords = parseMarketplaceUserCoords(params.lat, params.lng);
  if (!coords) return [];

  const eligible = params.eligiblePropertyIds;
  if (eligible && eligible.length === 0) return [];

  const rows = await prisma.property.findMany({
    where: {
      status: 'published',
      owner: { status: 'approved' },
      latitudeApprox: {
        not: null,
        gte: coords.lat - NEARBY_BOX_DEGREES,
        lte: coords.lat + NEARBY_BOX_DEGREES,
      },
      longitudeApprox: {
        not: null,
        gte: coords.lng - NEARBY_BOX_DEGREES,
        lte: coords.lng + NEARBY_BOX_DEGREES,
      },
      ...(eligible ? { id: { in: eligible } } : {}),
      ...(params.propertyWhere ?? {}),
    },
    select: { id: true, latitudeApprox: true, longitudeApprox: true },
  });

  return rows
    .map((row) => ({
      propertyId: row.id,
      distanceKm: distanceKmToApproxProperty(
        coords.lat,
        coords.lng,
        row.latitudeApprox,
        row.longitudeApprox,
      ),
    }))
    .filter((row): row is { propertyId: string; distanceKm: number } => row.distanceKm != null)
    .sort(compareDistanceRank)
    .slice(0, take);
}

/**
 * Page of property ids ordered by distance to coarse user location.
 * Lightweight id+approx select only — not full card hydration.
 */
export async function listPropertyIdsOrderedByDistance(params: {
  propertyWhere: Prisma.PropertyWhereInput;
  lat: number;
  lng: number;
  skip: number;
  take: number;
}): Promise<{ ids: string[]; total: number }> {
  const coords = parseMarketplaceUserCoords(params.lat, params.lng);
  const total = await prisma.property.count({ where: params.propertyWhere });
  if (!coords || total === 0 || params.take <= 0) {
    if (!coords) {
      const fallback = await prisma.property.findMany({
        where: params.propertyWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: params.skip,
        take: params.take,
        select: { id: true },
      });
      return { ids: fallback.map((p) => p.id), total };
    }
    return { ids: [], total };
  }

  const rows = await prisma.property.findMany({
    where: params.propertyWhere,
    select: { id: true, latitudeApprox: true, longitudeApprox: true },
  });

  const ordered = rows
    .map((row) => ({
      propertyId: row.id,
      distanceKm: distanceKmToApproxProperty(
        coords.lat,
        coords.lng,
        row.latitudeApprox,
        row.longitudeApprox,
      ),
    }))
    .sort(compareDistanceRank)
    .map((r) => r.propertyId);

  return {
    ids: ordered.slice(params.skip, params.skip + params.take),
    total,
  };
}
