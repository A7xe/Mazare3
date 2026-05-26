import type { Prisma } from '@mazare3/db';
import { PaymentStatus } from '@mazare3/db';
import type { CancellationPolicyView, PublicBookingSummary } from '@mazare3/shared';
import {
  calculateBookingFinancials,
  evaluateCancellationPolicy,
  type CancellationPolicyResult,
} from '../services/payment-policy.service.js';
import { toPaymentDisplayStatus } from './payment.mapper.js';

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    property: { select: { slug: true; titleAr: true; titleEn: true; approximateAddress: true } };
    slot: { select: { date: true; period: true } };
    payments: { orderBy: { createdAt: 'desc' }; take: 1 };
  };
}>;

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

export function toCancellationPolicyView(
  result: CancellationPolicyResult,
): CancellationPolicyView {
  return {
    canCancel: result.canCancel,
    tier: result.tier,
    refundPercent: result.refundPercent,
    refundableAmount: result.refundableAmount,
    cancellationPenaltyAmount: result.cancellationPenaltyAmount,
    hoursUntilBookingStart: result.hoursUntilBookingStart,
    reason: result.reason,
  };
}

export function toPublicBookingSummary(booking: BookingWithRelations): PublicBookingSummary {
  const latestPayment = booking.payments?.[0];
  const bookingTotal = decimalToNumber(booking.totalAmount);
  const fin = calculateBookingFinancials(bookingTotal);
  const paidInFull =
    booking.status === 'confirmed' && latestPayment?.status === PaymentStatus.succeeded;

  let cancellationPolicy: CancellationPolicyView | null = null;

  if (booking.status === 'pending_payment') {
    cancellationPolicy = {
      canCancel: true,
      tier: 'free',
      refundPercent: 100,
      refundableAmount: fin.customerPayableAmount,
      cancellationPenaltyAmount: 0,
    };
  } else if (paidInFull && latestPayment) {
    const payable = decimalToNumber(latestPayment.customerPayableAmount) || fin.customerPayableAmount;
    cancellationPolicy = toCancellationPolicyView(
      evaluateCancellationPolicy(payable, booking.slot.date),
    );
  }

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
    totalAmount: bookingTotal,
    currency: booking.currency,
    createdAt: booking.createdAt.toISOString(),
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    paymentStatus: toPaymentDisplayStatus(latestPayment, booking.status),
    paymentId: latestPayment?.id ?? null,
    customerPayableAmount: paidInFull
      ? decimalToNumber(latestPayment!.customerPayableAmount)
      : fin.customerPayableAmount,
    paidInFull,
    cancellationPolicy,
    refundRequest: null,
    canRequestRefund: false,
    canOpenDispute: false,
  };
}

export function withBookingOperationsFlags(
  summary: PublicBookingSummary,
  flags: {
    refundRequest: PublicBookingSummary['refundRequest'];
    canRequestRefund: boolean;
    canOpenDispute: boolean;
  },
): PublicBookingSummary {
  return {
    ...summary,
    refundRequest: flags.refundRequest,
    canRequestRefund: flags.canRequestRefund,
    canOpenDispute: flags.canOpenDispute,
  };
}
