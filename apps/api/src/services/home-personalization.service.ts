import { prisma, PropertyStatus, OwnerStatus, BookingStatus } from '@mazare3/db';
import {
  BOOK_AGAIN_RAIL_LIMIT,
  bookAgainVisitSortMs,
  dedupeBookAgainByPropertyId,
  isBookAgainHistoryEligible,
  type HomeBookAgainItem,
  type HomePersonalizationResponse,
} from '@mazare3/shared';
import { loadPublicPropertyCardsByIds } from './property-search.service.js';

const BOOKING_SCAN = 80;
const FAVORITE_SCAN = 40;

export async function getCustomerHomePersonalization(
  userId: string,
): Promise<HomePersonalizationResponse> {
  const now = new Date();
  const [bookings, favoriteRows] = await Promise.all([
    prisma.booking.findMany({
      where: {
        userId,
        status: BookingStatus.confirmed,
      },
      orderBy: [{ bookingEndAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: BOOKING_SCAN,
      include: {
        property: {
          select: {
            id: true,
            status: true,
            owner: { select: { status: true } },
          },
        },
        slot: { select: { period: true, date: true, endAt: true } },
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

  const qualifying = bookings
    .filter((row) =>
      isBookAgainHistoryEligible({
        status: row.status,
        paymentState: row.paymentState,
        bookingEndAt: row.bookingEndAt,
        slotDate: row.slot.date,
        slotEndAt: row.slot.endAt,
        propertyStatus: row.property.status,
        ownerStatus: row.property.owner.status,
        now,
      }),
    )
    .sort((a, b) => {
      const byVisit =
        bookAgainVisitSortMs({
          bookingEndAt: b.bookingEndAt,
          slotEndAt: b.slot.endAt,
          slotDate: b.slot.date,
        }) -
        bookAgainVisitSortMs({
          bookingEndAt: a.bookingEndAt,
          slotEndAt: a.slot.endAt,
          slotDate: a.slot.date,
        });
      if (byVisit) return byVisit;
      return b.id.localeCompare(a.id);
    });

  const bookAgainCandidates = dedupeBookAgainByPropertyId(
    qualifying.map((row) => ({
      bookingId: row.id,
      propertyId: row.propertyId,
      guestsCount: row.guestsCount,
      preferredPeriod: row.slot.period as HomeBookAgainItem['preferredPeriod'],
    })),
    BOOK_AGAIN_RAIL_LIMIT,
  );

  const bookAgainPropertyIds = new Set(bookAgainCandidates.map((c) => c.propertyId));
  const favoriteIds: string[] = [];
  for (const row of favoriteRows) {
    if (row.property.status !== PropertyStatus.published) continue;
    if (row.property.owner.status !== OwnerStatus.approved) continue;
    if (bookAgainPropertyIds.has(row.propertyId)) continue;
    favoriteIds.push(row.propertyId);
    if (favoriteIds.length >= BOOK_AGAIN_RAIL_LIMIT) break;
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

// Re-export for API/unit callers that previously imported from this module.
export { isBookAgainHistoryEligible } from '@mazare3/shared';
