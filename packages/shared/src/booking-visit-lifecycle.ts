/**
 * Phase 3C.4E.4B / 3C.4E.4C — Visit / no-show / successful-completion lifecycle projection.
 * Financial economics remain in marketplace-financial-policy.
 *
 * Derived projection: ended checked-in visits may display as completed
 * even before the completion job persists visitOutcome.
 */
import {
  CUSTOMER_NO_SHOW_GRACE_MINUTES,
  isCustomerNoShowEligible,
  resolveBookingPeriodStart,
  resolveCheckInWindow,
} from './marketplace-financial-policy.js';
import { getPlatformTimeZone, todayDateIsoInZone } from './timezone.js';

export const BOOKING_VISIT_OUTCOMES = [
  'pending_visit',
  'checked_in',
  'completed',
  'customer_no_show',
  'owner_no_show',
  'access_denied',
  'force_majeure',
  'disputed',
  'resolved_other',
] as const;

export type BookingVisitOutcomeCode = (typeof BOOKING_VISIT_OUTCOMES)[number];

export const TERMINAL_VISIT_OUTCOMES: readonly BookingVisitOutcomeCode[] = [
  'completed',
  'customer_no_show',
  'owner_no_show',
  'access_denied',
  'force_majeure',
  'resolved_other',
] as const;

export function isTerminalVisitOutcome(
  outcome: string | null | undefined,
): outcome is BookingVisitOutcomeCode {
  return Boolean(outcome && (TERMINAL_VISIT_OUTCOMES as readonly string[]).includes(outcome));
}

export function customerNoShowGraceDeadline(
  bookingStartAt: Date,
  graceMinutes: number = CUSTOMER_NO_SHOW_GRACE_MINUTES,
): Date {
  return new Date(bookingStartAt.getTime() + graceMinutes * 60 * 1000);
}

/** Inclusive: exactly start+60m is review-eligible. */
export function isPastCustomerNoShowGrace(params: {
  bookingStartAt: Date;
  graceMinutes?: number;
  now?: Date;
}): boolean {
  return isCustomerNoShowEligible({
    bookingStartAt: params.bookingStartAt,
    checkInVerified: false,
    graceMinutes: params.graceMinutes,
    now: params.now,
  });
}

/**
 * Authoritative visit end Instant when timed ends exist.
 * Prefer bookingEndAt, then slot.endAt. Day-only slots use isAuthoritativeVisitEnded.
 */
export function resolveAuthoritativeVisitEnd(params: {
  bookingEndAt?: Date | null;
  slotEndAt?: Date | null;
}): Date | null {
  if (params.bookingEndAt) return params.bookingEndAt;
  if (params.slotEndAt) return params.slotEndAt;
  return null;
}

/** Whether the visit period has ended (server-authoritative; mirrors review visitHasEnded). */
export function isAuthoritativeVisitEnded(params: {
  bookingEndAt?: Date | null;
  slotEndAt?: Date | null;
  slotDate: Date;
  now?: Date;
}): boolean {
  const now = params.now ?? new Date();
  const today = todayDateIsoInZone(getPlatformTimeZone(), now);
  const slotIso = params.slotDate.toISOString().slice(0, 10);
  if (slotIso < today) return true;
  if (params.bookingEndAt && params.bookingEndAt.getTime() <= now.getTime()) return true;
  if (params.slotEndAt && params.slotEndAt.getTime() <= now.getTime()) return true;
  return false;
}

/** Inclusive: exactly visit end Instant is completion-eligible when timed. */
export function isSuccessfulVisitCompletionEligible(params: {
  bookingStatus: string;
  visitOutcome?: string | null;
  checkInStatus?: string | null;
  checkInVerified?: boolean;
  cancellationReasonCode?: string | null;
  bookingEndAt?: Date | null;
  slotEndAt?: Date | null;
  slotDate: Date;
  hasBlockingIncidentOrDispute?: boolean;
  now?: Date;
}): { eligible: boolean; reason: string | null } {
  if (params.bookingStatus !== 'confirmed') {
    return { eligible: false, reason: 'not_confirmed' };
  }
  if (isTerminalVisitOutcome(params.visitOutcome)) {
    return { eligible: false, reason: 'already_terminal' };
  }
  if (params.visitOutcome === 'disputed' || params.hasBlockingIncidentOrDispute) {
    return { eligible: false, reason: 'blocked_dispute' };
  }
  if (
    params.cancellationReasonCode === 'CUSTOMER_NO_SHOW' ||
    params.cancellationReasonCode === 'OWNER_NO_SHOW' ||
    params.cancellationReasonCode === 'ACCESS_DENIED' ||
    params.cancellationReasonCode === 'FORCE_MAJEURE' ||
    params.cancellationReasonCode === 'BALANCE_NOT_PAID'
  ) {
    return { eligible: false, reason: 'terminal_reason_code' };
  }
  const checkedIn =
    params.checkInVerified === true ||
    params.checkInStatus === 'verified' ||
    params.visitOutcome === 'checked_in';
  if (!checkedIn) {
    return { eligible: false, reason: 'no_check_in' };
  }
  if (
    !isAuthoritativeVisitEnded({
      bookingEndAt: params.bookingEndAt,
      slotEndAt: params.slotEndAt,
      slotDate: params.slotDate,
      now: params.now,
    })
  ) {
    return { eligible: false, reason: 'visit_not_ended' };
  }
  return { eligible: true, reason: null };
}

/**
 * Customer-facing lifecycle projection (not a second financial SSOT).
 * Prefer stored visitOutcome when terminal; otherwise derive pending states.
 * Phase 3C.4E.4C — ended checked-in visits project as completed (not upcoming)
 * even before the completion job persists the outcome.
 */
