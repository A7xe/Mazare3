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
  OWNER_CANCEL: 'OWNER_CANCEL',
  FORCE_MAJEURE: 'FORCE_MAJEURE',
  CUSTOMER_NO_SHOW: 'CUSTOMER_NO_SHOW',
  OWNER_NO_SHOW: 'OWNER_NO_SHOW',
  ACCESS_DENIED: 'ACCESS_DENIED',
} as const;

export type BookingCancellationReasonCode =
  (typeof BOOKING_CANCELLATION_REASON)[keyof typeof BOOKING_CANCELLATION_REASON];

/** Phase 2 — owner cancellation reason taxonomy (stored on incidents / audit). */
export const OWNER_CANCELLATION_REASON = {
  PROPERTY_UNAVAILABLE: 'PROPERTY_UNAVAILABLE',
  OWNER_EMERGENCY: 'OWNER_EMERGENCY',
  MAINTENANCE_FAILURE: 'MAINTENANCE_FAILURE',
  DOUBLE_BOOKING_OWNER_FAULT: 'DOUBLE_BOOKING_OWNER_FAULT',
  PROPERTY_DAMAGE: 'PROPERTY_DAMAGE',
  ACCESS_PROBLEM: 'ACCESS_PROBLEM',
  FORCE_MAJEURE: 'FORCE_MAJEURE',
  OTHER: 'OTHER',
} as const;

export type OwnerCancellationReasonCode =
  (typeof OWNER_CANCELLATION_REASON)[keyof typeof OWNER_CANCELLATION_REASON];

/** Phase 2 — owner penalty tiers (% of merchant booking value). */
export const OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS = 72;
export const OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS = 24;
export const OWNER_CANCEL_PENALTY_PERCENT_FREE = 0;
export const OWNER_CANCEL_PENALTY_PERCENT_TIER_10 = 10;
export const OWNER_CANCEL_PENALTY_PERCENT_TIER_20 = 20;
export const OWNER_PENALTY_MIN_JOD = 10;
export const OWNER_PENALTY_MAX_JOD = 50;

/** Grace after booking start before customer no-show may be finalized. */
export const CUSTOMER_NO_SHOW_GRACE_MINUTES = 60;

/** Normal customer-initiated successful reschedules per booking. */
export const MAX_CUSTOMER_RESCHEDULES = 1;

/** Check-in PIN becomes available this many hours before booking start. */
export const CHECK_IN_OPEN_HOURS_BEFORE_START = 2;

/** Check-in code expires this many minutes after booking start. */
export const CHECK_IN_EXPIRE_MINUTES_AFTER_START = 120;

export const OWNER_RELIABILITY_CATEGORY = {
  OWNER_CANCEL: 'owner_cancel',
  OWNER_NO_SHOW: 'owner_no_show',
  ACCESS_DENIED: 'access_denied',
  APPROVAL_TIMEOUT: 'approval_timeout',
  FORCE_MAJEURE: 'force_majeure',
  ADMIN_CONFIRMED: 'admin_confirmed',
  WAIVED: 'waived',
} as const;

export type OwnerReliabilityCategory =
  (typeof OWNER_RELIABILITY_CATEGORY)[keyof typeof OWNER_RELIABILITY_CATEGORY];

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

export function resolveOwnerCancelPenaltyPercent(
  hoursUntilStart: number | 'owner_no_show',
): number {
  if (hoursUntilStart === 'owner_no_show') return OWNER_CANCEL_PENALTY_PERCENT_TIER_20;
  if (hoursUntilStart > OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS) return OWNER_CANCEL_PENALTY_PERCENT_FREE;
  if (hoursUntilStart > OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS) return OWNER_CANCEL_PENALTY_PERCENT_TIER_10;
  return OWNER_CANCEL_PENALTY_PERCENT_TIER_20;
}

export function calculateOwnerPenaltyJod(
  merchantValue: number,
  hoursUntilStart: number | 'owner_no_show',
): number {
  const merchant = roundPolicyMoney(merchantValue);
  const percent = resolveOwnerCancelPenaltyPercent(hoursUntilStart);
  if (percent === 0) return 0;
  const raw = roundPolicyMoney((merchant * percent) / 100);
  if (raw <= 0) return 0;
  return roundPolicyMoney(
    Math.min(OWNER_PENALTY_MAX_JOD, Math.max(OWNER_PENALTY_MIN_JOD, raw)),
  );
}

export function resolveCheckInWindow(
  bookingStartAt: Date,
  now = new Date(),
): {
  status: 'not_open' | 'available' | 'expired';
  opensAt: Date;
  expiresAt: Date;
} {
  const opensAt = new Date(
    bookingStartAt.getTime() - CHECK_IN_OPEN_HOURS_BEFORE_START * 60 * 60 * 1000,
  );
  const expiresAt = new Date(
    bookingStartAt.getTime() + CHECK_IN_EXPIRE_MINUTES_AFTER_START * 60 * 1000,
  );
  if (now < opensAt) return { status: 'not_open', opensAt, expiresAt };
  if (now > expiresAt) return { status: 'expired', opensAt, expiresAt };
  return { status: 'available', opensAt, expiresAt };
}

