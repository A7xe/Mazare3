import type { PublicPropertyDetail, PublicPropertySummary, PropertyType, VerificationStatus } from '@mazare3/shared';
import { toPublicLocation } from '@mazare3/shared';
import { resolvePropertyMediaPublicUrl } from '../lib/property-media-public-url.js';

type MediaRow = { url: string; storageKey?: string | null; altAr: string | null; altEn: string | null };
type AmenityRow = { amenity: { key: string } };
type RuleRow = { titleAr: string; titleEn: string | null };

export type PublicPropertyRow = {
  id: string;
  slug: string;
  type: PropertyType;
  titleAr: string;
  titleEn: string | null;
  city: string;
  area: string;
  approximateAddress: string;
  latitudeApprox?: number | null;
  longitudeApprox?: number | null;
  capacity: number;
  ratingAvg: { toNumber(): number } | number | null;
  reviewCount: number;
  basePrice: { toNumber(): number } | number;
  currency: string;
  verificationStatus: VerificationStatus;
  hasPlatformDeal: boolean;
  allowsFamilies: boolean;
  allowsYouth: boolean;
  poolsCount: number;
  hasIndoorPool: boolean;
  hasHeatedPool: boolean;
  hasFootballField: boolean;
  allowsOvernight: boolean;
  allowsEvents: boolean;
  instantBookingEnabled: boolean;
  createdAt: Date;
  media: MediaRow[];
  amenities: AmenityRow[];
  descriptionAr?: string;
  descriptionEn?: string | null;
  bedrooms?: number;
  bathrooms?: number;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  rules?: RuleRow[];
};

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

function mapBase(property: PublicPropertyRow): PublicPropertySummary {
  const firstImage = property.media[0];
  const location = toPublicLocation(property);
  return {
    id: property.id,
    slug: property.slug,
    type: property.type,
    titleAr: property.titleAr,
    titleEn: property.titleEn ?? property.titleAr,
    city: location.city,
    area: location.area,
    approximateLocation: location.approximateLocation,
    latitudeApprox: location.latitudeApprox,
    longitudeApprox: location.longitudeApprox,
    capacity: property.capacity,
    rating: decimalToNumber(property.ratingAvg),
    reviewCount: property.reviewCount,
    basePrice: decimalToNumber(property.basePrice),
    currency: property.currency,
    verificationStatus: property.verificationStatus,
    hasPlatformDeal: property.hasPlatformDeal,
    allowsFamilies: property.allowsFamilies,
    allowsYouth: property.allowsYouth,
    hasPool: property.poolsCount > 0,
    hasIndoorPool: property.hasIndoorPool,
    hasHeatedPool: property.hasHeatedPool,
    hasFootballField: property.hasFootballField,
    allowsOvernight: property.allowsOvernight,
    allowsEvents: property.allowsEvents,
    instantBookingEnabled: property.instantBookingEnabled,
    imageUrl: firstImage ? resolvePropertyMediaPublicUrl(firstImage) : undefined,
    amenityKeys: property.amenities.map((pa) => pa.amenity.key),
    createdAt: property.createdAt.toISOString(),
  };
}

export function applyLiveRating<T extends { rating: number; reviewCount: number }>(
  row: T,
  stats?: { averageRating: number; reviewCount: number },
): T {
  if (stats && stats.reviewCount > 0) {
    return {
      ...row,
      rating: stats.averageRating,
      reviewCount: stats.reviewCount,
    };
  }
  // Keep denormalized Property.ratingAvg / reviewCount when no published reviews yet.
  return row;
}

export function toPublicPropertySummary(property: PublicPropertyRow): PublicPropertySummary {
  return mapBase(property);
}

export function toPublicPropertyDetail(property: PublicPropertyRow): PublicPropertyDetail {
  const base = mapBase(property);
  return {
    ...base,
    descriptionAr: property.descriptionAr ?? '',
    descriptionEn: property.descriptionEn ?? property.descriptionAr ?? '',
    bedrooms: property.bedrooms ?? 0,
    bathrooms: property.bathrooms ?? 0,
    poolsCount: property.poolsCount,
    checkInTime: property.checkInTime ?? '',
    checkOutTime: property.checkOutTime ?? '',
    images: property.media.map((m) => ({
      url: resolvePropertyMediaPublicUrl(m),
      altAr: m.altAr ?? property.titleAr,
      altEn: m.altEn ?? property.titleEn ?? property.titleAr,
    })),
    rulesAr: (property.rules ?? []).map((r) => r.titleAr),
    rulesEn: (property.rules ?? []).map((r) => r.titleEn ?? r.titleAr),
  };
}
