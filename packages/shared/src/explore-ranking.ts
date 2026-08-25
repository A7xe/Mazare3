import { isValidLatitude, isValidLongitude } from './location-privacy';

/** Rolling window for Explore "Most Booked" popularity. */
export const MOST_BOOKED_WINDOW_DAYS = 90;

/**
 * Booking statuses that count as genuine reservations for "Most Booked".
 * Mazare3 has no separate completed status — `confirmed` is the paid/accepted reservation.
 * Explicitly excluded: pending*, cancelled, expired.
 */
export const MOST_BOOKED_QUALIFYING_STATUSES = ['confirmed'] as const;

export type RatingRankRow = {
  propertyId: string;
  averageRating: number;
  reviewCount: number;
};

export type BookingPopularityRow = {
  propertyId: string;
  bookingCount: number;
  averageRating: number;
  reviewCount: number;
};

export type DistanceRankRow = {
  propertyId: string;
  distanceKm: number | null;
};

/** Earth mean radius (km) for marketplace proximity. */
export const EARTH_RADIUS_KM = 6371;

/** Haversine great-circle distance in kilometers. */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Coarse user location for marketplace proximity URLs (~110m at equator).
 * Never use higher precision than needed; never persist server-side.
 */
export const MARKETPLACE_USER_COORD_DECIMALS = 3;

export function roundMarketplaceUserCoord(value: number): number {
  const f = 10 ** MARKETPLACE_USER_COORD_DECIMALS;
  return Math.round(value * f) / f;
}

export function parseMarketplaceUserCoords(
  lat: unknown,
  lng: unknown,
): { lat: number; lng: number } | null {
  const latitude = typeof lat === 'number' ? lat : Number(lat);
  const longitude = typeof lng === 'number' ? lng : Number(lng);
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;
  return {
    lat: roundMarketplaceUserCoord(latitude),
    lng: roundMarketplaceUserCoord(longitude),
  };
}

/** Published rating DESC → review count DESC → stable id ASC. Zero reviews sort last. */
export function comparePublishedRatingRank(a: RatingRankRow, b: RatingRankRow): number {
  const aHas = a.reviewCount > 0;
  const bHas = b.reviewCount > 0;
  if (aHas !== bHas) return aHas ? -1 : 1;
  if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
  if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
  return a.propertyId.localeCompare(b.propertyId);
}

/**
 * Booking count DESC → published rating DESC → review count DESC → id ASC.
 * Zero booking rows should be omitted by the caller before ranking.
 */
export function compareBookingPopularityRank(
  a: BookingPopularityRow,
  b: BookingPopularityRow,
): number {
  if (b.bookingCount !== a.bookingCount) return b.bookingCount - a.bookingCount;
  if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
  if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
  return a.propertyId.localeCompare(b.propertyId);
}

/** Closer first; missing distance (no public approx coords) ranks last; then id. */
export function compareDistanceRank(a: DistanceRankRow, b: DistanceRankRow): number {
  const aHas = a.distanceKm != null && Number.isFinite(a.distanceKm);
  const bHas = b.distanceKm != null && Number.isFinite(b.distanceKm);
  if (aHas !== bHas) return aHas ? -1 : 1;
  if (aHas && bHas && a.distanceKm !== b.distanceKm) {
    return (a.distanceKm as number) - (b.distanceKm as number);
  }
  return a.propertyId.localeCompare(b.propertyId);
}

export function distanceKmToApproxProperty(
  userLat: number,
  userLng: number,
  latitudeApprox: number | null | undefined,
  longitudeApprox: number | null | undefined,
): number | null {
  if (
    !isValidLatitude(userLat) ||
    !isValidLongitude(userLng) ||
    latitudeApprox == null ||
    longitudeApprox == null ||
    !isValidLatitude(latitudeApprox) ||
    !isValidLongitude(longitudeApprox)
  ) {
    return null;
  }
  return haversineDistanceKm(userLat, userLng, latitudeApprox, longitudeApprox);
}
