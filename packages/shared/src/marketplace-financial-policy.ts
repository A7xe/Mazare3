import { filsToJod, jodToFils, percentOfFils } from './money';

/** Phase 1 — Mazare3 Jordan Fair Marketplace financial policy (SSOT). */
export const STANDARD_COMMISSION_PERCENT = 18;
export const VERIFIED_COMMISSION_PERCENT = 15;
export const DEPOSIT_PERCENT = 30;
export const FULL_PAYMENT_WITHIN_HOURS = 72;
export const BALANCE_DUE_HOURS_BEFORE_START = 48;

/** Customer cancellation charge tiers (% of merchant booking value). */
export const CANCELLATION_FREE_UNTIL_HOURS = 72;
export const CANCELLATION_CHARGE_30_UNTIL_HOURS = 48;
export const CANCELLATION_CHARGE_50_UNTIL_HOURS = 24;

export const CANCELLATION_CHARGE_PERCENT_FREE = 0;
export const CANCELLATION_CHARGE_PERCENT_TIER_30 = 30;
export const CANCELLATION_CHARGE_PERCENT_TIER_50 = 50;
export const CANCELLATION_CHARGE_PERCENT_TIER_100 = 100;

export const BOOKING_CANCELLATION_REASON = {
  BALANCE_NOT_PAID: 'BALANCE_NOT_PAID',
  CUSTOMER_CANCEL: 'CUSTOMER_CANCEL',
} as const;

export type BookingCancellationReasonCode =
  (typeof BOOKING_CANCELLATION_REASON)[keyof typeof BOOKING_CANCELLATION_REASON];

export function roundPolicyMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return filsToJod(jodToFils(value));
}

export function hoursUntilInstant(start: Date, now = new Date()): number {
  return (start.getTime() - now.getTime()) / (60 * 60 * 1000);
}

export function resolveBookingPeriodStart(
  bookingStartAt: Date | null | undefined,
  slotDate: Date,
): Date {
  if (bookingStartAt) return bookingStartAt;
  const d = new Date(slotDate);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function resolveCommissionPercentForListing(
  verificationStatus?: string | null,
): number {
  return verificationStatus === 'platform_verified'
    ? VERIFIED_COMMISSION_PERCENT
    : STANDARD_COMMISSION_PERCENT;
}

export function resolveCancellationChargePercent(hoursUntilStart: number): number {
  if (hoursUntilStart > CANCELLATION_FREE_UNTIL_HOURS) return CANCELLATION_CHARGE_PERCENT_FREE;
  if (hoursUntilStart > CANCELLATION_CHARGE_30_UNTIL_HOURS) return CANCELLATION_CHARGE_PERCENT_TIER_30;
  if (hoursUntilStart > CANCELLATION_CHARGE_50_UNTIL_HOURS) return CANCELLATION_CHARGE_PERCENT_TIER_50;
  if (hoursUntilStart > 0) return CANCELLATION_CHARGE_PERCENT_TIER_100;
  return CANCELLATION_CHARGE_PERCENT_TIER_100;
}

export type PaymentPlanResolution = {
  fullPaymentRequired: boolean;
  depositPercent: number;
  depositAmount: number;
  balanceAmount: number;
  customerPayable: number;
};

export function resolvePaymentPlan(params: {
  hoursUntilStart: number;
  customerPayable: number;
  depositPercent?: number;
}): PaymentPlanResolution {
  const payable = roundPolicyMoney(params.customerPayable);
  const configuredDeposit = params.depositPercent ?? DEPOSIT_PERCENT;
  const fullPaymentRequired = params.hoursUntilStart <= FULL_PAYMENT_WITHIN_HOURS;

  if (fullPaymentRequired) {
    return {
      fullPaymentRequired: true,
      depositPercent: 100,
      depositAmount: payable,
      balanceAmount: 0,
      customerPayable: payable,
    };
  }

  const depositPercent = configuredDeposit;
  const depositAmount = roundPolicyMoney((payable * depositPercent) / 100);
  return {
    fullPaymentRequired: false,
    depositPercent,
    depositAmount,
    balanceAmount: roundPolicyMoney(Math.max(0, payable - depositAmount)),
    customerPayable: payable,
  };
}

export type CancellationSettlement = {
  canCancel: boolean;
  tier: 'free' | 'partial' | 'late' | 'past';
  chargePercent: number;
  policyChargeAmount: number;
  retainedAmount: number;
  customerRefund: number;
  platformRetained: number;
  ownerRetained: number;
  hoursUntilStart: number;
  refundPercent: number;
  reason?: string;
};

export function distributeRetainedAmount(
  retained: number,
  commissionPercent: number,
): { platformRetained: number; ownerRetained: number } {
  const retainedFils = jodToFils(retained);
  const platformFils = percentOfFils(retainedFils, commissionPercent);
  return {
    platformRetained: filsToJod(platformFils),
    ownerRetained: filsToJod(retainedFils - platformFils),
  };
}

export function evaluateCancellationSettlement(params: {
  merchantBookingValue: number;
  capturedAmount: number;
  hoursUntilStart: number;
  commissionPercent: number;
}): CancellationSettlement {
  const merchant = roundPolicyMoney(params.merchantBookingValue);
  const captured = roundPolicyMoney(params.capturedAmount);
  const hours = params.hoursUntilStart;

  if (hours <= 0) {
    return {
      canCancel: false,
      tier: 'past',
      chargePercent: CANCELLATION_CHARGE_PERCENT_TIER_100,
      policyChargeAmount: merchant,
      retainedAmount: captured,
      customerRefund: 0,
      platformRetained: 0,
      ownerRetained: 0,
      hoursUntilStart: hours,
      refundPercent: 0,
      reason: 'Booking period has already started or passed',
    };
  }

  const chargePercent = resolveCancellationChargePercent(hours);
  const policyChargeAmount = roundPolicyMoney((merchant * chargePercent) / 100);
  const retainedAmount = roundPolicyMoney(Math.min(captured, policyChargeAmount));
  const customerRefund = roundPolicyMoney(Math.max(0, captured - retainedAmount));
  const { platformRetained, ownerRetained } = distributeRetainedAmount(
    retainedAmount,
    params.commissionPercent,
  );

  let tier: CancellationSettlement['tier'];
  if (chargePercent === 0) tier = 'free';
  else if (chargePercent === 100) tier = 'late';
  else tier = 'partial';

  const refundPercent =
    captured > 0 ? roundPolicyMoney((customerRefund / captured) * 100) : 0;

  return {
    canCancel: true,
    tier,
    chargePercent,
    policyChargeAmount,
    retainedAmount,
    customerRefund,
    platformRetained,
    ownerRetained,
    hoursUntilStart: hours,
    refundPercent,
  };
}
