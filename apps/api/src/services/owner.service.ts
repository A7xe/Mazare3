import {
  prisma,
  AvailabilitySlotStatus,
  BookingStatus,
  OwnerStatus,
  type UserRole,
} from '@mazare3/db';
import type {
  OwnerAvailabilityQuery,
  OwnerAvailabilitySlotRow,
  OwnerBookingRow,
  OwnerDashboardSummary,
  OwnerPropertyCard,
  OwnerPropertyDetail,
  PatchOwnerAvailabilityInput,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

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

function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDaysUtc(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

type OwnerScope = {
  isAdmin: boolean;
  ownerProfileId: string | null;
};

async function resolveOwnerScope(userId: string, role: UserRole): Promise<OwnerScope> {
  if (role === 'admin') {
    return { isAdmin: true, ownerProfileId: null };
  }
  if (role !== 'owner') {
    throw new AppError(403, 'FORBIDDEN', 'Owner access only');
  }
  const profile = await prisma.ownerProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!profile || profile.status !== OwnerStatus.approved) {
    throw new AppError(403, 'FORBIDDEN', 'Owner profile not approved');
  }
  return { isAdmin: false, ownerProfileId: profile.id };
}

function propertyWhere(scope: OwnerScope) {
  return scope.isAdmin ? {} : { ownerId: scope.ownerProfileId! };
}

async function assertPropertyAccess(scope: OwnerScope, propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, ...propertyWhere(scope) },
    select: { id: true, ownerId: true, slug: true },
  });
  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }
  return property;
}

async function slotHasActiveBooking(slotId: string): Promise<boolean> {
  const active = await prisma.booking.findFirst({
    where: {
      availabilitySlotId: slotId,
      status: { in: [BookingStatus.pending, BookingStatus.confirmed] },
    },
    select: { id: true },
  });
  return !!active;
}

export async function getOwnerSummary(
  userId: string,
  role: UserRole,
  req?: AuthenticatedRequest,
): Promise<OwnerDashboardSummary> {
  const scope = await resolveOwnerScope(userId, role);
  const today = todayUtc();
  const weekEnd = addDaysUtc(today, 7);
  const monthEnd = addDaysUtc(today, 30);

  const properties = await prisma.property.findMany({
    where: propertyWhere(scope),
    select: { id: true },
  });
  const propertyIds = properties.map((p) => p.id);

  if (propertyIds.length === 0) {
    return {
      propertiesCount: 0,
      upcomingBookingsCount: 0,
      todayBookingsCount: 0,
      weekBookingsCount: 0,
      estimatedRevenueJod: 0,
      occupancyPercent: 0,
    };
  }

  const activeStatuses = [BookingStatus.pending, BookingStatus.confirmed];

  const [upcomingBookingsCount, todayBookings, weekBookings, revenueAgg, slotsInRange, bookedSlots] =
    await Promise.all([
      prisma.booking.count({
        where: {
          propertyId: { in: propertyIds },
          status: { in: activeStatuses },
          slot: { date: { gte: today } },
        },
      }),
      prisma.booking.findMany({
        where: {
          propertyId: { in: propertyIds },
          status: { in: activeStatuses },
          slot: { date: today },
        },
        include: { slot: { select: { date: true } } },
      }),
      prisma.booking.findMany({
        where: {
          propertyId: { in: propertyIds },
          status: { in: activeStatuses },
          slot: { date: { gte: today, lte: weekEnd } },
        },
      }),
      prisma.booking.aggregate({
        where: {
          propertyId: { in: propertyIds },
          status: { in: activeStatuses },
          slot: { date: { gte: today } },
        },
        _sum: { totalAmount: true },
      }),
      prisma.availabilitySlot.count({
        where: {
          propertyId: { in: propertyIds },
          date: { gte: today, lte: monthEnd },
        },
      }),
      prisma.availabilitySlot.count({
        where: {
          propertyId: { in: propertyIds },
          date: { gte: today, lte: monthEnd },
          status: AvailabilitySlotStatus.booked,
        },
      }),
    ]);

  await createAuditLog({
    actorUserId: userId,
    action: 'owner.dashboard_accessed',
    entityType: 'owner',
    metadata: { propertiesCount: propertyIds.length },
    req,
  });

  const occupancyPercent =
    slotsInRange > 0 ? Math.round((bookedSlots / slotsInRange) * 100) : 0;

  return {
    propertiesCount: propertyIds.length,
    upcomingBookingsCount,
    todayBookingsCount: todayBookings.length,
    weekBookingsCount: weekBookings.length,
    estimatedRevenueJod: decimalToNumber(revenueAgg._sum.totalAmount ?? 0),
    occupancyPercent,
  };
}

