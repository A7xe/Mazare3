import { filsToJod, jodToFils, percentOfFils } from './money';

export type BookingFinancialSnapshot = {
  bookingTotalAmount: number;
  depositPercent: number;
  depositAmount: number;
  remainingAmount: number;
  platformCommissionPercent: number;
  platformCommissionAmount: number;
  ownerGrossAmount: number;
  ownerNetPayoutAmount: number;
  customerServiceFeePercent: number;
  customerServiceFeeAmount: number;
  customerPayableTotal: number;
  /** First installment: deposit (+ service fee). For full collection this equals customerPayableTotal. */
  depositDueAmount: number;
  balanceDueAmount: number;
  currency: string;
};

export type BookingFinancialsInput = {
  bookingTotalAmount: number;
  depositPercent: number;
  platformCommissionPercent: number;
  customerServiceFeePercent: number;
  currency?: string;
  /** When true, deposit is 100% of booking total (legacy full payment). */
  fullPayment?: boolean;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/**
 * Server-side snapshot math. Deposit is a share of booking total (not a separate fee).
 * Commission is always on the full booking total.
 * Customer service fee (if any) is collected with the first installment.
 */
export function calculateBookingFinancialSnapshot(
  input: BookingFinancialsInput,
): BookingFinancialSnapshot {
  const depositPercent = input.fullPayment ? 100 : clampPercent(input.depositPercent);
  const commissionPercent = clampPercent(input.platformCommissionPercent);
  const feePercent = clampPercent(input.customerServiceFeePercent);
  const currency = (input.currency ?? 'JOD').toUpperCase();

  const totalFils = jodToFils(input.bookingTotalAmount);
  const depositFils = percentOfFils(totalFils, depositPercent);
  const remainingFils = totalFils - depositFils;
  const commissionFils = percentOfFils(totalFils, commissionPercent);
  const ownerNetFils = totalFils - commissionFils;
  const feeFils = percentOfFils(totalFils, feePercent);
  const payableFils = totalFils + feeFils;
  const depositDueFils = depositFils + feeFils;

  return {
    bookingTotalAmount: filsToJod(totalFils),
    depositPercent,
    depositAmount: filsToJod(depositFils),
    remainingAmount: filsToJod(remainingFils),
    platformCommissionPercent: commissionPercent,
    platformCommissionAmount: filsToJod(commissionFils),
    ownerGrossAmount: filsToJod(totalFils),
    ownerNetPayoutAmount: filsToJod(ownerNetFils),
    customerServiceFeePercent: feePercent,
    customerServiceFeeAmount: filsToJod(feeFils),
    customerPayableTotal: filsToJod(payableFils),
    depositDueAmount: filsToJod(depositDueFils),
    balanceDueAmount: filsToJod(remainingFils),
    currency,
  };
}

/**
 * Balance due from a real UTC booking start instant.
 * `hoursBeforeStart = 0` means the balance is due at that instant.
 */
export function computeBalanceDueAtFromStart(bookingStartAt: Date, hoursBeforeStart: number): Date {
  const hours = Number.isFinite(hoursBeforeStart) && hoursBeforeStart >= 0 ? hoursBeforeStart : 0;
  return new Date(bookingStartAt.getTime() - hours * 60 * 60 * 1000);
}

/**
 * Legacy fallback: slot calendar date at 00:00 UTC.
 * Used only when the slot has no real startAt (pre-Phase 10B.1 rows).
 * Does not invent a period start time.
 */
export function computeBalanceDueAt(slotDate: Date, hoursBeforeStart: number): Date {
  const hours = Number.isFinite(hoursBeforeStart) && hoursBeforeStart >= 0 ? hoursBeforeStart : 0;
  const y = slotDate.getUTCFullYear();
  const m = slotDate.getUTCMonth();
  const d = slotDate.getUTCDate();
  const startUtc = Date.UTC(y, m, d, 0, 0, 0, 0);
  return new Date(startUtc - hours * 60 * 60 * 1000);
}

export type PlatformFundedSnapshot = BookingFinancialSnapshot & {
  merchantBookingValue: number;
  platformDiscountAmount: number;
  commissionBasisAmount: number;
  customerPayableBeforeFee: number;
};

/**
 * Platform-funded coupon: owner/commission stay on merchant value;
 * the customer deposit and remaining follow the reduced payable.
 */
export function calculatePlatformFundedSnapshot(input: {
  merchantBookingValue: number;
  platformDiscountAmount: number;
  depositPercent: number;
  platformCommissionPercent: number;
  customerServiceFeePercent: number;
  currency?: string;
}): PlatformFundedSnapshot {
  const merchantFils = jodToFils(input.merchantBookingValue);
  const discountFils = jodToFils(input.platformDiscountAmount);
  if (discountFils <= 0 || discountFils >= merchantFils) {
    throw new Error('Platform discount must be smaller than the merchant booking value');
  }
  const customerFils = merchantFils - discountFils;
  const depositPercent = clampPercent(input.depositPercent);
  const commissionPercent = clampPercent(input.platformCommissionPercent);
  const feePercent = clampPercent(input.customerServiceFeePercent);
  const currency = (input.currency ?? 'JOD').toUpperCase();

  const depositFils = percentOfFils(customerFils, depositPercent);
  const remainingFils = customerFils - depositFils;
  const commissionFils = percentOfFils(merchantFils, commissionPercent);
  const ownerNetFils = merchantFils - commissionFils;
  const feeFils = percentOfFils(customerFils, feePercent);
  const payableFils = customerFils + feeFils;

  return {
    bookingTotalAmount: filsToJod(merchantFils),
    depositPercent,
    depositAmount: filsToJod(depositFils),
    remainingAmount: filsToJod(remainingFils),
    platformCommissionPercent: commissionPercent,
    platformCommissionAmount: filsToJod(commissionFils),
    ownerGrossAmount: filsToJod(merchantFils),
    ownerNetPayoutAmount: filsToJod(ownerNetFils),
    customerServiceFeePercent: feePercent,
    customerServiceFeeAmount: filsToJod(feeFils),
    customerPayableTotal: filsToJod(payableFils),
    depositDueAmount: filsToJod(depositFils + feeFils),
    balanceDueAmount: filsToJod(remainingFils),
    currency,
    merchantBookingValue: filsToJod(merchantFils),
    platformDiscountAmount: filsToJod(discountFils),
    commissionBasisAmount: filsToJod(merchantFils),
    customerPayableBeforeFee: filsToJod(customerFils),
  };
}
