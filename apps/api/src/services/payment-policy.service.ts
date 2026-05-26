import { PayoutStatus } from '@mazare3/db';
import { loadPaymentPolicyConfig } from '../config/payment-policy.config.js';

export type BookingFinancialBreakdown = {
  bookingTotalAmount: number;
  customerPayableAmount: number;
  platformCommissionAmount: number;
  customerServiceFeeAmount: number;
  ownerGrossAmount: number;
  ownerNetPayoutAmount: number;
  currency: string;
};

export type CancellationPolicyResult = {
  hoursUntilBookingStart: number;
  tier: 'free' | 'partial' | 'late' | 'past';
  refundPercent: number;
  refundableAmount: number;
  cancellationPenaltyAmount: number;
  canCancel: boolean;
  reason?: string;
};

/** Round to 2 decimal places (JOD fils). */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateBookingFinancials(bookingTotalAmount: number): BookingFinancialBreakdown {
  const config = loadPaymentPolicyConfig();
  const bookingTotal = roundMoney(bookingTotalAmount);
  const customerServiceFeeAmount = roundMoney(
    (bookingTotal * config.customerServiceFeePercent) / 100,
  );
  const customerPayableAmount = roundMoney(bookingTotal + customerServiceFeeAmount);
  const platformCommissionAmount = roundMoney(
    (bookingTotal * config.platformCommissionPercent) / 100,
  );
  const ownerGrossAmount = bookingTotal;
  const ownerNetPayoutAmount = roundMoney(bookingTotal - platformCommissionAmount);

  return {
    bookingTotalAmount: bookingTotal,
    customerPayableAmount,
    platformCommissionAmount,
    customerServiceFeeAmount,
    ownerGrossAmount,
    ownerNetPayoutAmount,
    currency: config.currency,
  };
}

/** Booking slot date at 00:00 UTC. */
export function bookingStartAt(slotDate: Date): Date {
  const d = new Date(slotDate);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** End of booking day UTC + owner payout delay. */
export function computePayoutAvailableAt(slotDate: Date): Date {
  const config = loadPaymentPolicyConfig();
  const end = new Date(slotDate);
  end.setUTCHours(23, 59, 59, 999);
  end.setTime(end.getTime() + config.ownerPayoutDelayHours * 60 * 60 * 1000);
  return end;
}

export function hoursUntilBookingStart(slotDate: Date, now = new Date()): number {
  const start = bookingStartAt(slotDate);
  return (start.getTime() - now.getTime()) / (60 * 60 * 1000);
}

export function evaluateCancellationPolicy(
  customerPayableAmount: number,
  slotDate: Date,
  now = new Date(),
): CancellationPolicyResult {
  const config = loadPaymentPolicyConfig();
  const hours = hoursUntilBookingStart(slotDate, now);
  const payable = roundMoney(customerPayableAmount);

  if (hours <= 0) {
    return {
      hoursUntilBookingStart: hours,
      tier: 'past',
      refundPercent: 0,
      refundableAmount: 0,
      cancellationPenaltyAmount: payable,
      canCancel: false,
      reason: 'Booking period has already started or passed',
    };
  }

  let refundPercent: number;
  let tier: CancellationPolicyResult['tier'];

  if (hours >= config.cancellationFreeUntilHours) {
    tier = 'free';
    refundPercent = 100;
  } else if (hours >= config.cancellationPartialUntilHours) {
    tier = 'partial';
    refundPercent = config.cancellationPartialRefundPercent;
  } else {
    tier = 'late';
    refundPercent = config.lateCancellationRefundPercent;
  }

  const refundableAmount = roundMoney((payable * refundPercent) / 100);
  const cancellationPenaltyAmount = roundMoney(payable - refundableAmount);

  return {
    hoursUntilBookingStart: hours,
    tier,
    refundPercent,
    refundableAmount,
    cancellationPenaltyAmount,
    canCancel: true,
  };
}

export function resolvePayoutStatus(params: {
  paymentSucceeded: boolean;
  bookingCancelled: boolean;
  refundStatus: string;
  payoutAvailableAt: Date | null;
  now?: Date;
}): PayoutStatus {
  if (!params.paymentSucceeded) {
    return PayoutStatus.not_ready;
  }
  if (
    params.bookingCancelled &&
    params.refundStatus !== 'none' &&
    params.refundStatus !== 'rejected'
  ) {
    return PayoutStatus.blocked;
  }
  const now = params.now ?? new Date();
  if (!params.payoutAvailableAt || now < params.payoutAvailableAt) {
    return PayoutStatus.pending;
  }
  return PayoutStatus.eligible;
}

export function getPublicPolicySummary() {
  const c = loadPaymentPolicyConfig();
  return {
    mode: c.mode,
    currency: c.currency,
    platformCommissionPercent: c.platformCommissionPercent,
    customerServiceFeePercent: c.customerServiceFeePercent,
    cancellationFreeUntilHours: c.cancellationFreeUntilHours,
    cancellationPartialUntilHours: c.cancellationPartialUntilHours,
    cancellationPartialRefundPercent: c.cancellationPartialRefundPercent,
    lateCancellationRefundPercent: c.lateCancellationRefundPercent,
  };
}