export async function listOwnerProperties(
  userId: string,
  role: UserRole,
): Promise<OwnerPropertyCard[]> {
  const scope = await resolveOwnerScope(userId, role);

  const properties = await prisma.property.findMany({
    where: propertyWhere(scope),
    orderBy: { titleAr: 'asc' },
    include: {
      media: { orderBy: { sortOrder: 'asc' }, take: 1 },
      _count: {
        select: {
          bookings: {
            where: { status: { in: [BookingStatus.pending, BookingStatus.confirmed] } },
          },
        },
      },
    },
  });

  return properties.map((p) => ({
    id: p.id,
    slug: p.slug,
    titleAr: p.titleAr,
    titleEn: p.titleEn ?? p.titleAr,
    status: p.status,
    area: p.area,
    city: p.city,
    basePrice: decimalToNumber(p.basePrice),
    currency: p.currency,
    bookingsCount: p._count.bookings,
    imageUrl: p.media[0]?.url,
  }));
}

export async function getOwnerPropertyById(
  userId: string,
  role: UserRole,
  propertyId: string,
): Promise<OwnerPropertyDetail | null> {
  const scope = await resolveOwnerScope(userId, role);

  const p = await prisma.property.findFirst({
    where: { id: propertyId, ...propertyWhere(scope) },
    include: {
      media: { orderBy: { sortOrder: 'asc' }, take: 1 },
      _count: {
        select: {
          bookings: {
            where: {
              status: { in: [BookingStatus.pending, BookingStatus.confirmed] },
              slot: { date: { gte: todayUtc() } },
            },
          },
        },
      },
    },
  });

  if (!p) return null;

  return {
    id: p.id,
    slug: p.slug,
    titleAr: p.titleAr,
    titleEn: p.titleEn ?? p.titleAr,
    status: p.status,
    area: p.area,
    city: p.city,
    basePrice: decimalToNumber(p.basePrice),
    currency: p.currency,
    bookingsCount: p._count.bookings,
    imageUrl: p.media[0]?.url,
    capacity: p.capacity,
    allowsOvernight: p.allowsOvernight,
    upcomingBookingsCount: p._count.bookings,
  };
}

export async function listOwnerBookings(
  userId: string,
  role: UserRole,
): Promise<OwnerBookingRow[]> {
  const scope = await resolveOwnerScope(userId, role);

  const bookings = await prisma.booking.findMany({
    where: {
      property: propertyWhere(scope),
    },
    orderBy: [{ slot: { date: 'desc' } }, { createdAt: 'desc' }],
    include: {
      property: { select: { slug: true, titleAr: true, titleEn: true } },
      slot: { select: { date: true, period: true } },
    },
  });

  return bookings.map((b) => ({
    id: b.id,
    publicCode: b.publicCode,
    status: b.status,
    propertyId: b.propertyId,
    propertySlug: b.property.slug,
    propertyTitleAr: b.property.titleAr,
    propertyTitleEn: b.property.titleEn ?? b.property.titleAr,
    date: formatDateOnly(b.slot.date),
    period: b.slot.period,
    guestsCount: b.guestsCount,
    totalAmount: decimalToNumber(b.totalAmount),
    currency: b.currency,
    createdAt: b.createdAt.toISOString(),
  }));
}

