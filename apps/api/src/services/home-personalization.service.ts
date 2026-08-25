import { prisma, PropertyStatus, OwnerStatus } from '@mazare3/db';
import type { HomeBookAgainItem, HomePersonalizationResponse } from '@mazare3/shared';
import { canRebookBooking } from '../mappers/public-booking.mapper.js';
import { loadPublicPropertyCardsByIds } from './property-search.service.js';

const RAIL_SIZE = 6;
const BOOKING_SCAN = 40;
const FAVORITE_SCAN = 40;

export async function getCustomerHomePersonalization(
  userId: string,
): Promise<HomePersonalizationResponse> {
  const [bookings, favoriteRows] = await Promise.all([
    prisma.booking.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: BOOKING_SCAN,
      include: {
        property: {
          select: {
            id: true,
            status: true,
            owner: { select: { status: true } },
          },
        },
        slot: { select: { period: true } },
      },
    }),
    prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: FAVORITE_SCAN,
      select: {
        propertyId: true,
        property: {
          select: {
            id: true,
            status: true,
            owner: { select: { status: true } },
          },
        },
      },
    }),
  ]);

  const bookAgainCandidates: Array<{
    bookingId: string;
    propertyId: string;
    guestsCount: number;
    preferredPeriod: HomeBookAgainItem['preferredPeriod'];
  }> = [];
  const seenBookAgain = new Set<string>();
  for (const row of bookings) {
    if (
      !canRebookBooking({
        status: row.status,
        property: {
          status: row.property.status,
          owner: row.property.owner,
        },
      })
    ) {
      continue;
    }
    if (seenBookAgain.has(row.propertyId)) continue;
    seenBookAgain.add(row.propertyId);
    bookAgainCandidates.push({
      bookingId: row.id,
      propertyId: row.propertyId,
      guestsCount: row.guestsCount,
      preferredPeriod: row.slot.period,
    });
    if (bookAgainCandidates.length >= RAIL_SIZE) break;
  }

  const bookAgainPropertyIds = new Set(bookAgainCandidates.map((c) => c.propertyId));
  const favoriteIds: string[] = [];
  for (const row of favoriteRows) {
    if (row.property.status !== PropertyStatus.published) continue;
    if (row.property.owner.status !== OwnerStatus.approved) continue;
    if (bookAgainPropertyIds.has(row.propertyId)) continue;
    favoriteIds.push(row.propertyId);
    if (favoriteIds.length >= RAIL_SIZE) break;
  }

  const hydrateIds = [
    ...bookAgainCandidates.map((c) => c.propertyId),
    ...favoriteIds,
  ];
  const cards = await loadPublicPropertyCardsByIds(hydrateIds);
  const byId = new Map(cards.map((c) => [c.id, c]));

  const bookAgain: HomeBookAgainItem[] = [];
  for (const c of bookAgainCandidates) {
    const property = byId.get(c.propertyId);
    if (!property) continue;
    bookAgain.push({
      bookingId: c.bookingId,
      guestsCount: c.guestsCount,
      preferredPeriod: c.preferredPeriod,
      property,
    });
  }

  const favorites = favoriteIds
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({ ...p, isFavorited: true as const }));

  return { bookAgain, favorites };
}