export function resolveVisitLifecycleProjection(params: {
  bookingStatus: string;
  visitOutcome?: string | null;
  cancellationReasonCode?: string | null;
  checkInStatus?: string | null;
  bookingStartAt: Date | null;
  bookingEndAt?: Date | null;
  slotEndAt?: Date | null;
  slotDate?: Date | null;
  graceMinutes?: number;
  hasOpenVisitDispute?: boolean;
  now?: Date;
}): {
  outcome: BookingVisitOutcomeCode | 'cancelled' | 'expired' | 'upcoming' | 'visit_review_eligible' | null;
  terminal: boolean;
  displayKey: string;
  graceDeadlineAt: string | null;
  checkInWindow: ReturnType<typeof resolveCheckInWindow> | null;
} {
  const now = params.now ?? new Date();
  const start = params.bookingStartAt;
  const graceDeadline = start
    ? customerNoShowGraceDeadline(start, params.graceMinutes)
    : null;
  const window = start ? resolveCheckInWindow(start, now) : null;

  if (params.bookingStatus === 'expired') {
    return {
      outcome: 'expired',
      terminal: true,
      displayKey: 'expired',
      graceDeadlineAt: graceDeadline?.toISOString() ?? null,
      checkInWindow: window,
    };
  }

  if (params.visitOutcome && isTerminalVisitOutcome(params.visitOutcome)) {
    return {
      outcome: params.visitOutcome,
      terminal: true,
      displayKey: params.visitOutcome,
      graceDeadlineAt: graceDeadline?.toISOString() ?? null,
      checkInWindow: window,
    };
  }

  if (params.cancellationReasonCode === 'CUSTOMER_NO_SHOW') {
    return {
      outcome: 'customer_no_show',
      terminal: true,
      displayKey: 'customer_no_show',
      graceDeadlineAt: graceDeadline?.toISOString() ?? null,
      checkInWindow: window,
    };
  }

  if (params.bookingStatus === 'cancelled') {
    const code = params.cancellationReasonCode;
    if (code === 'OWNER_NO_SHOW') {
      return {
        outcome: 'owner_no_show',
        terminal: true,
        displayKey: 'owner_no_show',
        graceDeadlineAt: graceDeadline?.toISOString() ?? null,
        checkInWindow: window,
      };
    }
    if (code === 'ACCESS_DENIED') {
      return {
        outcome: 'access_denied',
        terminal: true,
        displayKey: 'access_denied',
        graceDeadlineAt: graceDeadline?.toISOString() ?? null,
        checkInWindow: window,
      };
    }
    if (code === 'FORCE_MAJEURE') {
      return {
        outcome: 'force_majeure',
        terminal: true,
        displayKey: 'force_majeure',
        graceDeadlineAt: graceDeadline?.toISOString() ?? null,
        checkInWindow: window,
      };
    }
    return {
      outcome: 'cancelled',
      terminal: true,
      displayKey: 'cancelled',
      graceDeadlineAt: graceDeadline?.toISOString() ?? null,
      checkInWindow: window,
    };
  }

  if (params.bookingStatus !== 'confirmed') {
    return {
      outcome: null,
      terminal: false,
      displayKey: params.bookingStatus,
      graceDeadlineAt: graceDeadline?.toISOString() ?? null,
      checkInWindow: window,
    };
  }

  if (params.hasOpenVisitDispute || params.visitOutcome === 'disputed') {
    return {
      outcome: 'disputed',
      terminal: false,
      displayKey: 'visit_under_review',
      graceDeadlineAt: graceDeadline?.toISOString() ?? null,
      checkInWindow: window,
    };
  }

  const checkedIn =
    params.checkInStatus === 'verified' || params.visitOutcome === 'checked_in';
  const slotDate = params.slotDate ?? null;
  if (checkedIn && slotDate) {
    const completion = isSuccessfulVisitCompletionEligible({
      bookingStatus: params.bookingStatus,
      visitOutcome: params.visitOutcome,
      checkInStatus: params.checkInStatus,
      cancellationReasonCode: params.cancellationReasonCode,
      bookingEndAt: params.bookingEndAt,
      slotEndAt: params.slotEndAt,
      slotDate,
      hasBlockingIncidentOrDispute: params.hasOpenVisitDispute,
      now,
    });
    if (completion.eligible) {
      return {
        outcome: 'completed',
        terminal: true,
        displayKey: 'completed',
        graceDeadlineAt: graceDeadline?.toISOString() ?? null,
        checkInWindow: window,
      };
    }
  }

  if (checkedIn) {
    return {
      outcome: 'checked_in',
      terminal: false,
      displayKey: 'checked_in',
      graceDeadlineAt: graceDeadline?.toISOString() ?? null,
      checkInWindow: window,
    };
  }

  if (
    start &&
    isPastCustomerNoShowGrace({
      bookingStartAt: start,
      graceMinutes: params.graceMinutes,
      now,
    })
  ) {
    return {
      outcome: 'pending_visit',
      terminal: false,
      displayKey: 'visit_review_eligible',
      graceDeadlineAt: graceDeadline?.toISOString() ?? null,
      checkInWindow: window,
    };
  }

  if (start && now >= start) {
    return {
      outcome: 'pending_visit',
      terminal: false,
      displayKey: 'visit_in_progress',
      graceDeadlineAt: graceDeadline?.toISOString() ?? null,
      checkInWindow: window,
    };
  }

  return {
    outcome: 'pending_visit',
    terminal: false,
    displayKey: 'upcoming',
    graceDeadlineAt: graceDeadline?.toISOString() ?? null,
    checkInWindow: window,
  };
}

export { resolveBookingPeriodStart };
