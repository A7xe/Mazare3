import { BookingStatus, PaymentStatus, PayoutStatus } from '@mazare3/db';
import { hoursUntilBookingStart, resolvePayoutStatus } from '../services/payment-policy.service.js';

export const PAYOUT_EXCLUSION_REASONS = [
  'deposit_payment',
  'not_succeeded',
  'not_fully_paid',
  'cancelled_booking',
  'visit_not_passed',
  'payout_delay',
  'refund_blocked',
  'dispute_blocked',
  'already_paid',
  'already_in_settlement',
] as const;

export type PayoutExclusionReason = (typeof PAYOUT_EXCLUSION_REASONS)[number];

/**
 * Phase 1: cancelled bookings may still pay owner retained cancellation money once
 * refunds are finalized (none / processed / rejected) and ownerNet > 0.
 */
export function classifyPayoutEligibility(params: {
  purpose: string;
  paymentStatus: string;
  bookingStatus: string;
  paymentState: string;
  refundStatus: string;
  slotDate: Date;
  bookingStartAt?: Date | null;
  payoutAvailableAt: Date | null;
  ownerPayoutRecordStatus?: string | null;
  ownerNetPayoutAmount?: number;
  cancellationPenaltyAmount?: number | null;
  operationsBlock: { blocked: boolean; reason: string | null };
  reservedInOtherSettlement: boolean;
  now?: Date;
}): { eligible: boolean; reason: PayoutExclusionReason | null; payoutStatus: PayoutStatus } {
  const now = params.now ?? new Date();
  const ownerNet = params.ownerNetPayoutAmount ?? 0;
  const retained = params.cancellationPenaltyAmount ?? 0;
  const isCancellationRetention =
    params.bookingStatus === BookingStatus.cancelled &&
    retained > 0 &&
    ownerNet > 0 &&
    (params.refundStatus === 'none' ||
      params.refundStatus === 'processed' ||
      params.refundStatus === 'rejected');

  if (params.paymentStatus !== PaymentStatus.succeeded) {
    return { eligible: false, reason: 'not_succeeded', payoutStatus: PayoutStatus.not_ready };
  }

  // Normal completed bookings: deposit installments never pay out alone.
  if (params.purpose === 'deposit' && !isCancellationRetention) {
    return { eligible: false, reason: 'deposit_payment', payoutStatus: PayoutStatus.not_ready };
  }

  if (!isCancellationRetention && params.paymentState !== 'fully_paid') {
    return { eligible: false, reason: 'not_fully_paid', payoutStatus: PayoutStatus.not_ready };
  }

  if (params.bookingStatus === BookingStatus.cancelled && !isCancellationRetention) {
    return { eligible: false, reason: 'cancelled_booking', payoutStatus: PayoutStatus.blocked };
  }

  if (params.ownerPayoutRecordStatus === 'paid') {
    return { eligible: false, reason: 'already_paid', payoutStatus: PayoutStatus.paid };
  }
  if (params.reservedInOtherSettlement) {
    return { eligible: false, reason: 'already_in_settlement', payoutStatus: PayoutStatus.pending };
  }
  if (params.operationsBlock.blocked) {
    const reason: PayoutExclusionReason = params.operationsBlock.reason?.startsWith('dispute_')
      ? 'dispute_blocked'
      : 'refund_blocked';
    return { eligible: false, reason, payoutStatus: PayoutStatus.blocked };
  }

  // Retention payouts unlock after financial finalization (refund none/processed),
  // without waiting for the original visit window.
  if (!isCancellationRetention && hoursUntilBookingStart(params.bookingStartAt, params.slotDate, now) > 0) {
    return { eligible: false, reason: 'visit_not_passed', payoutStatus: PayoutStatus.pending };
  }

  const payoutStatus = resolvePayoutStatus({
    paymentSucceeded: true,
    bookingFullyPaid: true,
    bookingCancelled: params.bookingStatus === BookingStatus.cancelled,
    refundStatus: params.refundStatus,
    payoutAvailableAt: params.payoutAvailableAt,
    now,
  });

  if (payoutStatus === PayoutStatus.pending || !params.payoutAvailableAt || now < params.payoutAvailableAt) {
    return { eligible: false, reason: 'payout_delay', payoutStatus: PayoutStatus.pending };
  }
  if (payoutStatus === PayoutStatus.blocked) {
    return { eligible: false, reason: 'refund_blocked', payoutStatus: PayoutStatus.blocked };
  }
  if (payoutStatus !== PayoutStatus.eligible) {
    return { eligible: false, reason: 'not_fully_paid', payoutStatus };
  }

  return { eligible: true, reason: null, payoutStatus: PayoutStatus.eligible };
}
