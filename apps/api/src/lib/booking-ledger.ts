import { BookingPaymentState, BookingStatus, PaymentStatus, type PaymentPurpose } from '@mazare3/db';
import { isPayClosedPaymentState, jodToFils } from '@mazare3/shared';

export type PaymentLike = {
  status: PaymentStatus | string;
  purpose?: PaymentPurpose | string | null;
  amount: { toNumber(): number } | number;
  customerPayableAmount?: { toNumber(): number } | number;
};

export type RefundRequestLike = {
  status: string;
  approvedAmount?: { toNumber(): number } | number | null;
  requestedAmount?: { toNumber(): number } | number | null;
};

function moneyToFils(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === 'number' ? value : value.toNumber();
  return jodToFils(n);
}

export function installmentFils(p: PaymentLike): number {
  return moneyToFils(p.amount ?? p.customerPayableAmount);
}

const CAPTURED_STATUSES = new Set(['succeeded', PaymentStatus.succeeded]);

export function succeededInstallmentFils(payments: PaymentLike[]): {
  deposit: number;
  balance: number;
  full: number;
  total: number;
} {
  let deposit = 0;
  let balance = 0;
  let full = 0;
  for (const p of payments) {
    if (!CAPTURED_STATUSES.has(p.status as string)) continue;
    const fils = installmentFils(p);
    const purpose = p.purpose ?? 'full';
    if (purpose === 'deposit') deposit += fils;
    else if (purpose === 'balance') balance += fils;
    else full += fils;
  }
  return { deposit, balance, full, total: deposit + balance + full };
}

/** Approved/processed refunds only. Failed/expired/cancelled payments never count as captured. */
export function refundedFilsFromRequests(requests: RefundRequestLike[]): number {
  let fils = 0;
  for (const r of requests) {
    if (r.status !== 'approved' && r.status !== 'processed') continue;
    fils += moneyToFils(r.approvedAmount ?? r.requestedAmount ?? 0);
  }
  return fils;
}

export function refundableCapturedFils(
  payments: PaymentLike[],
  requests: RefundRequestLike[],
): { captured: number; refunded: number; refundable: number } {
  const captured = succeededInstallmentFils(payments).total;
  const refunded = refundedFilsFromRequests(requests);
  return { captured, refunded, refundable: Math.max(0, captured - refunded) };
}

export function isBookingFullyPaidFromLedger(params: {
  paymentState?: BookingPaymentState | string | null;
  collectionMode?: string | null;
  customerPayableTotal: { toNumber(): number } | number;
  payments: PaymentLike[];
}): boolean {
  if (params.paymentState === BookingPaymentState.fully_paid || params.paymentState === 'fully_paid') {
    return true;
  }
  const paid = succeededInstallmentFils(params.payments);
  const due = moneyToFils(params.customerPayableTotal);
  return due > 0 && paid.total >= due;
}

export function derivePayFlags(params: {
  status: BookingStatus | string;
  collectionMode: string;
  paymentState: string;
  payments: PaymentLike[];
  customerPayableTotal: { toNumber(): number } | number;
  remainingSnapshotFils: number;
}): {
  canPayDeposit: boolean;
  canPayBalance: boolean;
  canPayFull: boolean;
  isFullyPaid: boolean;
  depositPaidAmount: number;
  remainingAmount: number;
  duePurpose: PaymentPurpose | null;
} {
  const terminal =
    params.status === BookingStatus.cancelled ||
    params.status === BookingStatus.expired ||
    params.status === 'cancelled' ||
    params.status === 'expired' ||
    isPayClosedPaymentState(params.paymentState);

  const paid = succeededInstallmentFils(params.payments);
  const payableFils = moneyToFils(params.customerPayableTotal);
  const isFullyPaid = !terminal && payableFils > 0 && paid.total >= payableFils;

  const depositPaidAmount = (paid.deposit + paid.full) / 100;
  const remainingFils = Math.max(0, payableFils - paid.total);
  const remainingAmount = remainingFils / 100;

  if (terminal || isFullyPaid) {
    return {
      canPayDeposit: false,
      canPayBalance: false,
      canPayFull: false,
      isFullyPaid,
      depositPaidAmount,
      remainingAmount,
      duePurpose: null,
    };
  }

  const isFullMode = params.collectionMode === 'full';
  const canPayFull =
    isFullMode &&
    (params.status === BookingStatus.pending_payment || params.status === 'pending_payment') &&
    paid.full === 0 &&
    paid.total === 0;

  const canPayDeposit =
    !isFullMode &&
    (params.status === BookingStatus.pending_payment || params.status === 'pending_payment') &&
    paid.deposit === 0 &&
    paid.full === 0;

  const canPayBalance =
    !isFullMode &&
    paid.deposit > 0 &&
    remainingFils > 0 &&
    paid.balance === 0 &&
    (params.status === BookingStatus.confirmed || params.status === 'confirmed');

  let duePurpose: PaymentPurpose | null = null;
  if (canPayFull) duePurpose = 'full';
  else if (canPayDeposit) duePurpose = 'deposit';
  else if (canPayBalance) duePurpose = 'balance';

  return {
    canPayDeposit,
    canPayBalance,
    canPayFull,
    isFullyPaid,
    depositPaidAmount,
    remainingAmount,
    duePurpose,
  };
}
