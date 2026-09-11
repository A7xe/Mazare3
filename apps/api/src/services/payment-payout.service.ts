import { BookingStatus, PaymentStatus, PayoutStatus, prisma } from '@mazare3/db';
import { createAuditLog } from './audit.service.js';
import { getBookingOperationsBlock } from '../lib/operations-blocking.js';
import {
  computePayoutAvailableAt,
  resolvePayoutStatus,
} from './payment-policy.service.js';
import { OwnerPayoutRecordStatus } from '@mazare3/db';

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : value.toNumber();
}

/** Recompute and persist payoutStatus when booking period / cancellation state changes. */
export async function syncPayoutStatusForPayment(paymentId: string): Promise<PayoutStatus> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      booking: { include: { slot: { select: { date: true } } } },
    },
  });
  if (!payment) {
    return PayoutStatus.not_ready;
  }

  const retained = decimalToNumber(payment.cancellationPenaltyAmount);
  const ownerNet = decimalToNumber(payment.ownerNetPayoutAmount);
  const isCancellationRetention =
    payment.booking.status === BookingStatus.cancelled &&
    retained > 0 &&
    ownerNet > 0 &&
    (payment.refundStatus === 'none' ||
      payment.refundStatus === 'processed' ||
      payment.refundStatus === 'rejected');

  if (
    !isCancellationRetention &&
    (payment.purpose === 'deposit' || payment.booking.paymentState !== 'fully_paid')
  ) {
    if (payment.payoutStatus !== PayoutStatus.not_ready || payment.payoutAvailableAt) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { payoutStatus: PayoutStatus.not_ready, payoutAvailableAt: null },
      });
    }
    return PayoutStatus.not_ready;
  }

  let payoutAvailableAt = payment.payoutAvailableAt;
  if (payment.status === PaymentStatus.succeeded && !payoutAvailableAt) {
    payoutAvailableAt = computePayoutAvailableAt(payment.booking.slot.date);
  }

  const block = await getBookingOperationsBlock(payment.bookingId);
  const paidRecord = await prisma.ownerPayout.findUnique({
    where: { paymentId },
    select: { status: true },
  });

  let next = resolvePayoutStatus({
    paymentSucceeded: payment.status === PaymentStatus.succeeded,
    bookingFullyPaid: isCancellationRetention
      ? true
      : payment.booking.paymentState === 'fully_paid',
    bookingCancelled: payment.booking.status === BookingStatus.cancelled,
    refundStatus: payment.refundStatus,
    payoutAvailableAt,
  });

  if (paidRecord?.status === OwnerPayoutRecordStatus.paid) {
    next = PayoutStatus.paid;
  } else if (block.blocked) {
    next = PayoutStatus.blocked;
    if (payment.payoutStatus !== PayoutStatus.blocked) {
      await createAuditLog({
        action: 'payout.blocked',
        entityType: 'payment',
        entityId: paymentId,
        metadata: { bookingId: payment.bookingId, reason: block.reason },
      });
    }
  }

  if (next !== payment.payoutStatus || payoutAvailableAt !== payment.payoutAvailableAt) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        payoutStatus: next,
        payoutAvailableAt,
      },
    });
    if (next === PayoutStatus.eligible && payment.payoutStatus !== PayoutStatus.eligible) {
      await createAuditLog({
        action: 'payout.eligible',
        entityType: 'payment',
        entityId: paymentId,
        metadata: { bookingId: payment.bookingId },
      });
    }
  }

  return next;
}
