import { PayoutStatus } from '@mazare3/db';
import {
  calculateBookingFinancialSnapshot,
  calculatePlatformFundedSnapshot,
  computeBalanceDueAt,
  computeBalanceDueAtFromStart,
  evaluateCancellationSettlement,
  hoursUntilInstant,
  resolveBookingPeriodStart,
  resolveCancellationPolicyHours,
  resolvePaymentPlan,
  type BookingFinancialSnapshot,
  type CancellationSettlement,
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

export type CancellationPolicyResult = CancellationSettlement & {
  refundableAmount: number;
  cancellationPenaltyAmount: number;
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
  hoursUntilStart?: number;
}) {
  const config = loadPaymentPolicyConfig();
  const depositPercentRaw = resolveDepositPercent(params.propertyDepositPercent);
  const hoursUntilStart =
    params.hoursUntilStart ??
    hoursUntilBookingStart(params.bookingStartAt, params.slotDate);
  const plan = resolvePaymentPlan({
    hoursUntilStart,
    customerPayable: params.merchantBookingValue - params.platformDiscountAmount,
    depositPercent: depositPercentRaw,
  });
  const snapshot = calculatePlatformFundedSnapshot({
    merchantBookingValue: params.merchantBookingValue,
    platformDiscountAmount: params.platformDiscountAmount,
    depositPercent: plan.fullPaymentRequired ? 100 : plan.depositPercent,
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
    fullPaymentRequired: plan.fullPaymentRequired,
  };
}

export function buildBookingFinancialSnapshot(params: {
  bookingTotalAmount: number;
  propertyDepositPercent?: number | null;
  fullPayment?: boolean;
  slotDate: Date;
  bookingStartAt?: Date | null;
  platformCommissionPercent?: number;
  hoursUntilStart?: number;
}): BookingFinancialSnapshot & { balanceDueAt: Date; fullPaymentRequired: boolean } {
  const config = loadPaymentPolicyConfig();
  const depositPercentRaw = resolveDepositPercent(params.propertyDepositPercent);
  const hoursUntilStart =
    params.hoursUntilStart ??
    hoursUntilBookingStart(params.bookingStartAt, params.slotDate);
  const plan = resolvePaymentPlan({
    hoursUntilStart,
    customerPayable: params.bookingTotalAmount,
    depositPercent: depositPercentRaw,
  });
  const fullPayment = params.fullPayment ?? plan.fullPaymentRequired;
  const snapshot = calculateBookingFinancialSnapshot({
    bookingTotalAmount: params.bookingTotalAmount,
    depositPercent: fullPayment ? 100 : plan.depositPercent,
    platformCommissionPercent:
      params.platformCommissionPercent ?? config.platformCommissionPercent,
    customerServiceFeePercent: config.customerServiceFeePercent,
    currency: config.currency,
    fullPayment,
  });
  const balanceDueAt = params.bookingStartAt
    ? computeBalanceDueAtFromStart(params.bookingStartAt, config.balanceDueHoursBeforeStart)
    : computeBalanceDueAt(params.slotDate, config.balanceDueHoursBeforeStart);
  return {
    ...snapshot,
    balanceDueAt,
    fullPaymentRequired: fullPayment,
  };
}

/** @deprecated Prefer buildBookingFinancialSnapshot - kept for callers that only need totals. */
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
  return resolveBookingPeriodStart(null, slotDate);
}

export function hoursUntilBookingStart(
  bookingStartAt: Date | null | undefined,
  slotDate: Date,
  now = new Date(),
): number {
  return hoursUntilInstant(resolveBookingPeriodStart(bookingStartAt, slotDate), now);
}

function settlementToPolicyResult(settlement: CancellationSettlement): CancellationPolicyResult {
  return {
    ...settlement,
    refundableAmount: settlement.customerRefund,
    cancellationPenaltyAmount: settlement.retainedAmount,
  };
}

export function evaluateCancellationPolicy(
  merchantBookingValue: number,
  capturedAmount: number,
  bookingStartAt: Date | null | undefined,
  slotDate: Date,
  commissionPercent: number,
  now = new Date(),
  options?: {
    originalBookingStartAt?: Date | null;
    applyRescheduleAnchor?: boolean;
  },
): CancellationPolicyResult {
  const currentStart = resolveBookingPeriodStart(bookingStartAt, slotDate);
  const hours =
    options?.applyRescheduleAnchor !== false && options?.originalBookingStartAt
      ? resolveCancellationPolicyHours({
          currentBookingStartAt: currentStart,
          originalBookingStartAt: options.originalBookingStartAt,
          applyRescheduleAnchor: true,
          now,
        })
      : hoursUntilBookingStart(bookingStartAt, slotDate, now);
  return settlementToPolicyResult(
    evaluateCancellationSettlement({
      merchantBookingValue,
      capturedAmount,
      hoursUntilStart: hours,
      commissionPercent,
    }),
  );
}

export function computePayoutAvailableAt(slotDate: Date): Date {
  const config = loadPaymentPolicyConfig();
  const end = new Date(slotDate);
  end.setUTCHours(23, 59, 59, 999);
  end.setTime(end.getTime() + config.ownerPayoutDelayHours * 60 * 60 * 1000);
  return end;
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
    params.refundStatus !== 'rejected' &&
    params.refundStatus !== 'processed'
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
    platformVerifiedCommissionPercent: c.platformVerifiedCommissionPercent,
    customerServiceFeePercent: c.customerServiceFeePercent,
    defaultDepositPercent: c.defaultDepositPercent,
    fullPaymentWithinHours: c.fullPaymentWithinHours,
    balanceDueHoursBeforeStart: c.balanceDueHoursBeforeStart,
    cancellationFreeUntilHours: c.cancellationFreeUntilHours,
    cancellationCharge30UntilHours: c.cancellationCharge30UntilHours,
    cancellationCharge50UntilHours: c.cancellationCharge50UntilHours,
    cancellationChargePercents: {
      free: 0,
      tier30: 30,
      tier50: 50,
      tier100: 100,
    },
  };
}
