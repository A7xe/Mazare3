import {
  prisma,
  BookingPaymentState,
  BookingStatus,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  RefundStatus,
} from '@mazare3/db';
import { releaseSlotIfUnheld } from '../lib/slot-release.js';
import {
  BOOKING_CANCELLATION_REASON,
  distributeRetainedAmount,
  filsToJod,
} from '@mazare3/shared';
import { createAuditLog } from './audit.service.js';
import { notifyBalanceOverdue } from './notification.service.js';
import { expireOwnerApprovalIfNeeded } from './owner-approval-expiry.service.js';
import { releaseCouponReservationInTx } from './coupon.service.js';
import { releasePlatformCouponReservationInTx } from './platform-coupon.service.js';
import { refundableCapturedFils } from '../lib/booking-ledger.js';
import { computePayoutAvailableAt } from './payment-policy.service.js';
import { syncPayoutStatusForPayment } from './payment-payout.service.js';

export { releaseSlotIfUnheld } from '../lib/slot-release.js';

export async function expireUnpaidBookingHoldIfNeeded(bookingId: string): Promise<boolean> {
  const peek = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { status: true, holdExpiresAt: true },
  });
  if (!peek) return false;
  if (peek.status !== BookingStatus.pending_payment) return false;
  if (!peek.holdExpiresAt || peek.holdExpiresAt > new Date()) return false;

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`);
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        payments: { select: { id: true, status: true } },
      },
    });
    if (!booking) return false;
    if (booking.status !== BookingStatus.pending_payment) return false;
    if (!booking.holdExpiresAt || booking.holdExpiresAt > new Date()) return false;

    const hasSucceeded = booking.payments.some((p) => p.status === PaymentStatus.succeeded);
    if (hasSucceeded) return false;

    const expired = await tx.booking.updateMany({
      where: {
        id: bookingId,
        status: BookingStatus.pending_payment,
        paymentState: {
          in: [BookingPaymentState.unpaid, BookingPaymentState.deposit_pending],
        },
      },
      data: { status: BookingStatus.expired, paymentState: BookingPaymentState.unpaid },
    });
    if (expired.count !== 1) return false;

    await tx.payment.updateMany({
      where: {
        bookingId,
        status: { in: [PaymentStatus.initiated, PaymentStatus.pending] },
      },
      data: { status: PaymentStatus.expired },
    });

    await releaseSlotIfUnheld(tx, booking.availabilitySlotId, bookingId);
    await releaseCouponReservationInTx(tx, bookingId);
    await releasePlatformCouponReservationInTx(tx, bookingId);
    return true;
  }).then(async (didExpire) => {
    if (didExpire) {
      await createAuditLog({
        action: 'booking.expired',
        entityType: 'booking',
        entityId: bookingId,
        metadata: { reason: 'hold_expired' },
      });
    }
    return didExpire;
  });
}

export async function expireStaleBookingHolds(): Promise<{ processed: number; expired: number }> {
  const candidates = await prisma.booking.findMany({
    where: {
      status: BookingStatus.pending_payment,
      holdExpiresAt: { lt: new Date() },
    },
    select: { id: true },
  });
  let expired = 0;
  for (const { id } of candidates) {
    if (await expireUnpaidBookingHoldIfNeeded(id)) expired++;
  }
  return { processed: candidates.length, expired };
}

export async function autoCancelUnpaidBalanceIfNeeded(bookingId: string): Promise<boolean> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      property: { select: { titleAr: true, titleEn: true } },
      payments: { select: { id: true, status: true, amount: true } },
    },
  });
  if (!booking) return false;
  if (booking.status !== BookingStatus.confirmed) return false;
  if (booking.paymentState === BookingPaymentState.fully_paid) return false;
  if (booking.paymentState === BookingPaymentState.refunded) return false;
  if (
    booking.paymentState !== BookingPaymentState.deposit_paid &&
    booking.paymentState !== BookingPaymentState.balance_pending &&
    booking.paymentState !== BookingPaymentState.balance_overdue
  ) {
    return false;
  }
  if (!booking.balanceDueAt || booking.balanceDueAt > new Date()) return false;

  const cancelled = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`);
    const current = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        payments: true,
        refundRequests: true,
        slot: { select: { date: true } },
      },
    });
    if (!current) return false;
    if (current.status !== BookingStatus.confirmed) return false;
    if (current.paymentState === BookingPaymentState.fully_paid) return false;
    if (!current.balanceDueAt || current.balanceDueAt > new Date()) return false;

    const funds = refundableCapturedFils(current.payments, current.refundRequests);
    const retainedAmount = filsToJod(funds.captured);
    const commissionPercent = Number(current.platformCommissionPercent);
    const { platformRetained, ownerRetained } = distributeRetainedAmount(
      retainedAmount,
      commissionPercent,
    );

    const updated = await tx.booking.updateMany({
      where: {
        id: bookingId,
        status: BookingStatus.confirmed,
        paymentState: {
          in: [
            BookingPaymentState.deposit_paid,
            BookingPaymentState.balance_pending,
            BookingPaymentState.balance_overdue,
          ],
        },
      },
      data: {
        status: BookingStatus.cancelled,
        cancelledAt: new Date(),
        cancellationReasonCode: BOOKING_CANCELLATION_REASON.BALANCE_NOT_PAID,
        paymentState: BookingPaymentState.deposit_paid,
        platformCommissionAmount: platformRetained,
        ownerNetPayoutAmount: ownerRetained,
      },
    });
    if (updated.count !== 1) return false;

    // Unpaid-balance termination: retain captured deposit only; never refund or charge more.
    const payoutAvailableAt = computePayoutAvailableAt(current.slot.date);
    await tx.payment.updateMany({
      where: { bookingId, status: PaymentStatus.succeeded },
      data: {
        refundStatus: RefundStatus.none,
        payoutStatus: PayoutStatus.blocked,
        cancellationRefundAmount: 0,
        cancellationPenaltyAmount: retainedAmount,
        platformCommissionAmount: platformRetained,
        ownerNetPayoutAmount: ownerRetained,
        ownerGrossAmount: retainedAmount,
        payoutAvailableAt,
      },
    });
    await tx.payment.updateMany({
      where: {
        bookingId,
        status: { in: [PaymentStatus.initiated, PaymentStatus.pending] },
      },
      data: { status: PaymentStatus.cancelled },
    });

    await releaseSlotIfUnheld(tx, current.availabilitySlotId, bookingId);
    await releaseCouponReservationInTx(tx, bookingId);
    await releasePlatformCouponReservationInTx(tx, bookingId);
    return { retainedAmount, platformRetained, ownerRetained };
  });

  if (!cancelled) return false;

  await createAuditLog({
    action: 'booking.auto_cancelled',
    entityType: 'booking',
    entityId: bookingId,
    metadata: {
      publicCode: booking.publicCode,
      reason: BOOKING_CANCELLATION_REASON.BALANCE_NOT_PAID,
      balanceDueAt: booking.balanceDueAt.toISOString(),
      retainedAmount: cancelled.retainedAmount,
      platformRetained: cancelled.platformRetained,
      ownerRetained: cancelled.ownerRetained,
    },
  });

  await notifyBalanceOverdue({
    customerUserId: booking.userId,
    bookingId: booking.id,
    publicCode: booking.publicCode,
    propertyTitleAr: booking.property.titleAr,
    propertyTitleEn: booking.property.titleEn ?? booking.property.titleAr,
  }).catch((err) => console.error('[notifications] balance_overdue_cancel', err));

  const succeeded = await prisma.payment.findMany({
    where: { bookingId, status: PaymentStatus.succeeded },
    select: { id: true },
  });
  for (const p of succeeded) {
    await syncPayoutStatusForPayment(p.id);
  }

  return true;
}

