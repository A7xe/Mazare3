/**
 * Full snapshot + deposit policy. Amounts computed server-side only.
 * Env fallbacks align with @mazare3/shared marketplace-financial-policy SSOT.
 *
 * Phase 2: commission env overrides require explicit ALLOW_LEGACY_COMMISSION_OVERRIDE=true
 * to prevent silent drift from approved 18% / 15% marketplace rates.
 */

import {
  BALANCE_DUE_HOURS_BEFORE_START,
  CANCELLATION_CHARGE_30_UNTIL_HOURS,
  CANCELLATION_CHARGE_50_UNTIL_HOURS,
  CANCELLATION_FREE_UNTIL_HOURS,
  CUSTOMER_NO_SHOW_GRACE_MINUTES,
  DEPOSIT_PERCENT,
  FULL_PAYMENT_WITHIN_HOURS,
  MAX_CUSTOMER_RESCHEDULES,
  OWNER_PENALTY_MAX_JOD,
  OWNER_PENALTY_MIN_JOD,
  STANDARD_COMMISSION_PERCENT,
  VERIFIED_COMMISSION_PERCENT,
} from '@mazare3/shared';

export type PaymentPolicyConfig = {
  mode: 'deposit_balance';
  currency: string;
  platformCommissionPercent: number;
  platformVerifiedCommissionPercent: number;
  customerServiceFeePercent: number;
  defaultDepositPercent: number;
  fullPaymentWithinHours: number;
  balanceDueHoursBeforeStart: number;
  ownerPayoutDelayHours: number;
  cancellationFreeUntilHours: number;
  cancellationCharge30UntilHours: number;
  cancellationCharge50UntilHours: number;
  /** Phase 2 */
  customerNoShowGraceMinutes: number;
  maxCustomerReschedules: number;
  ownerPenaltyMinJod: number;
  ownerPenaltyMaxJod: number;
};

const LEGACY_OBSOLETE_COMMISSION = 12;

function parsePercent(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : fallback;
}

function parseHours(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseMinutes(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseMoney(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function assertCommissionEnv(name: string, value: number, ssotDefault: number): number {
  if (value === ssotDefault) return value;
  const allowOverride = process.env.ALLOW_LEGACY_COMMISSION_OVERRIDE === 'true';
  if (value === LEGACY_OBSOLETE_COMMISSION || !allowOverride) {
    const msg =
      `[payment-policy] ${name}=${value} diverges from SSOT default ${ssotDefault}. ` +
      `Set ALLOW_LEGACY_COMMISSION_OVERRIDE=true only for intentional non-production overrides.`;
    if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') {
      throw new Error(msg);
    }
    console.error(`FATAL CONFIG: ${msg}`);
    throw new Error(msg);
  }
  console.warn(`[payment-policy] ${name} override active: ${value}% (SSOT ${ssotDefault}%)`);
  return value;
}

let cachedConfig: PaymentPolicyConfig | null = null;

export function loadPaymentPolicyConfig(): PaymentPolicyConfig {
  if (cachedConfig) return cachedConfig;

  const rawStandard = parsePercent(process.env.PLATFORM_COMMISSION_PERCENT, STANDARD_COMMISSION_PERCENT);
  const rawVerified = parsePercent(
    process.env.PLATFORM_VERIFIED_COMMISSION_PERCENT,
    VERIFIED_COMMISSION_PERCENT,
  );

  cachedConfig = {
    mode: 'deposit_balance',
    currency: (process.env.PAYMENT_CURRENCY ?? 'JOD').trim().toUpperCase(),
    platformCommissionPercent: assertCommissionEnv(
      'PLATFORM_COMMISSION_PERCENT',
      rawStandard,
      STANDARD_COMMISSION_PERCENT,
    ),
    platformVerifiedCommissionPercent: assertCommissionEnv(
      'PLATFORM_VERIFIED_COMMISSION_PERCENT',
      rawVerified,
      VERIFIED_COMMISSION_PERCENT,
    ),
    customerServiceFeePercent: parsePercent(process.env.CUSTOMER_SERVICE_FEE_PERCENT, 0),
    defaultDepositPercent: parsePercent(process.env.DEFAULT_DEPOSIT_PERCENT, DEPOSIT_PERCENT),
    fullPaymentWithinHours: parseHours(
      process.env.FULL_PAYMENT_WITHIN_HOURS,
      FULL_PAYMENT_WITHIN_HOURS,
    ),
    balanceDueHoursBeforeStart: parseHours(
      process.env.BALANCE_DUE_HOURS_BEFORE_START,
      BALANCE_DUE_HOURS_BEFORE_START,
    ),
    ownerPayoutDelayHours: parseHours(process.env.OWNER_PAYOUT_DELAY_HOURS, 24),
    cancellationFreeUntilHours: parseHours(
      process.env.CANCELLATION_FREE_UNTIL_HOURS,
      CANCELLATION_FREE_UNTIL_HOURS,
    ),
    cancellationCharge30UntilHours: parseHours(
      process.env.CANCELLATION_CHARGE_30_UNTIL_HOURS,
      CANCELLATION_CHARGE_30_UNTIL_HOURS,
    ),
    cancellationCharge50UntilHours: parseHours(
      process.env.CANCELLATION_CHARGE_50_UNTIL_HOURS,
      CANCELLATION_CHARGE_50_UNTIL_HOURS,
    ),
    customerNoShowGraceMinutes: parseMinutes(
      process.env.CUSTOMER_NO_SHOW_GRACE_MINUTES,
      CUSTOMER_NO_SHOW_GRACE_MINUTES,
    ),
    maxCustomerReschedules: (() => {
      const n = Number(process.env.MAX_CUSTOMER_RESCHEDULES);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : MAX_CUSTOMER_RESCHEDULES;
    })(),
    ownerPenaltyMinJod: parseMoney(process.env.OWNER_PENALTY_MIN_JOD, OWNER_PENALTY_MIN_JOD),
    ownerPenaltyMaxJod: parseMoney(process.env.OWNER_PENALTY_MAX_JOD, OWNER_PENALTY_MAX_JOD),
  };

  return cachedConfig;
}

/** Test helper — reset cached config between tests. */
export function resetPaymentPolicyConfigCache(): void {
  cachedConfig = null;
}

export function resolveDepositPercent(propertyDepositPercent: number | null | undefined): number {
  const config = loadPaymentPolicyConfig();
  if (propertyDepositPercent == null) return config.defaultDepositPercent;
  if (!Number.isFinite(propertyDepositPercent)) return config.defaultDepositPercent;
  if (propertyDepositPercent < 0 || propertyDepositPercent > 100) {
    return config.defaultDepositPercent;
  }
  return propertyDepositPercent;
}
