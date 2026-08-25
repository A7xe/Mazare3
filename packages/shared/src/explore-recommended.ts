import { distanceKmToApproxProperty } from './explore-ranking';

/** Weights without usable user location. */
export const RECOMMENDED_WEIGHTS_NO_LOCATION = {
  booking: 0.35,
  rating: 0.3,
  quality: 0.2,
  exploration: 0.15,
  proximity: 0,
} as const;

/** Weights with privacy-safe user location context. */
export const RECOMMENDED_WEIGHTS_WITH_LOCATION = {
  booking: 0.3,
  rating: 0.25,
  quality: 0.15,
  exploration: 0.1,
  proximity: 0.2,
} as const;

export const BAYESIAN_M = 5;
export const EXPLORATION_FULL_DAYS = 7;
export const EXPLORATION_DECAY_END_DAYS = 30;
export const PROXIMITY_SCALE_KM = 25;
export const QUALITY_MEDIA_CAP = 5;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type RecommendedListingQualityInput = {
  /** 0 unverified, 1 platform_reviewed, 2 platform_verified */
  verificationRank: number;
  mediaCount: number;
};

export type RecommendedScoreInput = {
  propertyId: string;
  bookingCount90d: number;
  averageRating: number;
  reviewCount: number;
  catalogAverageRating: number;
  bookingReferenceCount: number;
  createdAt: Date | string;
  quality: RecommendedListingQualityInput;
  /** Distance km using approx coords; null when unknown / no user location. */
  distanceKm: number | null;
  hasUserLocation: boolean;
  now?: Date;
};

export type RecommendedScoreBreakdown = {
  booking: number;
  rating: number;
  quality: number;
  exploration: number;
  proximity: number;
  total: number;
};

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

/** Robust upper reference for log booking normalization (p95). */
export function percentile95(values: number[]): number {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.95 * sorted.length) - 1));
  return Math.max(1, sorted[idx] ?? 1);
}

/**
 * Diminishing-return booking popularity.
 * bookingScore = log1p(count) / log1p(reference), clamped 0..1
 */
export function scoreBookingPopularity(count: number, referenceCount: number): number {
  const c = Math.max(0, count);
  const ref = Math.max(1, referenceCount);
  return clamp01(Math.log1p(c) / Math.log1p(ref));
}

/**
 * Bayesian weighted rating on a 1–5 scale, normalized to 0..1.
 * weighted = (v/(v+m))*R + (m/(v+m))*C
 * Zero-review properties use the catalog prior C (not a catastrophic zero).
 */
export function scorePublishedRating(
  averageRating: number,
  reviewCount: number,
  catalogAverageRating: number,
  m: number = BAYESIAN_M,
): number {
  const C = Number.isFinite(catalogAverageRating) && catalogAverageRating > 0 ? catalogAverageRating : 4;
  const v = Math.max(0, reviewCount);
  const R = v > 0 && Number.isFinite(averageRating) ? averageRating : C;
  const weighted = (v / (v + m)) * R + (m / (v + m)) * C;
  return clamp01((weighted - 1) / 4);
}

/**
 * Truthful readiness only:
 * - verificationRank / 2 (0..1)
 * - has cover media
 * - media count up to QUALITY_MEDIA_CAP
 * Paid placement is intentionally absent.
 */
export function scoreListingQuality(input: RecommendedListingQualityInput): number {
  const verificationNorm = clamp01(input.verificationRank / 2);
  const hasCover = input.mediaCount > 0 ? 1 : 0;
  const mediaNorm = clamp01(input.mediaCount / QUALITY_MEDIA_CAP);
  return clamp01(0.5 * verificationNorm + 0.3 * hasCover + 0.2 * mediaNorm);
}

/**
 * createdAt exploration curve (not updatedAt):
 * 0–7d → 1.0; 8–30d linear decay to 0; >30d → 0
 */
export function scoreNewListingExploration(createdAt: Date | string, now: Date = new Date()): number {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  if (!(created instanceof Date) || Number.isNaN(created.getTime())) return 0;
  const ageDays = (now.getTime() - created.getTime()) / MS_PER_DAY;
  if (ageDays < 0) return 1;
  if (ageDays <= EXPLORATION_FULL_DAYS) return 1;
  if (ageDays >= EXPLORATION_DECAY_END_DAYS) return 0;
  const span = EXPLORATION_DECAY_END_DAYS - EXPLORATION_FULL_DAYS;
  return clamp01(1 - (ageDays - EXPLORATION_FULL_DAYS) / span);
}

/** Mild proximity: 1 / (1 + distanceKm / 25). Missing coords → 0. */
export function scoreProximity(distanceKm: number | null | undefined): number {
  if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm < 0) return 0;
  return clamp01(1 / (1 + distanceKm / PROXIMITY_SCALE_KM));
}

export function verificationStatusRank(status: string): number {
  if (status === 'platform_verified') return 2;
  if (status === 'platform_reviewed') return 1;
  return 0;
}

export function calculateRecommendedScore(input: RecommendedScoreInput): RecommendedScoreBreakdown {
  const now = input.now ?? new Date();
  const booking = scoreBookingPopularity(input.bookingCount90d, input.bookingReferenceCount);
  const rating = scorePublishedRating(
    input.averageRating,
    input.reviewCount,
    input.catalogAverageRating,
  );
  const quality = scoreListingQuality(input.quality);
  const exploration = scoreNewListingExploration(input.createdAt, now);
  const proximity = input.hasUserLocation ? scoreProximity(input.distanceKm) : 0;
  const w = input.hasUserLocation
    ? RECOMMENDED_WEIGHTS_WITH_LOCATION
    : RECOMMENDED_WEIGHTS_NO_LOCATION;
  const total = clamp01(
    w.booking * booking +
      w.rating * rating +
      w.quality * quality +
      w.exploration * exploration +
      w.proximity * proximity,
  );
  return { booking, rating, quality, exploration, proximity, total };
}

export type RecommendedRankCandidate = {
  propertyId: string;
  score: number;
  reviewCount: number;
  bookingCount90d: number;
  /** Title relevance from q; 0 when no q. Higher = better match. */
  titleRelevance: number;
};

/**
 * Deterministic recommended ordering:
 * 1) title relevance band DESC (when q present)
 * 2) recommendation score DESC
 * 3) review count DESC
 * 4) 90d booking count DESC
 * 5) property id ASC
 */
export function compareRecommendedRank(a: RecommendedRankCandidate, b: RecommendedRankCandidate): number {
  if (b.titleRelevance !== a.titleRelevance) return b.titleRelevance - a.titleRelevance;
  if (b.score !== a.score) return b.score - a.score;
  if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
  if (b.bookingCount90d !== a.bookingCount90d) return b.bookingCount90d - a.bookingCount90d;
  return a.propertyId.localeCompare(b.propertyId);
}

export function distanceForRecommended(
  userLat: number | null | undefined,
  userLng: number | null | undefined,
  latitudeApprox: number | null | undefined,
  longitudeApprox: number | null | undefined,
): number | null {
  if (userLat == null || userLng == null) return null;
  return distanceKmToApproxProperty(userLat, userLng, latitudeApprox, longitudeApprox);
}
