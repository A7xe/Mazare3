/**
 * Full snapshot + deposit policy. Amounts computed server-side only.
 * Single source for DEFAULT_DEPOSIT_PERCENT / commission / balance due hours.
 */

import { TEST_DEFAULT_DEPOSIT_PERCENT } from '@mazare3/shared';

export type PaymentPolicyConfig = {
  mode: 'deposit_balance';
  currency: string;
  platformCommissionPercent: number;
  customerServiceFeePercent: number;
  defaultDepositPercent: number;
  balanceDueHoursBeforeStart: number;
  ownerPayoutDelayHours: number;
  cancellationFreeUntilHours: number;
  cancellationPartialUntilHours: number;
  cancellationPartialRefundPercent: number;
  lateCancellationRefundPercent: number;
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
    platformCommissionPercent: parsePercent(process.env.PLATFORM_COMMISSION_PERCENT, 12),
    customerServiceFeePercent: parsePercent(process.env.CUSTOMER_SERVICE_FEE_PERCENT, 0),
    defaultDepositPercent: parsePercent(
      process.env.DEFAULT_DEPOSIT_PERCENT,
      TEST_DEFAULT_DEPOSIT_PERCENT,
    ),
    balanceDueHoursBeforeStart: parseHours(process.env.BALANCE_DUE_HOURS_BEFORE_START, 24),
    ownerPayoutDelayHours: parseHours(process.env.OWNER_PAYOUT_DELAY_HOURS, 24),
    cancellationFreeUntilHours: parseHours(process.env.CANCELLATION_FREE_UNTIL_HOURS, 72),
    cancellationPartialUntilHours: parseHours(process.env.CANCELLATION_PARTIAL_UNTIL_HOURS, 24),
    cancellationPartialRefundPercent: parsePercent(
      process.env.CANCELLATION_PARTIAL_REFUND_PERCENT,
      50,
    ),
    lateCancellationRefundPercent: parsePercent(process.env.LATE_CANCELLATION_REFUND_PERCENT, 0),
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
