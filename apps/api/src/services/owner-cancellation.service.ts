import {
  prisma,
  AvailabilitySlotStatus,
  BookingStatus,
  OwnerFinancialAdjustmentType,
  OwnerReliabilityCategory,
  PaymentStatus,
  PayoutStatus,
  RefundStatus,
} from '@mazare3/db';
import {
  BOOKING_CANCELLATION_REASON,
  calculateOwnerPenaltyJod,
  hoursUntilInstant,
  isForceMajeureReason,
  resolveBookingPeriodStart,
  OWNER_CANCELLATION_REASON,
  type OwnerCancellationReasonCode,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { releaseSlotIfUnheld } from './booking-hold.service.js';
import { releaseCouponReservationInTx } from './coupon.service.js';
import { releasePlatformCouponReservationInTx } from './platform-coupon.service.js';
import { refundableCapturedFils } from '../lib/booking-ledger.js';
import { filsToJod } from '@mazare3/shared';
import { resolveOwnerScope } from './owner-access.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import type { UserRole } from '@mazare3/db';
import {
  createOwnerPenaltyAdjustment,
  recordOwnerReliabilityIncident,
} from './owner-reliability.service.js';
import { ensureSystemOwnerFaultRefund } from './refund-request.service.js';
import { syncPayoutStatusForPayment } from './payment-payout.service.js';
import {
  notifyOwnerCancelledBooking,
  notifyCustomerOwnerCancelled,
} from './notification.service.js';

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

export type OwnerCancelPreview = {
  customerRefund: number;
  ownerPayout: number;
  ownerPenaltyJod: number;
  forceMajeure: boolean;
  hoursUntilStart: number;
};

export async function previewOwnerCancellation(
  ownerUserId: string,
  role: UserRole,
  bookingId: string,
  reasonCode: OwnerCancellationReasonCode,
): Promise<OwnerCancelPreview> {
  const booking = await loadOwnerConfirmedBooking(ownerUserId, role, bookingId);
  const merchant = decimalToNumber(booking.merchantBookingValue ?? booking.totalAmount);
  const start = resolveBookingPeriodStart(booking.bookingStartAt, booking.slot.date);
  const hours = hoursUntilInstant(start);
  const forceMajeure = isForceMajeureReason(reasonCode);
  const funds = refundableCapturedFils(booking.payments, booking.refundRequests);
  const customerRefund = filsToJod(funds.refundable);
  const penalty = forceMajeure
    ? 0
    : calculateOwnerPenaltyJod(merchant, hours > 0 ? hours : 0);

  return {
    customerRefund,
    ownerPayout: 0,
    ownerPenaltyJod: penalty,
    forceMajeure,
    hoursUntilStart: hours,
  };
}

async function loadOwnerConfirmedBooking(ownerUserId: string, role: UserRole, bookingId: string) {
  const scope = await resolveOwnerScope(ownerUserId, role);
  if (scope.isAdmin || !scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Owner access required');
  }

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      status: BookingStatus.confirmed,
      property: { ownerId: scope.ownerProfileId },
    },
    include: {
      slot: true,
      payments: true,
      refundRequests: true,
      property: { select: { ownerId: true, titleAr: true, titleEn: true } },
      user: { select: { id: true } },
    },
  });
  if (!booking) {
    throw new AppError(404, 'NOT_FOUND', 'Confirmed booking not found');
  }

  const start = resolveBookingPeriodStart(booking.bookingStartAt, booking.slot.date);
  if (hoursUntilInstant(start) <= 0) {
    throw new AppError(400, 'INVALID_STATUS', 'Cannot cancel after booking start');
  }

  return booking;
}

