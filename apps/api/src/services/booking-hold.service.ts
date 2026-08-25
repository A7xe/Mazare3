import {
  prisma,
  BookingPaymentState,
  BookingStatus,
  PaymentStatus,
  Prisma,
} from '@mazare3/db';
import { releaseSlotIfUnheld } from '../lib/slot-release.js';
import { assertPaymentStateTransition } from '@mazare3/shared';
import { createAuditLog } from './audit.service.js';
import { notifyBalanceOverdue } from './notification.service.js';
import { expireOwnerApprovalIfNeeded } from './owner-approval-expiry.service.js';
import { releaseCouponReservationInTx } from './coupon.service.js';
import { releasePlatformCouponReservationInTx } from './platform-coupon.service.js';

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

export async function markBalanceOverdueIfNeeded(bookingId: string): Promise<boolean> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      property: { select: { titleAr: true, titleEn: true } },
    },
  });
  if (!booking) return false;
  if (booking.status !== BookingStatus.confirmed) return false;
  if (booking.paymentState === BookingPaymentState.fully_paid) return false;
  if (booking.paymentState === BookingPaymentState.refunded) return false;
  if (
    booking.paymentState !== BookingPaymentState.deposit_paid &&
    booking.paymentState !== BookingPaymentState.balance_pending
  ) {
    return false;
  }
  if (!booking.balanceDueAt || booking.balanceDueAt > new Date()) return false;

  assertPaymentStateTransition(booking.paymentState, BookingPaymentState.balance_overdue);
  const marked = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: BookingStatus.confirmed,
      paymentState: {
        in: [BookingPaymentState.deposit_paid, BookingPaymentState.balance_pending],
      },
    },
    data: { paymentState: BookingPaymentState.balance_overdue },
  });
  if (marked.count !== 1) return false;

  await createAuditLog({
    action: 'booking.balance_overdue',
    entityType: 'booking',
    entityId: bookingId,
    metadata: { publicCode: booking.publicCode, balanceDueAt: booking.balanceDueAt.toISOString() },
  });

  await notifyBalanceOverdue({
    customerUserId: booking.userId,
    bookingId: booking.id,
    publicCode: booking.publicCode,
    propertyTitleAr: booking.property.titleAr,
    propertyTitleEn: booking.property.titleEn ?? booking.property.titleAr,
  }).catch((err) => console.error('[notifications] balance_overdue', err));

  return true;
}

export async function markStaleBalanceOverdue(): Promise<{ processed: number; marked: number }> {
  const candidates = await prisma.booking.findMany({
    where: {
      status: BookingStatus.confirmed,
      paymentState: {
        in: [BookingPaymentState.deposit_paid, BookingPaymentState.balance_pending],
      },
      balanceDueAt: { lt: new Date() },
    },
    select: { id: true },
  });
  let marked = 0;
  for (const { id } of candidates) {
    if (await markBalanceOverdueIfNeeded(id)) marked++;
  }
  return { processed: candidates.length, marked };
}

export async function refreshBookingPaymentLifecycle(bookingId: string): Promise<void> {
  await expireOwnerApprovalIfNeeded(bookingId);
  await expireUnpaidBookingHoldIfNeeded(bookingId);
  await markBalanceOverdueIfNeeded(bookingId);
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
          in: [BookingPaymentState.deposit_paid, BookingPaymentState.balance_pending],
        },
        balanceDueAt: { lte: now },
      },
    ],
  } satisfies Prisma.BookingWhereInput;
}