/** @deprecated Phase 1 auto-cancels unpaid balances at due time — kept as alias. */
export async function markBalanceOverdueIfNeeded(bookingId: string): Promise<boolean> {
  return autoCancelUnpaidBalanceIfNeeded(bookingId);
}

export async function markStaleBalanceOverdue(): Promise<{ processed: number; marked: number }> {
  const candidates = await prisma.booking.findMany({
    where: {
      status: BookingStatus.confirmed,
      paymentState: {
        in: [
          BookingPaymentState.deposit_paid,
          BookingPaymentState.balance_pending,
          BookingPaymentState.balance_overdue,
        ],
      },
      balanceDueAt: { lt: new Date() },
    },
    select: { id: true },
  });
  let marked = 0;
  for (const { id } of candidates) {
    if (await autoCancelUnpaidBalanceIfNeeded(id)) marked++;
  }
  return { processed: candidates.length, marked };
}

export async function refreshBookingPaymentLifecycle(bookingId: string): Promise<void> {
  await expireOwnerApprovalIfNeeded(bookingId);
  await expireUnpaidBookingHoldIfNeeded(bookingId);
  await autoCancelUnpaidBalanceIfNeeded(bookingId);
}

/** Bookings whose hold, owner-approval, or balance-due clock may have elapsed. */
export function bookingsNeedingLifecycleRefreshWhere(userId: string, now = new Date()) {
  return {
    userId,
    OR: [
      {
        status: BookingStatus.pending_owner_approval,
        ownerApprovalExpiresAt: { lte: now },
      },
      {
        status: BookingStatus.pending_payment,
        holdExpiresAt: { lte: now },
      },
      {
        status: BookingStatus.confirmed,
        paymentState: {
          in: [
            BookingPaymentState.deposit_paid,
            BookingPaymentState.balance_pending,
            BookingPaymentState.balance_overdue,
          ],
        },
        balanceDueAt: { lte: now },
      },
    ],
  } satisfies Prisma.BookingWhereInput;
}