export async function cancelConfirmedBookingByOwner(params: {
  ownerUserId: string;
  role: UserRole;
  bookingId: string;
  reasonCode: OwnerCancellationReasonCode;
  note?: string;
  req?: AuthenticatedRequest;
}) {
  const preview = await previewOwnerCancellation(
    params.ownerUserId,
    params.role,
    params.bookingId,
    params.reasonCode,
  );
  const booking = await loadOwnerConfirmedBooking(
    params.ownerUserId,
    params.role,
    params.bookingId,
  );
  const forceMajeure = preview.forceMajeure;
  const reliabilityCategory = forceMajeure
    ? OwnerReliabilityCategory.force_majeure
    : OwnerReliabilityCategory.owner_cancel;

  const updated = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.cancelled,
        cancelledAt: new Date(),
        cancellationReasonCode: forceMajeure
          ? BOOKING_CANCELLATION_REASON.FORCE_MAJEURE
          : BOOKING_CANCELLATION_REASON.OWNER_CANCEL,
        ownerNetPayoutAmount: 0,
        platformCommissionAmount: 0,
      },
    });

    await tx.payment.updateMany({
      where: { bookingId: booking.id, status: PaymentStatus.succeeded },
      data: {
        refundStatus: preview.customerRefund > 0 ? RefundStatus.pending : RefundStatus.none,
        cancellationRefundAmount: preview.customerRefund,
        cancellationPenaltyAmount: 0,
        platformCommissionAmount: 0,
        ownerNetPayoutAmount: 0,
        ownerGrossAmount: 0,
        payoutStatus: PayoutStatus.blocked,
      },
    });

    await tx.availabilitySlot.update({
      where: { id: booking.availabilitySlotId },
      data: { status: AvailabilitySlotStatus.available },
    });
    await releaseSlotIfUnheld(tx, booking.availabilitySlotId, booking.id);
    await releaseCouponReservationInTx(tx, booking.id);
    await releasePlatformCouponReservationInTx(tx, booking.id);

    await recordOwnerReliabilityIncident({
      ownerProfileId: booking.property.ownerId,
      bookingId: booking.id,
      category: reliabilityCategory,
      reason: `${params.reasonCode}${params.note ? `: ${params.note}` : ''}`,
      penaltyAmount: preview.ownerPenaltyJod > 0 ? preview.ownerPenaltyJod : undefined,
      tx,
    });

    if (!forceMajeure && preview.ownerPenaltyJod > 0) {
      await createOwnerPenaltyAdjustment({
        ownerProfileId: booking.property.ownerId,
        bookingId: booking.id,
        amount: preview.ownerPenaltyJod,
        type: OwnerFinancialAdjustmentType.owner_cancel_penalty,
        reason: `Owner cancellation (${params.reasonCode})`,
        tx,
      });
    }

    return b;
  });

  await createAuditLog({
    actorUserId: params.ownerUserId,
    action: 'booking.owner_cancelled',
    entityType: 'booking',
    entityId: booking.id,
    metadata: {
      publicCode: booking.publicCode,
      reasonCode: params.reasonCode,
      ...preview,
      note: params.note ?? null,
    },
    req: params.req,
  });

  if (preview.customerRefund > 0) {
    await ensureSystemOwnerFaultRefund({
      bookingId: booking.id,
      customerId: booking.userId,
      refundAmount: preview.customerRefund,
      reasonLabel: 'Owner cancellation — full refund',
      req: params.req,
    });
  }

  const succeeded = await prisma.payment.findMany({
    where: { bookingId: booking.id, status: PaymentStatus.succeeded },
    select: { id: true },
  });
  for (const p of succeeded) {
    await syncPayoutStatusForPayment(p.id);
  }

  await notifyCustomerOwnerCancelled({
    customerUserId: booking.userId,
    bookingId: booking.id,
    publicCode: booking.publicCode,
    refundAmount: preview.customerRefund,
  });
  await notifyOwnerCancelledBooking({
    ownerUserId: params.ownerUserId,
    bookingId: booking.id,
    publicCode: booking.publicCode,
    penaltyJod: preview.ownerPenaltyJod,
  });

  return { booking: updated, preview };
}
