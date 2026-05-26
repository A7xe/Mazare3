import {
  prisma,
  AvailabilitySlotStatus,
  BookingStatus,
  PaymentStatus,
  PayoutStatus,
  PropertyStatus,
  RefundStatus,
} from '@mazare3/db';
import { SLOT_HOLDING_STATUSES } from '../lib/payment-hold.js';
import type { CreateBookingInput } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import {
  toPublicBookingSummary,
  withBookingOperationsFlags,
} from '../mappers/public-booking.mapper.js';
import { BLOCKING_REFUND_REQUEST_STATUSES } from '@mazare3/shared';
import { canOpenDisputeForBooking } from './dispute.service.js';
import { toPaymentSummary } from '../mappers/payment.mapper.js';
import type { CheckoutBookingView } from '@mazare3/shared';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { randomBytes } from 'node:crypto';
import {
  calculateBookingFinancials,
  evaluateCancellationPolicy,
} from './payment-policy.service.js';
import { syncPayoutStatusForPayment } from './payment-payout.service.js';

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

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
          status: { in: SLOT_HOLDING_STATUSES },
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
          status: BookingStatus.pending_payment,
        },
        include: {
          property: {
            select: { slug: true, titleAr: true, titleEn: true, approximateAddress: true },
          },
          slot: { select: { date: true, period: true } },
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
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

const bookingInclude = {
  property: {
    select: { slug: true, titleAr: true, titleEn: true, approximateAddress: true },
  },
  slot: { select: { date: true, period: true } },
  payments: { orderBy: { createdAt: 'desc' as const }, take: 1 },
};

async function enrichBookingSummariesForCustomer(
  userId: string,
  rows: Awaited<ReturnType<typeof prisma.booking.findMany<{ include: typeof bookingInclude }>>>,
) {
  const ids = rows.map((r) => r.id);
  const [refunds, disputes] = await Promise.all([
    prisma.refundRequest.findMany({
      where: {
        bookingId: { in: ids },
        customerId: userId,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.dispute.findMany({
      where: { bookingId: { in: ids }, openedByUserId: userId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const refundByBooking = new Map<string, (typeof refunds)[0]>();
  for (const r of refunds) {
    if (!refundByBooking.has(r.bookingId)) refundByBooking.set(r.bookingId, r);
  }
  const disputeByBooking = new Map<string, (typeof disputes)[0]>();
  for (const d of disputes) {
    if (!disputeByBooking.has(d.bookingId)) disputeByBooking.set(d.bookingId, d);
  }

  return rows.map((row) => {
    const summary = toPublicBookingSummary(row);
    const paid =
      row.status === BookingStatus.confirmed &&
      row.payments[0]?.status === PaymentStatus.succeeded;
    const refundRow = refundByBooking.get(row.id);
    const hasBlockingRefund =
      refundRow &&
      (BLOCKING_REFUND_REQUEST_STATUSES as readonly string[]).includes(refundRow.status);
    const refundRequest = refundRow
      ? {
          id: refundRow.id,
          bookingId: refundRow.bookingId,
          status: refundRow.status,
          policyRefundAmount: decimalToNumber(refundRow.policyRefundAmount),
          requestedAmount: decimalToNumber(refundRow.requestedAmount),
          approvedAmount:
            refundRow.approvedAmount != null
              ? decimalToNumber(refundRow.approvedAmount)
              : null,
          reason: refundRow.reason,
          adminNote: refundRow.adminNote,
          createdAt: refundRow.createdAt.toISOString(),
          updatedAt: refundRow.updatedAt.toISOString(),
        }
      : null;

    return withBookingOperationsFlags(summary, {
      refundRequest,
      canRequestRefund: paid && !hasBlockingRefund && !refundRow,
      canOpenDispute:
        paid &&
        canOpenDisputeForBooking(row.status, true, row.slot.date) &&
        !disputeByBooking.get(row.id),
    });
  });
}

export async function listMyBookings(userId: string) {
  const rows = await prisma.booking.findMany({
    where: { userId },
    include: bookingInclude,
    orderBy: { createdAt: 'desc' },
  });

  return enrichBookingSummariesForCustomer(userId, rows);
}

export async function getMyBookingById(userId: string, bookingId: string) {
  const row = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: bookingInclude,
  });

  if (!row) return null;
  const [enriched] = await enrichBookingSummariesForCustomer(userId, [row]);
  return enriched ?? null;
}

export async function getCheckoutBooking(
  userId: string,
  bookingId: string,
): Promise<CheckoutBookingView | null> {
  const row = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: bookingInclude,
  });
  if (!row) return null;

  const summary = toPublicBookingSummary(row);
  const latestPayment = row.payments[0];
  const fin = calculateBookingFinancials(decimalToNumber(row.totalAmount));
  let paymentSummary = latestPayment ? toPaymentSummary(latestPayment) : null;
  if (latestPayment?.status === PaymentStatus.succeeded) {
    await syncPayoutStatusForPayment(latestPayment.id);
    const synced = await prisma.payment.findUnique({ where: { id: latestPayment.id } });
    if (synced) paymentSummary = toPaymentSummary(synced);
  }
  return {
    ...summary,
    payment: paymentSummary,
    pricing: fin,
  };
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

  let cancellationMeta: Record<string, unknown> | undefined;

  if (booking.status === BookingStatus.confirmed) {
    const paid = await prisma.payment.findFirst({
      where: { bookingId: booking.id, status: PaymentStatus.succeeded },
    });
    if (!paid) {
      throw new AppError(400, 'INVALID_STATUS', 'Booking cannot be cancelled');
    }
    const payable = decimalToNumber(paid.customerPayableAmount);
    const policy = evaluateCancellationPolicy(payable, booking.slot.date);
    if (!policy.canCancel) {
      throw new AppError(
        400,
        'CANCELLATION_NOT_ALLOWED',
        policy.reason ?? 'Cancellation is not allowed for this booking',
      );
    }
    cancellationMeta = {
      refundableAmount: policy.refundableAmount,
      cancellationPenaltyAmount: policy.cancellationPenaltyAmount,
      refundPercent: policy.refundPercent,
      tier: policy.tier,
    };
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
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (booking.status === BookingStatus.confirmed && cancellationMeta) {
      await tx.payment.updateMany({
        where: { bookingId: booking.id, status: PaymentStatus.succeeded },
        data: {
          refundStatus: RefundStatus.pending,
          cancellationRefundAmount: cancellationMeta.refundableAmount as number,
          cancellationPenaltyAmount: cancellationMeta.cancellationPenaltyAmount as number,
          payoutStatus: PayoutStatus.blocked,
        },
      });
    } else {
      await tx.payment.updateMany({
        where: {
          bookingId: booking.id,
          status: { in: [PaymentStatus.initiated, PaymentStatus.pending] },
        },
        data: { status: PaymentStatus.cancelled },
      });
    }

    await tx.availabilitySlot.update({
      where: { id: booking.availabilitySlotId },
      data: { status: AvailabilitySlotStatus.available },
    });

    return b;
  });

  const auditAction =
    booking.status === BookingStatus.confirmed
      ? 'booking.cancel_requested'
      : 'booking.cancelled';

  await createAuditLog({
    actorUserId: userId,
    action: auditAction,
    entityType: 'booking',
    entityId: booking.id,
    metadata: { publicCode: booking.publicCode, ...cancellationMeta },
    req,
  });

  return toPublicBookingSummary(updated);
}
