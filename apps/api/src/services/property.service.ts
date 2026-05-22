import { prisma, PropertyStatus } from '@mazare3/db';
import { toPublicPropertyDetail, toPublicPropertySummary } from '../mappers/public-property.mapper.js';

const publishedInclude = {
  media: { orderBy: { sortOrder: 'asc' as const } },
  amenities: { include: { amenity: true } },
  rules: { orderBy: { sortOrder: 'asc' as const } },
} as const;

export async function listPublishedProperties() {
  const rows = await prisma.property.findMany({
    where: { status: PropertyStatus.published },
    include: publishedInclude,
    orderBy: [{ hasPlatformDeal: 'desc' }, { ratingAvg: 'desc' }, { createdAt: 'desc' }],
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
