import { prisma, PropertyStatus } from '@mazare3/db';
import type { PublicAvailabilitySlot } from '@mazare3/shared';

function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d));
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

export async function listPropertyAvailability(
  slug: string,
  from: string,
  to: string,
): Promise<PublicAvailabilitySlot[] | null> {
  const property = await prisma.property.findFirst({
    where: { slug, status: PropertyStatus.published },
    select: { id: true },
  });

  if (!property) return null;

  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);

  const slots = await prisma.availabilitySlot.findMany({
    where: {
      propertyId: property.id,
      date: { gte: fromDate, lte: toDate },
    },
    orderBy: [{ date: 'asc' }, { period: 'asc' }],
  });

  return slots.map((s) => ({
    date: formatDateOnly(s.date),
    period: s.period,
    price: decimalToNumber(s.price),
    currency: 'JOD',
    status: s.status,
  }));
}
