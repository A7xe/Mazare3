import {
  prisma,
  BookingPaymentState,
  BookingStatus,
  PaymentCollectionMode,
  PaymentPurpose,
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
import { reconcilePayTabsPayment } from './paytabs-reconciliation.service.js';
import { AppError } from '../lib/errors.js';

export { releaseSlotIfUnheld } from '../lib/slot-release.js';

/**
 * Before unpaid-balance auto-cancel, reconcile any open Balance payments with the PSP
 * so a successful capture that has not yet updated local state is not cancelled away.
 * Browser return is never treated as truth — only trusted query/webhook finalization.
 *
 * Phase 3C.4E.2C — if provider is unreachable / state remains open after reconcile attempts,
 * defer destructive cancel (do not guess unpaid).
 */
async function reconcileOpenBalancePaymentsBeforeAutoCancel(
  bookingId: string,
): Promise<'clear' | 'deferred'> {
  const openBalancePayments = await prisma.payment.findMany({
    where: {
      bookingId,
      purpose: PaymentPurpose.balance,
      status: { in: [PaymentStatus.initiated, PaymentStatus.pending] },
      providerRef: { not: null },
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });

  let providerUncertain = false;
  for (const payment of openBalancePayments) {
    try {
      await reconcilePayTabsPayment(payment.id, {
        actorUserId: null,
        source: 'scheduled_job',
      });
    } catch (err) {
      const code = err instanceof AppError ? err.code : '';
      const msg = err instanceof Error ? err.message : String(err);
      const uncertain =
        code === 'PAYMENT_PROVIDER_ERROR' ||
        /timeout|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|503|502|504|network|unavailable|PAYTABS_HTTP/i.test(
          msg,
        );
      if (uncertain) {
        providerUncertain = true;
        console.warn(
          `[auto-cancel-unpaid-balances] provider uncertain payment=${payment.id}`,
          msg,
        );
      } else {
        console.warn(
          `[auto-cancel-unpaid-balances] reconcile skipped payment=${payment.id}`,
          msg,
        );
      }
    }
  }

  if (providerUncertain) return 'deferred';

  const stillOpenWithProvider = await prisma.payment.count({
    where: {
      bookingId,
      purpose: PaymentPurpose.balance,
      status: { in: [PaymentStatus.initiated, PaymentStatus.pending] },
      providerRef: { not: null },
    },
  });
  if (stillOpenWithProvider > 0) return 'deferred';

  return 'clear';
}

export async function autoCancelUnpaidBalanceIfNeeded(
  bookingId: string,
): Promise<'cancelled' | 'deferred' | 'skipped'> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      property: {
        select: {
          titleAr: true,
          titleEn: true,
          owner: { select: { userId: true } },
        },
      },
      payments: { select: { id: true, status: true, amount: true, purpose: true } },
    },
  });
  if (!booking) return 'skipped';
  if (booking.status !== BookingStatus.confirmed) return 'skipped';
  if (booking.paymentCollectionMode !== PaymentCollectionMode.deposit_balance) return 'skipped';
  if (booking.paymentState === BookingPaymentState.fully_paid) return 'skipped';
  if (booking.paymentState === BookingPaymentState.refunded) return 'skipped';
  if (
    booking.paymentState !== BookingPaymentState.deposit_paid &&
    booking.paymentState !== BookingPaymentState.balance_pending &&
    booking.paymentState !== BookingPaymentState.balance_overdue
  ) {
    return 'skipped';
  }
  if (!booking.balanceDueAt || booking.balanceDueAt > new Date()) return 'skipped';

  // Trusted PSP reconciliation before cancellation (race with late webhooks / provider outage).
  const reconcileOutcome = await reconcileOpenBalancePaymentsBeforeAutoCancel(bookingId);
  if (reconcileOutcome === 'deferred') {
    await createAuditLog({
      action: 'booking.balance_cancel_deferred',
      entityType: 'booking',
      entityId: bookingId,
      metadata: {
        publicCode: booking.publicCode,
        reason: 'PROVIDER_STATE_UNCERTAIN_OR_PENDING',
        balanceDueAt: booking.balanceDueAt.toISOString(),
        initiatingJob: 'auto-cancel-unpaid-balances',
      },
    });
    return 'deferred';
  }

  const afterReconcile = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { status: true, paymentState: true, balanceDueAt: true },
  });
  if (!afterReconcile) return 'skipped';
  if (afterReconcile.status !== BookingStatus.confirmed) return 'skipped';
  if (afterReconcile.paymentState === BookingPaymentState.fully_paid) return 'skipped';
  if (!afterReconcile.balanceDueAt || afterReconcile.balanceDueAt > new Date()) return 'skipped';
  if (
    afterReconcile.paymentState !== BookingPaymentState.deposit_paid &&
    afterReconcile.paymentState !== BookingPaymentState.balance_pending &&
    afterReconcile.paymentState !== BookingPaymentState.balance_overdue
  ) {
    return 'skipped';
  }

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
    if (
      current.paymentState !== BookingPaymentState.deposit_paid &&
      current.paymentState !== BookingPaymentState.balance_pending &&
      current.paymentState !== BookingPaymentState.balance_overdue
    ) {
      return false;
    }

    // If a Balance payment already succeeded locally, never auto-cancel.
    const balanceSucceeded = current.payments.some(
      (p) => p.purpose === PaymentPurpose.balance && p.status === PaymentStatus.succeeded,
    );
    if (balanceSucceeded) return false;

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
    return {
      retainedAmount,
      platformRetained,
      ownerRetained,
      commissionPercent,
      capturedAmount: retainedAmount,
      balanceDueAt: current.balanceDueAt,
    };
  });

  if (!cancelled) return 'skipped';

  await createAuditLog({
    action: 'booking.auto_cancelled',
    entityType: 'booking',
    entityId: bookingId,
    metadata: {
      publicCode: booking.publicCode,
      reason: BOOKING_CANCELLATION_REASON.BALANCE_NOT_PAID,
      reasonLabel: 'Automatic — remaining balance unpaid by deadline',
      actor: 'SYSTEM',
      initiatingJob: 'auto-cancel-unpaid-balances',
      balanceDueAt: cancelled.balanceDueAt.toISOString(),
      executedAt: new Date().toISOString(),
      capturedAmount: cancelled.capturedAmount,
      retainedAmount: cancelled.retainedAmount,
      platformRetained: cancelled.platformRetained,
      ownerRetained: cancelled.ownerRetained,
      platformCommissionPercent: cancelled.commissionPercent,
    },
  });

  await notifyBalanceOverdue({
    customerUserId: booking.userId,
    ownerUserId: booking.property.owner.userId,
    bookingId: booking.id,
    publicCode: booking.publicCode,
    propertyTitleAr: booking.property.titleAr,
    propertyTitleEn: booking.property.titleEn ?? booking.property.titleAr,
  }).catch((err) => console.error('[notifications] balance_unpaid_auto_cancel', err));

  const succeeded = await prisma.payment.findMany({
    where: { bookingId, status: PaymentStatus.succeeded },
    select: { id: true },
  });
  for (const p of succeeded) {
    await syncPayoutStatusForPayment(p.id);
  }

  return 'cancelled';
}

