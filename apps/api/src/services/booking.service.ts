import {
  prisma,
  AvailabilitySlotStatus,
  BookingStatus,
  PropertyStatus,
} from '@mazare3/db';
import type { CreateBookingInput } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { toPublicBookingSummary } from '../mappers/public-booking.mapper.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { randomBytes } from 'node:crypto';

function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d));
}

function generatePublicCode(): string {
  return `MZ-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function createBooking(
  userId: string,
  input: CreateBookingInput,
  req?: AuthenticatedRequest,
) {
  const property = await prisma.property.findFirst({
    where: { slug: input.propertySlug, status: PropertyStatus.published },
    select: { id: true, capacity: true },
  });

  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }

  if (input.guestsCount > property.capacity) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Guest count exceeds property capacity');
  }

  const date = parseDateOnly(input.date);

  const slot = await prisma.availabilitySlot.findUnique({
    where: {
      propertyId_date_period: {
        propertyId: property.id,
        date,
        period: input.period,
      },
    },
  });

  if (!slot || slot.status !== AvailabilitySlotStatus.available) {
    await createAuditLog({
      actorUserId: userId,
      action: 'booking.conflict_rejected',
      entityType: 'availability_slot',
      entityId: slot?.id,
      metadata: {
        propertySlug: input.propertySlug,
        date: input.date,
        period: input.period,
        reason: slot ? 'slot_not_available' : 'slot_missing',
      },
      req,
    });
    throw new AppError(409, 'SLOT_UNAVAILABLE', 'This time slot is not available for booking');
  }

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const activeOnSlot = await tx.booking.findFirst({
        where: {
          availabilitySlotId: slot.id,
          status: { in: [BookingStatus.pending, BookingStatus.confirmed] },
        },
      });
      if (activeOnSlot) {
        throw new AppError(409, 'SLOT_UNAVAILABLE', 'This time slot is not available for booking');
      }

      const updated = await tx.availabilitySlot.updateMany({
        where: { id: slot.id, status: AvailabilitySlotStatus.available },
        data: { status: AvailabilitySlotStatus.booked },
      });

      if (updated.count !== 1) {
        throw new AppError(409, 'SLOT_UNAVAILABLE', 'This time slot was just booked');
      }

      return tx.booking.create({
        data: {
          publicCode: generatePublicCode(),
          userId,
          propertyId: property.id,
          availabilitySlotId: slot.id,
          guestsCount: input.guestsCount,
          totalAmount: slot.price,
          currency: 'JOD',
          status: BookingStatus.confirmed,
        },
        include: {
          property: {
            select: { slug: true, titleAr: true, titleEn: true, approximateAddress: true },
          },
          slot: { select: { date: true, period: true } },
        },
      });
    });

    await createAuditLog({
      actorUserId: userId,
      action: 'booking.created',
      entityType: 'booking',
      entityId: booking.id,
      metadata: { publicCode: booking.publicCode, propertySlug: input.propertySlug },
      req,
    });

    return toPublicBookingSummary(booking);
  } catch (err) {
    if (err instanceof AppError && err.code === 'SLOT_UNAVAILABLE') {
      await createAuditLog({
        actorUserId: userId,
        action: 'booking.conflict_rejected',
        entityType: 'availability_slot',
        entityId: slot.id,
        metadata: { propertySlug: input.propertySlug, date: input.date, period: input.period },
        req,
      });
      throw err;
    }
    const prismaCode = (err as { code?: string })?.code;
    if (prismaCode === 'P2002') {
      await createAuditLog({
        actorUserId: userId,
        action: 'booking.conflict_rejected',
        entityType: 'availability_slot',
        entityId: slot.id,
        metadata: { propertySlug: input.propertySlug, reason: 'unique_violation' },
        req,
      });
      throw new AppError(409, 'SLOT_UNAVAILABLE', 'This time slot is not available for booking');
    }
    throw err;
  }
}

export async function listMyBookings(userId: string) {
  const rows = await prisma.booking.findMany({
    where: { userId },
    include: {
      property: {
        select: { slug: true, titleAr: true, titleEn: true, approximateAddress: true },
      },
      slot: { select: { date: true, period: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map(toPublicBookingSummary);
}

export async function getMyBookingById(userId: string, bookingId: string) {
  const row = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: {
      property: {
        select: { slug: true, titleAr: true, titleEn: true, approximateAddress: true },
      },
      slot: { select: { date: true, period: true } },
    },
  });

  if (!row) return null;
  return toPublicBookingSummary(row);
}

export async function cancelMyBooking(
  userId: string,
  bookingId: string,
  req?: AuthenticatedRequest,
) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: { slot: true },
  });

  if (!booking) {
    throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  }

  if (
    booking.status === BookingStatus.cancelled ||
    booking.status === BookingStatus.expired
  ) {
    throw new AppError(400, 'INVALID_STATUS', 'Booking cannot be cancelled');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.cancelled,
        cancelledAt: new Date(),
      },
      include: {
        property: {
          select: { slug: true, titleAr: true, titleEn: true, approximateAddress: true },
        },
        slot: { select: { date: true, period: true } },
      },
    });

    await tx.availabilitySlot.update({
      where: { id: booking.availabilitySlotId },
      data: { status: AvailabilitySlotStatus.available },
    });

    return b;
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'booking.cancelled',
    entityType: 'booking',
    entityId: booking.id,
    metadata: { publicCode: booking.publicCode },
    req,
  });

  return toPublicBookingSummary(updated);
}
