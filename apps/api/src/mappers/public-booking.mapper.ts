import type { Prisma } from '@mazare3/db';
import type { PublicBookingSummary } from '@mazare3/shared';

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    property: { select: { slug: true; titleAr: true; titleEn: true; approximateAddress: true } };
    slot: { select: { date: true; period: true } };
  };
}>;

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

export function toPublicBookingSummary(booking: BookingWithRelations): PublicBookingSummary {
  return {
    id: booking.id,
    publicCode: booking.publicCode,
    status: booking.status,
    propertySlug: booking.property.slug,
    propertyTitleAr: booking.property.titleAr,
    propertyTitleEn: booking.property.titleEn ?? booking.property.titleAr,
    approximateLocation: booking.property.approximateAddress,
    date: formatDateOnly(booking.slot.date),
    period: booking.slot.period,
    guestsCount: booking.guestsCount,
    totalAmount: decimalToNumber(booking.totalAmount),
    currency: booking.currency,
    createdAt: booking.createdAt.toISOString(),
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
  };
}
