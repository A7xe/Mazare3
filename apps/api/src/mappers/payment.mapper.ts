import type { PaymentStatus as DbPaymentStatus, PayoutStatus, RefundStatus } from '@mazare3/db';
import type {
  PaymentDisplayStatus,
  PaymentFinancialBreakdown,
  PaymentSummary,
} from '@mazare3/shared';

export type PaymentRow = {
  id: string;
  bookingId: string;
  amount: { toNumber(): number } | number;
  currency: string;
  method: string;
  provider: string;
  status: DbPaymentStatus;
  bookingTotalAmount: { toNumber(): number } | number;
  customerPayableAmount: { toNumber(): number } | number;
  platformCommissionAmount: { toNumber(): number } | number;
  customerServiceFeeAmount: { toNumber(): number } | number;
  ownerGrossAmount: { toNumber(): number } | number;
  ownerNetPayoutAmount: { toNumber(): number } | number;
  payoutStatus: PayoutStatus;
  payoutAvailableAt: Date | null;
  cancellationRefundAmount: { toNumber(): number } | number | null;
  cancellationPenaltyAmount: { toNumber(): number } | number | null;
  refundStatus: RefundStatus;
  expiresAt: Date | null;
  succeededAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : value.toNumber();
}

export function toPaymentFinancialBreakdown(p: PaymentRow): PaymentFinancialBreakdown {
  return {
    bookingTotalAmount: decimalToNumber(p.bookingTotalAmount),
    customerPayableAmount: decimalToNumber(p.customerPayableAmount),
    platformCommissionAmount: decimalToNumber(p.platformCommissionAmount),
    customerServiceFeeAmount: decimalToNumber(p.customerServiceFeeAmount),
    ownerGrossAmount: decimalToNumber(p.ownerGrossAmount),
    ownerNetPayoutAmount: decimalToNumber(p.ownerNetPayoutAmount),
    currency: p.currency,
  };
}

export function toPaymentSummary(p: PaymentRow): PaymentSummary {
  return {
    id: p.id,
    bookingId: p.bookingId,
    amount: decimalToNumber(p.customerPayableAmount),
    currency: p.currency,
    method: p.method,
    provider: p.provider,
    status: p.status,
    financial: toPaymentFinancialBreakdown(p),
    payoutStatus: p.payoutStatus,
    payoutAvailableAt: p.payoutAvailableAt?.toISOString() ?? null,
    refundStatus: p.refundStatus,
    cancellationRefundAmount:
      p.cancellationRefundAmount != null
        ? decimalToNumber(p.cancellationRefundAmount)
        : null,
    cancellationPenaltyAmount:
      p.cancellationPenaltyAmount != null
        ? decimalToNumber(p.cancellationPenaltyAmount)
        : null,
    expiresAt: p.expiresAt?.toISOString() ?? null,
    succeededAt: p.succeededAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toPaymentDisplayStatus(
  payment: { status: DbPaymentStatus } | null | undefined,
  bookingStatus: string,
): PaymentDisplayStatus {
  if (!payment) {
    if (bookingStatus === 'confirmed') return 'paid';
    if (bookingStatus === 'pending_payment') return 'unpaid';
    return 'unpaid';
  }
  switch (payment.status) {
    case 'succeeded':
      return 'paid';
    case 'initiated':
    case 'pending':
      return 'pending';
    case 'failed':
      return 'failed';
    case 'refunded':
      return 'refunded';
    case 'expired':
    case 'cancelled':
    default:
      return bookingStatus === 'confirmed' ? 'paid' : 'unpaid';
  }
}
