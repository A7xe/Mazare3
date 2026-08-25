import { PayoutStatus } from '@mazare3/db';
import {
  calculateBookingFinancialSnapshot,
  calculatePlatformFundedSnapshot,
  computeBalanceDueAt,
  computeBalanceDueAtFromStart,
  type BookingFinancialSnapshot,
} from '@mazare3/shared';
import {
  loadPaymentPolicyConfig,
  resolveDepositPercent,
} from '../config/payment-policy.config.js';

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

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function buildPlatformFundedSnapshot(params: {
  merchantBookingValue: number;
  platformDiscountAmount: number;
  propertyDepositPercent?: number | null;
  slotDate: Date;
  bookingStartAt?: Date | null;
  platformCommissionPercent?: number;
}) {
  const config = loadPaymentPolicyConfig();
  const snapshot = calculatePlatformFundedSnapshot({
    merchantBookingValue: params.merchantBookingValue,
    platformDiscountAmount: params.platformDiscountAmount,
    depositPercent: resolveDepositPercent(params.propertyDepositPercent),
    platformCommissionPercent:
      params.platformCommissionPercent ?? config.platformCommissionPercent,
    customerServiceFeePercent: config.customerServiceFeePercent,
    currency: config.currency,
  });
  const balanceDueAt = params.bookingStartAt
    ? computeBalanceDueAtFromStart(params.bookingStartAt, config.balanceDueHoursBeforeStart)
    : computeBalanceDueAt(params.slotDate, config.balanceDueHoursBeforeStart);
  return {
    ...snapshot,
    balanceDueAt,
  };
}

export function buildBookingFinancialSnapshot(params: {
  bookingTotalAmount: number;
  propertyDepositPercent?: number | null;
  fullPayment?: boolean;
  slotDate: Date;
  bookingStartAt?: Date | null;
  platformCommissionPercent?: number;
}): BookingFinancialSnapshot & { balanceDueAt: Date } {
  const config = loadPaymentPolicyConfig();
  const snapshot = calculateBookingFinancialSnapshot({
    bookingTotalAmount: params.bookingTotalAmount,
    depositPercent: resolveDepositPercent(params.propertyDepositPercent),
    platformCommissionPercent:
      params.platformCommissionPercent ?? config.platformCommissionPercent,
    customerServiceFeePercent: config.customerServiceFeePercent,
    currency: config.currency,
    fullPayment: params.fullPayment,
  });
  const balanceDueAt = params.bookingStartAt
    ? computeBalanceDueAtFromStart(params.bookingStartAt, config.balanceDueHoursBeforeStart)
    : computeBalanceDueAt(params.slotDate, config.balanceDueHoursBeforeStart);
  return {
    ...snapshot,
    balanceDueAt,
  };
}

/** @deprecated Prefer buildBookingFinancialSnapshot — kept for callers that only need totals. */
export function calculateBookingFinancials(bookingTotalAmount: number): BookingFinancialBreakdown {
  const snap = buildBookingFinancialSnapshot({
    bookingTotalAmount,
    fullPayment: true,
    slotDate: new Date(),
  });
  return {
    bookingTotalAmount: snap.bookingTotalAmount,
    customerPayableAmount: snap.customerPayableTotal,
    platformCommissionAmount: snap.platformCommissionAmount,
    customerServiceFeeAmount: snap.customerServiceFeeAmount,
    ownerGrossAmount: snap.ownerGrossAmount,
    ownerNetPayoutAmount: snap.ownerNetPayoutAmount,
    currency: snap.currency,
  };
}

export function snapshotToBreakdown(snap: BookingFinancialSnapshot): BookingFinancialBreakdown {
  return {
    bookingTotalAmount: snap.bookingTotalAmount,
    customerPayableAmount: snap.customerPayableTotal,
    platformCommissionAmount: snap.platformCommissionAmount,
    customerServiceFeeAmount: snap.customerServiceFeeAmount,
    ownerGrossAmount: snap.ownerGrossAmount,
    ownerNetPayoutAmount: snap.ownerNetPayoutAmount,
    currency: snap.currency,
  };
}

export function bookingStartAt(slotDate: Date): Date {
  const d = new Date(slotDate);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

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
  bookingFullyPaid: boolean;
  bookingCancelled: boolean;
  refundStatus: string;
  payoutAvailableAt: Date | null;
  now?: Date;
}): PayoutStatus {
  if (!params.paymentSucceeded || !params.bookingFullyPaid) {
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
    defaultDepositPercent: c.defaultDepositPercent,
    balanceDueHoursBeforeStart: c.balanceDueHoursBeforeStart,
    cancellationFreeUntilHours: c.cancellationFreeUntilHours,
    cancellationPartialUntilHours: c.cancellationPartialUntilHours,
    cancellationPartialRefundPercent: c.cancellationPartialRefundPercent,
    lateCancellationRefundPercent: c.lateCancellationRefundPercent,
  };
}
