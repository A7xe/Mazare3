import { BookingStatus, PaymentStatus } from '@mazare3/db';
import type { InitialPaymentChoice, InitialPaymentOption } from '@mazare3/shared';
import { jodToFils } from '@mazare3/shared';

export type BookingAmountsForChoice = {
  status: string;
  paymentCollectionMode: string;
  paymentState: string;
  holdExpiresAt: Date | null;
  depositAmount: number;
  remainingAmount: number;
  customerServiceFeeAmount: number;
  customerPayableTotal: number;
  /** When true (<=72h before period start), deposit option is hidden — full payment only. */
  fullPaymentRequired?: boolean;
  payments: Array<{
    status: string;
    purpose: string;
    providerRef: string | null;
  }>;
};

function moneyEq(a: number, b: number): boolean {
  return jodToFils(a) === jodToFils(b);
}

function hasSucceededCapture(payments: BookingAmountsForChoice['payments']): boolean {
  return payments.some((p) => p.status === PaymentStatus.succeeded || p.status === 'succeeded');
}

/**
 * Active in-flight attempts that must lock Deposit↔Full switching.
 * Provider-ref pending/initiated = 3DS or HPP in progress.
 * initiated without providerRef is still soft (may switch after decline expire).
 */
export function findInFlightInitialPayment(
  payments: BookingAmountsForChoice['payments'],
): { purpose: string; locksChoice: boolean } | null {
  const active = payments.filter(
    (p) =>
      (p.status === PaymentStatus.initiated ||
        p.status === PaymentStatus.pending ||
        p.status === 'initiated' ||
        p.status === 'pending') &&
      (p.purpose === 'deposit' || p.purpose === 'full'),
  );
  if (active.length === 0) return null;
  // Prefer one with providerRef (provider already contacted).
  const withRef = active.find((p) => Boolean(p.providerRef?.trim()));
  if (withRef) return { purpose: withRef.purpose, locksChoice: true };
  // Pending without ref still locks (unknown / waiting).
  const pending = active.find(
    (p) => p.status === PaymentStatus.pending || p.status === 'pending',
  );
  if (pending) return { purpose: pending.purpose, locksChoice: true };
  // Initiated without providerRef: soft lock for UX but allow switch after decline/expire.
  return { purpose: active[0]!.purpose, locksChoice: false };
}

/**
 * CB-6 — server-authoritative Deposit vs Full options for INITIAL checkout only.
 * Returns null when choice is not available (balance, fully paid, approval, expiry, etc.).
 */
export function buildInitialPaymentOptions(
  booking: BookingAmountsForChoice,
): {
  options: InitialPaymentOption[] | null;
  defaultChoice: InitialPaymentChoice | null;
  choiceLocked: boolean;
  lockedChoice: InitialPaymentChoice | null;
} {
  const inFlight = findInFlightInitialPayment(booking.payments);

  if (
    booking.status === BookingStatus.pending_owner_approval ||
    booking.status === 'pending_owner_approval'
  ) {
    return { options: null, defaultChoice: null, choiceLocked: false, lockedChoice: null };
  }

  if (
    booking.status !== BookingStatus.pending_payment &&
    booking.status !== 'pending_payment'
  ) {
    return { options: null, defaultChoice: null, choiceLocked: false, lockedChoice: null };
  }

  if (
    booking.holdExpiresAt &&
    booking.holdExpiresAt.getTime() <= Date.now()
  ) {
    return { options: null, defaultChoice: null, choiceLocked: false, lockedChoice: null };
  }

  if (hasSucceededCapture(booking.payments)) {
    return { options: null, defaultChoice: null, choiceLocked: false, lockedChoice: null };
  }

  const depositDue =
    booking.depositAmount + booking.customerServiceFeeAmount;
  const fullDue = booking.customerPayableTotal;
  const remainingAfterDeposit = Math.max(0, booking.customerPayableTotal - depositDue);

  if (booking.fullPaymentRequired) {
    const locked =
      inFlight?.locksChoice && inFlight.purpose === 'full'
        ? ('full' as InitialPaymentChoice)
        : null;
    return {
      options: null,
      defaultChoice: null,
      choiceLocked: Boolean(locked),
      lockedChoice: locked,
    };
  }

  // 100% deposit (or economically identical): no redundant dual choice.
  if (moneyEq(depositDue, fullDue) || remainingAfterDeposit <= 0) {
    const locked =
      inFlight?.locksChoice && (inFlight.purpose === 'deposit' || inFlight.purpose === 'full')
        ? (inFlight.purpose as InitialPaymentChoice)
        : null;
    return {
      options: null,
      defaultChoice: null,
      choiceLocked: Boolean(locked),
      lockedChoice: locked,
    };
  }

  const options: InitialPaymentOption[] = [
    {
      choice: 'deposit',
      dueNowAmount: depositDue,
      remainingAfterPayment: remainingAfterDeposit,
    },
    {
      choice: 'full',
      dueNowAmount: fullDue,
      remainingAfterPayment: 0,
    },
  ];

  if (inFlight?.locksChoice) {
    const locked =
      inFlight.purpose === 'full' || inFlight.purpose === 'deposit'
        ? (inFlight.purpose as InitialPaymentChoice)
        : 'deposit';
    return {
      options,
      defaultChoice: locked,
      choiceLocked: true,
      lockedChoice: locked,
    };
  }

  // Soft preference: if an initiated deposit/full exists without provider, preselect it.
  if (inFlight && (inFlight.purpose === 'deposit' || inFlight.purpose === 'full')) {
    return {
      options,
      defaultChoice: inFlight.purpose as InitialPaymentChoice,
      choiceLocked: false,
      lockedChoice: null,
    };
  }

  return {
    options,
    defaultChoice: 'deposit',
    choiceLocked: false,
    lockedChoice: null,
  };
}

export function isInitialPaymentChoiceAllowed(
  booking: BookingAmountsForChoice,
  choice: InitialPaymentChoice,
): { ok: true } | { ok: false; code: string; message: string } {
  const built = buildInitialPaymentOptions(booking);
  if (built.choiceLocked && built.lockedChoice && built.lockedChoice !== choice) {
    return {
      ok: false,
      code: 'PAYMENT_CHOICE_LOCKED',
      message: 'Payment amount choice is locked until the current attempt is resolved',
    };
  }
  if (!built.options) {
    // Identical amounts / no choice UI — deposit and full collapse to one economic path.
    // Only while still on the initial unpaid checkout (no capture yet).
    const initialUnpaid =
      (booking.status === BookingStatus.pending_payment || booking.status === 'pending_payment') &&
      !hasSucceededCapture(booking.payments) &&
      !(booking.holdExpiresAt && booking.holdExpiresAt.getTime() <= Date.now());
    if (
      initialUnpaid &&
      moneyEq(
        booking.depositAmount + booking.customerServiceFeeAmount,
        booking.customerPayableTotal,
      )
    ) {
      if (choice === 'deposit' || choice === 'full') return { ok: true };
    }
    return {
      ok: false,
      code: 'INITIAL_PAYMENT_CHOICE_UNAVAILABLE',
      message: 'Deposit vs Full choice is not available for this booking',
    };
  }
  if (!built.options.some((o) => o.choice === choice)) {
    return {
      ok: false,
      code: 'INITIAL_PAYMENT_CHOICE_INVALID',
      message: 'Selected payment amount is not allowed',
    };
  }
  return { ok: true };
}