/** @deprecated Phase 1 auto-cancels unpaid balances at due time — kept as alias. */
export async function markBalanceOverdueIfNeeded(bookingId: string): Promise<boolean> {
  return (await autoCancelUnpaidBalanceIfNeeded(bookingId)) === 'cancelled';
}

export async function markStaleBalanceOverdue(): Promise<{
  processed: number;
  marked: number;
  deferred: number;
}> {
  const now = new Date();
  const batchSize = 50;
  const candidates = await prisma.booking.findMany({
    where: {
      status: BookingStatus.confirmed,
      paymentCollectionMode: PaymentCollectionMode.deposit_balance,
      paymentState: {
        in: [
          BookingPaymentState.deposit_paid,
          BookingPaymentState.balance_pending,
          BookingPaymentState.balance_overdue,
        ],
      },
      // Inclusive of the exact -48h instant (matches autoCancelUnpaidBalanceIfNeeded).
      balanceDueAt: { lte: now },
    },
    select: { id: true },
    orderBy: { balanceDueAt: 'asc' },
    take: batchSize,
  });
  let marked = 0;
  let deferred = 0;
  for (const { id } of candidates) {
    const outcome = await autoCancelUnpaidBalanceIfNeeded(id);
    if (outcome === 'cancelled') marked++;
    else if (outcome === 'deferred') deferred++;
  }
  return { processed: candidates.length, marked, deferred };
}

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
      holdExpiresAt: { lte: new Date() },
    },
    select: { id: true },
    orderBy: { holdExpiresAt: 'asc' },
    take: 50,
  });
  let expired = 0;
  for (const { id } of candidates) {
    if (await expireUnpaidBookingHoldIfNeeded(id)) expired++;
  }
  return { processed: candidates.length, expired };
}

export async function refreshBookingPaymentLifecycle(bookingId: string): Promise<void> {
  await expireOwnerApprovalIfNeeded(bookingId);
  await expireUnpaidBookingHoldIfNeeded(bookingId);
  await autoCancelUnpaidBalanceIfNeeded(bookingId);
  const { expireRescheduleRequestsForBooking } = await import('./reschedule.service.js');
  await expireRescheduleRequestsForBooking(bookingId);
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
