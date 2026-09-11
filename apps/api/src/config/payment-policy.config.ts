/**
 * Full snapshot + deposit policy. Amounts computed server-side only.
 * Env fallbacks align with @mazare3/shared marketplace-financial-policy SSOT.
 */

import {
  BALANCE_DUE_HOURS_BEFORE_START,
  CANCELLATION_CHARGE_30_UNTIL_HOURS,
  CANCELLATION_CHARGE_50_UNTIL_HOURS,
  CANCELLATION_FREE_UNTIL_HOURS,
  DEPOSIT_PERCENT,
  FULL_PAYMENT_WITHIN_HOURS,
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
};

function parsePercent(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : fallback;
}

function parseHours(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function loadPaymentPolicyConfig(): PaymentPolicyConfig {
  return {
    mode: 'deposit_balance',
    currency: (process.env.PAYMENT_CURRENCY ?? 'JOD').trim().toUpperCase(),
    platformCommissionPercent: parsePercent(
      process.env.PLATFORM_COMMISSION_PERCENT,
      STANDARD_COMMISSION_PERCENT,
    ),
    platformVerifiedCommissionPercent: parsePercent(
      process.env.PLATFORM_VERIFIED_COMMISSION_PERCENT,
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
  };
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