export async function listOwnerAvailability(
  userId: string,
  role: UserRole,
  query: OwnerAvailabilityQuery,
): Promise<OwnerAvailabilitySlotRow[]> {
  const scope = await resolveOwnerScope(userId, role);
  await assertPropertyAccess(scope, query.propertyId);

  const fromDate = parseDateOnly(query.from);
  const toDate = parseDateOnly(query.to);

  const slots = await prisma.availabilitySlot.findMany({
    where: {
      propertyId: query.propertyId,
      date: { gte: fromDate, lte: toDate },
    },
    orderBy: [{ date: 'asc' }, { period: 'asc' }],
    include: {
      bookings: {
        where: { status: { in: [BookingStatus.pending, BookingStatus.confirmed] } },
        select: { id: true },
        take: 1,
      },
    },
  });

  return slots.map((s) => ({
    id: s.id,
    propertyId: s.propertyId,
    date: formatDateOnly(s.date),
    period: s.period,
    price: decimalToNumber(s.price),
    currency: 'JOD',
    status: s.status,
    hasActiveBooking: s.bookings.length > 0 || s.status === AvailabilitySlotStatus.booked,
  }));
}

export async function patchOwnerAvailabilitySlot(
  userId: string,
  role: UserRole,
  slotId: string,
  input: PatchOwnerAvailabilityInput,
  req?: AuthenticatedRequest,
): Promise<OwnerAvailabilitySlotRow> {
  const scope = await resolveOwnerScope(userId, role);

  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: slotId },
    include: {
      property: { select: { id: true, ownerId: true } },
      bookings: {
        where: { status: { in: [BookingStatus.pending, BookingStatus.confirmed] } },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!slot) {
    throw new AppError(404, 'NOT_FOUND', 'Availability slot not found');
  }

  if (!scope.isAdmin && slot.property.ownerId !== scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not own this property');
  }

  const hasActive =
    slot.bookings.length > 0 || slot.status === AvailabilitySlotStatus.booked;

  if (hasActive) {
    throw new AppError(
      409,
      'SLOT_HAS_ACTIVE_BOOKING',
      'Cannot modify a slot with an active booking',
    );
  }

  const prevStatus = slot.status;
  const prevPrice = decimalToNumber(slot.price);

  const data: { status?: AvailabilitySlotStatus; price?: number } = {};
  if (input.status !== undefined) {
    data.status =
      input.status === 'blocked'
        ? AvailabilitySlotStatus.blocked
        : AvailabilitySlotStatus.available;
  }
  if (input.price !== undefined) {
    data.price = input.price;
  }

  const updated = await prisma.availabilitySlot.update({
    where: { id: slotId },
    data,
  });

  if (input.status === 'blocked' && prevStatus !== AvailabilitySlotStatus.blocked) {
    await createAuditLog({
      actorUserId: userId,
      action: 'owner.availability_blocked',
      entityType: 'availability_slot',
      entityId: slotId,
      metadata: { propertyId: slot.propertyId, date: formatDateOnly(slot.date), period: slot.period },
      req,
    });
  } else if (
    input.status === 'available' &&
    prevStatus === AvailabilitySlotStatus.blocked
  ) {
    await createAuditLog({
      actorUserId: userId,
      action: 'owner.availability_unblocked',
      entityType: 'availability_slot',
      entityId: slotId,
      metadata: { propertyId: slot.propertyId, date: formatDateOnly(slot.date), period: slot.period },
      req,
    });
  }

  if (input.price !== undefined && input.price !== prevPrice) {
    await createAuditLog({
      actorUserId: userId,
      action: 'owner.availability_price_updated',
      entityType: 'availability_slot',
      entityId: slotId,
      metadata: {
        propertyId: slot.propertyId,
        previousPrice: prevPrice,
        newPrice: input.price,
      },
      req,
    });
  }

  return {
    id: updated.id,
    propertyId: updated.propertyId,
    date: formatDateOnly(updated.date),
    period: updated.period,
    price: decimalToNumber(updated.price),
    currency: 'JOD',
    status: updated.status,
    hasActiveBooking: false,
  };
}
