/**
 * Full-payment policy (no deposit). Amounts computed server-side only.
 */

export type PaymentPolicyConfig = {
  mode: 'full';
  currency: string;
  platformCommissionPercent: number;
  customerServiceFeePercent: number;
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
    mode: 'full',
    currency: (process.env.PAYMENT_CURRENCY ?? 'JOD').trim().toUpperCase(),
    platformCommissionPercent: parsePercent(process.env.PLATFORM_COMMISSION_PERCENT, 12),
    customerServiceFeePercent: parsePercent(process.env.CUSTOMER_SERVICE_FEE_PERCENT, 0),
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
