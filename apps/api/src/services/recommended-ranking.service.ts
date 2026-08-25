import { prisma, Prisma } from '@mazare3/db';
import {
  calculateRecommendedScore,
  compareRecommendedRank,
  distanceForRecommended,
  percentile95,
  propertyTitleMatchScore,
  verificationStatusRank,
  type RecommendedRankCandidate,
} from '@mazare3/shared';
import { getPublishedReviewStats } from './review.service.js';
import { getConfirmedBookingCounts90d } from './property-popularity.service.js';

export type RecommendedCandidateRow = {
  id: string;
  titleAr: string;
  titleEn: string | null;
  createdAt: Date;
  verificationStatus: string;
  latitudeApprox: number | null;
  longitudeApprox: number | null;
  mediaCount: number;
};

/**
 * Rank eligible lightweight candidates with organic recommended scoring.
 * Paid placement is intentionally ignored.
 */
export async function rankPropertyIdsByRecommended(params: {
  candidates: RecommendedCandidateRow[];
  skip: number;
  take: number;
  q?: string;
  userLat?: number | null;
  userLng?: number | null;
  now?: Date;
}): Promise<{ ids: string[]; total: number; ordered: RecommendedRankCandidate[] }> {
  const total = params.candidates.length;
  if (!total || params.take <= 0) return { ids: [], total, ordered: [] };

  const ids = params.candidates.map((c) => c.id);
  const now = params.now ?? new Date();
  const hasUserLocation =
    params.userLat != null &&
    params.userLng != null &&
    Number.isFinite(params.userLat) &&
    Number.isFinite(params.userLng);

  const [bookingCounts, reviewStats] = await Promise.all([
    getConfirmedBookingCounts90d(ids, now),
    getPublishedReviewStats(ids),
  ]);

  const bookingValues = ids.map((id) => bookingCounts.get(id) ?? 0);
  const bookingReferenceCount = percentile95(bookingValues);

  let catalogSum = 0;
  let catalogN = 0;
  for (const stats of reviewStats.values()) {
    if (stats.reviewCount > 0) {
      catalogSum += stats.averageRating;
      catalogN += 1;
    }
  }
  const catalogAverageRating = catalogN > 0 ? catalogSum / catalogN : 4;

  const q = params.q?.trim() ?? '';
  const ranked: RecommendedRankCandidate[] = params.candidates.map((c) => {
    const reviews = reviewStats.get(c.id);
    const bookingCount90d = bookingCounts.get(c.id) ?? 0;
    const distanceKm = hasUserLocation
      ? distanceForRecommended(
          params.userLat,
          params.userLng,
          c.latitudeApprox,
          c.longitudeApprox,
        )
      : null;
    const breakdown = calculateRecommendedScore({
      propertyId: c.id,
      bookingCount90d,
      averageRating: reviews?.averageRating ?? 0,
      reviewCount: reviews?.reviewCount ?? 0,
      catalogAverageRating,
      bookingReferenceCount,
      createdAt: c.createdAt,
      quality: {
        verificationRank: verificationStatusRank(c.verificationStatus),
        mediaCount: c.mediaCount,
      },
      distanceKm,
      hasUserLocation,
      now,
    });
    return {
      propertyId: c.id,
      score: breakdown.total,
      reviewCount: reviews?.reviewCount ?? 0,
      bookingCount90d,
      titleRelevance: q ? propertyTitleMatchScore(q, c.titleAr, c.titleEn) : 0,
    };
  });

  ranked.sort(compareRecommendedRank);
  const pageIds = ranked.slice(params.skip, params.skip + params.take).map((r) => r.propertyId);
  return { ids: pageIds, total, ordered: ranked };
}

/** Lightweight eligible candidates for browse recommended ranking (no full media hydration). */
export async function loadRecommendedCandidates(
  propertyWhere: Prisma.PropertyWhereInput,
): Promise<RecommendedCandidateRow[]> {
  const rows = await prisma.property.findMany({
    where: propertyWhere,
    select: {
      id: true,
      titleAr: true,
      titleEn: true,
      createdAt: true,
      verificationStatus: true,
      latitudeApprox: true,
      longitudeApprox: true,
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
    mediaCount: r._count.media,
  }));
}

export async function listPropertyIdsOrderedByRecommended(params: {
  propertyWhere: Prisma.PropertyWhereInput;
  skip: number;
  take: number;
  q?: string;
  userLat?: number | null;
  userLng?: number | null;
  now?: Date;
}): Promise<{ ids: string[]; total: number }> {
  const candidates = await loadRecommendedCandidates(params.propertyWhere);
  const ranked = await rankPropertyIdsByRecommended({
    candidates,
    skip: params.skip,
    take: params.take,
    q: params.q,
    userLat: params.userLat,
    userLng: params.userLng,
    now: params.now,
  });
  return { ids: ranked.ids, total: ranked.total };
}
