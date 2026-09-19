import { prisma, PropertyStatus, OwnerStatus } from '@mazare3/db';
import type { PublicPropertySummary } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { loadPublicPropertyCardsByIds } from './property-search.service.js';

const favoritePropertyInclude = {
  media: {
    where: { removedFromListingAt: null },
    orderBy: { sortOrder: 'asc' as const },
    take: 1,
  },
  amenities: { include: { amenity: true } },
  owner: { select: { status: true } },
} as const;

function isBookableFavorite(property: {
  status: PropertyStatus;
  owner: { status: OwnerStatus };
}): boolean {
  return property.status === PropertyStatus.published && property.owner.status === OwnerStatus.approved;
}

async function assertPublicFavoriteTarget(propertyId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { owner: { select: { status: true } } },
  });
  if (!property || !isBookableFavorite(property)) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }
  return property;
}

export async function listFavoritePropertyIds(userId: string): Promise<string[]> {
  const rows = await prisma.favorite.findMany({
    where: { userId },
    select: { propertyId: true },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => r.propertyId);
}

/** Published, owner-approved listings only. Stored unpublished favorites are omitted, not deleted. */
export async function listBookableFavorites(userId: string): Promise<PublicPropertySummary[]> {
  const rows = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { property: { include: favoritePropertyInclude } },
  });

  const bookableIds = rows
    .filter((r) => isBookableFavorite(r.property))
    .map((r) => r.property.id);

  // Batched card hydration includes live promotion summaries (no N+1).
  const cards = await loadPublicPropertyCardsByIds(bookableIds);
  const byId = new Map(cards.map((c) => [c.id, c]));

  return bookableIds
    .map((id) => byId.get(id))
    .filter((c): c is PublicPropertySummary => Boolean(c))
    .map((c) => ({
      ...c,
      isFavorited: true,
      pricingMode: c.pricingMode ?? 'browse_from',
    }));
}

export async function addFavorite(userId: string, propertyId: string): Promise<{ favorited: true }> {
  await assertPublicFavoriteTarget(propertyId);
  await prisma.favorite.upsert({
    where: { userId_propertyId: { userId, propertyId } },
    create: { userId, propertyId },
    update: {},
  });
  return { favorited: true };
}

export async function removeFavorite(userId: string, propertyId: string): Promise<{ favorited: false }> {
  await prisma.favorite.deleteMany({
    where: { userId, propertyId },
  });
  return { favorited: false };
}
