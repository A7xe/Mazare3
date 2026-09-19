import type { BookingPaymentState } from './constants';

/**
 * Single source of allowed BookingPaymentState transitions.
 * Booking.status (pending_payment / confirmed / expired / cancelled) is separate.
 */
export const PAYMENT_STATE_TRANSITIONS: Record<
  BookingPaymentState,
  readonly BookingPaymentState[]
> = {
  unpaid: ['unpaid', 'deposit_pending', 'fully_paid'],
  deposit_pending: ['unpaid', 'deposit_pending', 'deposit_paid'],
  deposit_paid: [
    'deposit_paid',
    'balance_pending',
    'balance_overdue',
    'fully_paid',
    'partially_refunded',
    'refunded',
  ],
  balance_pending: ['deposit_paid', 'balance_pending', 'fully_paid', 'balance_overdue'],
  fully_paid: ['fully_paid', 'partially_refunded', 'refunded'],
  balance_overdue: [
    'balance_overdue',
    'balance_pending',
    'fully_paid',
    'partially_refunded',
    'refunded',
  ],
  partially_refunded: ['partially_refunded', 'refunded'],
  refunded: ['refunded'],
};

export function canTransitionPaymentState(
  from: BookingPaymentState | string,
  to: BookingPaymentState | string,
): boolean {
  const allowed = PAYMENT_STATE_TRANSITIONS[from as BookingPaymentState];
  if (!allowed) return false;
  return allowed.includes(to as BookingPaymentState);
}

export function assertPaymentStateTransition(
  from: BookingPaymentState | string,
  to: BookingPaymentState | string,
): void {
  if (!canTransitionPaymentState(from, to)) {
    throw new Error(`Illegal paymentState transition: ${from} → ${to}`);
  }
}

export function paymentStateAfterCapture(params: {
  collectionMode: 'full' | 'deposit_balance' | string;
  purpose: 'full' | 'deposit' | 'balance' | 'reschedule_difference' | string;
  remainingAfterFils: number;
  /** Used for reschedule_difference so we do not force fully_paid incorrectly. */
  currentState?: BookingPaymentState | string;
}): BookingPaymentState {
  // Reschedule delta: do not treat purpose as a normal installment that forces fully_paid.
  // Prefer keep current state; payment.service may override after finalize.
  if (params.purpose === 'reschedule_difference') {
    if (params.currentState === 'fully_paid' || params.remainingAfterFils <= 0) {
      return 'fully_paid';
    }
    if (params.currentState && params.currentState in PAYMENT_STATE_TRANSITIONS) {
      return params.currentState as BookingPaymentState;
    }
    return 'fully_paid';
  }
  if (params.purpose === 'full' || params.collectionMode === 'full' || params.remainingAfterFils <= 0) {
    return 'fully_paid';
  }
  if (params.purpose === 'deposit') return 'deposit_paid';
  return 'fully_paid';
}

export function paymentStateAfterRefund(params: {
  remainingCapturedFils: number;
}): 'partially_refunded' | 'refunded' {
  return params.remainingCapturedFils <= 0 ? 'refunded' : 'partially_refunded';
}

export function isRefundTerminalPaymentState(state: string | null | undefined): boolean {
  return state === 'refunded';
}

export function isPayClosedPaymentState(state: string | null | undefined): boolean {
  return state === 'refunded';
}