export function isCustomerNoShowEligible(params: {
  bookingStartAt: Date;
  checkInVerified: boolean;
  graceMinutes?: number;
  now?: Date;
}): boolean {
  const now = params.now ?? new Date();
  if (params.checkInVerified) return false;
  const graceMs = (params.graceMinutes ?? CUSTOMER_NO_SHOW_GRACE_MINUTES) * 60 * 1000;
  return now.getTime() >= params.bookingStartAt.getTime() + graceMs;
}

/**
 * Phase 2 anti-abuse: after a customer-requested reschedule, cancellation tiers use
 * the earlier of the original Booking start and the new Booking start (fewer hours
 * until start / Math.min of remaining hours) — prevents resetting the cancellation
 * clock by moving the booking far forward.
 * Owner/admin force-majeure reschedules pass applyRescheduleAnchor=false to skip.
 */
export function resolveCancellationPolicyHours(params: {
  currentBookingStartAt: Date;
  originalBookingStartAt?: Date | null;
  applyRescheduleAnchor?: boolean;
  now?: Date;
}): number {
  const now = params.now ?? new Date();
  const currentHours = hoursUntilInstant(params.currentBookingStartAt, now);
  if (!params.applyRescheduleAnchor || !params.originalBookingStartAt) {
    return currentHours;
  }
  const originalHours = hoursUntilInstant(params.originalBookingStartAt, now);
  return Math.min(currentHours, originalHours);
}

export function isForceMajeureReason(reason: string | null | undefined): boolean {
  return reason === OWNER_CANCELLATION_REASON.FORCE_MAJEURE;
}

/** Counterparty response window for pending reschedule requests. */
export const RESCHEDULE_COUNTERPARTY_EXPIRE_HOURS = 48;

export type ReschedulePricingMode =
  | 'customer_market'
  | 'owner_price_freeze'
  | 'force_majeure_equivalent'
  | 'force_majeure_upgrade';

/**
 * Phase 3A — compute commercial contracted value, commission basis, and
 * immediate customer payable delta for a reschedule.
 */
export function computeReschedulePricing(params: {
  fromMerchantValue: number;
  toListMerchantValue: number;
  initiatedBy: 'customer' | 'owner' | 'admin';
  forceMajeure?: boolean;
  /** Customer chooses a more expensive FM upgrade (pays market delta). */
  voluntaryUpgrade?: boolean;
}): {
  pricingMode: ReschedulePricingMode;
  customerContractedValue: number;
  commissionBasisValue: number;
  /** >0 pay now, <0 refund obligation magnitude as negative, 0 no immediate money move. */
  customerPayableDelta: number;
  ownerAbsorbsAmount: number;
  /** listTo - from (audit). */
  priceDelta: number;
} {
  const from = roundPolicyMoney(params.fromMerchantValue);
  const to = roundPolicyMoney(params.toListMerchantValue);
  const priceDelta = roundPolicyMoney(to - from);

  const isFm = params.forceMajeure === true || params.initiatedBy === 'admin';
  const voluntaryUpgrade = params.voluntaryUpgrade === true;

  // Customer-initiated (not FM): market pricing
  if (params.initiatedBy === 'customer' && !isFm) {
    return {
      pricingMode: 'customer_market',
      customerContractedValue: to,
      commissionBasisValue: to,
      customerPayableDelta: priceDelta,
      ownerAbsorbsAmount: 0,
      priceDelta,
    };
  }

  // FM voluntary upgrade: customer pays market delta
  if (isFm && voluntaryUpgrade) {
    return {
      pricingMode: 'force_majeure_upgrade',
      customerContractedValue: to,
      commissionBasisValue: to,
      customerPayableDelta: priceDelta,
      ownerAbsorbsAmount: 0,
      priceDelta,
    };
  }

  // Owner-initiated OR FM equivalent: never increase customer price
  const pricingMode: ReschedulePricingMode = isFm
    ? 'force_majeure_equivalent'
    : 'owner_price_freeze';

  if (to > from) {
    return {
      pricingMode,
      customerContractedValue: from,
      commissionBasisValue: from,
      customerPayableDelta: 0,
      ownerAbsorbsAmount: roundPolicyMoney(to - from),
      priceDelta,
    };
  }

  // to <= from: contracted drops; refund difference when lower
  return {
    pricingMode,
    customerContractedValue: to,
    commissionBasisValue: to,
    customerPayableDelta: priceDelta,
    ownerAbsorbsAmount: 0,
    priceDelta,
  };
}
