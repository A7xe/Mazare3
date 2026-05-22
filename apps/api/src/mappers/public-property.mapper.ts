import type { Prisma } from '@mazare3/db';
import type { PublicPropertyDetail, PublicPropertySummary } from '@mazare3/shared';

type PropertyWithRelations = Prisma.PropertyGetPayload<{
  include: {
    media: true;
    amenities: { include: { amenity: true } };
    rules: true;
  };
}>;

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

function mapBase(property: PropertyWithRelations): PublicPropertySummary {
  const firstImage = property.media[0];
  return {
    id: property.id,
    slug: property.slug,
    type: property.type,
    titleAr: property.titleAr,
    titleEn: property.titleEn ?? property.titleAr,
    city: property.city,
    area: property.area,
    approximateLocation: property.approximateAddress,
    capacity: property.capacity,
    rating: decimalToNumber(property.ratingAvg) || 0,
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
    imageUrl: firstImage?.url,
    amenityKeys: property.amenities.map((pa) => pa.amenity.key),
  };
}

export function toPublicPropertySummary(property: PropertyWithRelations): PublicPropertySummary {
  return mapBase(property);
}

export function toPublicPropertyDetail(property: PropertyWithRelations): PublicPropertyDetail {
  const base = mapBase(property);
  return {
    ...base,
    descriptionAr: property.descriptionAr,
    descriptionEn: property.descriptionEn ?? property.descriptionAr,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    poolsCount: property.poolsCount,
    checkInTime: property.checkInTime ?? '',
    checkOutTime: property.checkOutTime ?? '',
    images: property.media.map((m) => ({
      url: m.url,
      altAr: m.altAr ?? property.titleAr,
      altEn: m.altEn ?? property.titleEn ?? property.titleAr,
    })),
    rulesAr: property.rules.map((r) => r.titleAr),
    rulesEn: property.rules.map((r) => r.titleEn ?? r.titleAr),
  };
}
