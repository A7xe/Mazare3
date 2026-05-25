import { prisma, Prisma, PropertyStatus, VerificationStatus } from '@mazare3/db';
import type { PropertySearchQuery } from '@mazare3/shared';
import { toPublicPropertyDetail, toPublicPropertySummary } from '../mappers/public-property.mapper.js';

const publishedInclude = {
  media: { orderBy: { sortOrder: 'asc' as const } },
  amenities: { include: { amenity: true } },
  rules: { orderBy: { sortOrder: 'asc' as const } },
} as const;

function buildWhere(query: PropertySearchQuery): Prisma.PropertyWhereInput {
  const where: Prisma.PropertyWhereInput = {
    status: PropertyStatus.published,
  };

  if (query.q) {
    const q = query.q.trim();
    where.OR = [
      { titleAr: { contains: q, mode: 'insensitive' } },
      { titleEn: { contains: q, mode: 'insensitive' } },
      { descriptionAr: { contains: q, mode: 'insensitive' } },
      { descriptionEn: { contains: q, mode: 'insensitive' } },
      { area: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
      { approximateAddress: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (query.area) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { city: { equals: query.area, mode: 'insensitive' } },
          { area: { contains: query.area, mode: 'insensitive' } },
        ],
      },
    ];
  }

  if (query.propertyType) {
    where.type = query.propertyType;
  }

  if (query.guests) {
    where.capacity = { gte: query.guests };
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.basePrice = {};
    if (query.minPrice !== undefined) where.basePrice.gte = query.minPrice;
    if (query.maxPrice !== undefined) where.basePrice.lte = query.maxPrice;
  }

  if (query.hasPool === true) {
    where.poolsCount = { gt: 0 };
  } else if (query.hasPool === false) {
    where.poolsCount = 0;
  }

  if (query.verifiedOnly) {
    where.verificationStatus = {
      in: [VerificationStatus.platform_reviewed, VerificationStatus.platform_verified],
    };
  }

  if (query.amenities?.length) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      ...query.amenities.map((key) => ({
        amenities: { some: { amenity: { key } } },
      })),
    ];
  }

  return where;
}

function buildOrderBy(sort: PropertySearchQuery['sort']): Prisma.PropertyOrderByWithRelationInput[] {
  switch (sort) {
    case 'price_asc':
      return [{ basePrice: 'asc' }];
    case 'price_desc':
      return [{ basePrice: 'desc' }];
    case 'rating_desc':
      return [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }];
    case 'newest':
      return [{ createdAt: 'desc' }];
    case 'recommended':
    default:
      return [{ hasPlatformDeal: 'desc' }, { ratingAvg: 'desc' }, { createdAt: 'desc' }];
  }
}

export async function listPublishedProperties(query: PropertySearchQuery) {
  const rows = await prisma.property.findMany({
    where: buildWhere(query),
    include: publishedInclude,
    orderBy: buildOrderBy(query.sort),
  });

  return rows.map(toPublicPropertySummary);
}

export async function getPublishedPropertyBySlug(slug: string) {
  const row = await prisma.property.findFirst({
    where: { slug, status: PropertyStatus.published },
    include: publishedInclude,
  });

  if (!row) return null;
  return toPublicPropertyDetail(row);
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
    orderBy: { ratingAvg: 'desc' },
  });

  return rows.map(toPublicPropertySummary);
}
