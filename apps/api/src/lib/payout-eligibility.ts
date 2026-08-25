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

export function classifyPayoutEligibility(params: {
  purpose: string;
  paymentStatus: string;
  bookingStatus: string;
  paymentState: string;
  refundStatus: string;
  slotDate: Date;
  payoutAvailableAt: Date | null;
  ownerPayoutRecordStatus?: string | null;
  operationsBlock: { blocked: boolean; reason: string | null };
  reservedInOtherSettlement: boolean;
  now?: Date;
}): { eligible: boolean; reason: PayoutExclusionReason | null; payoutStatus: PayoutStatus } {
  const now = params.now ?? new Date();

  if (params.purpose === 'deposit') {
    return { eligible: false, reason: 'deposit_payment', payoutStatus: PayoutStatus.not_ready };
  }
  if (params.paymentStatus !== PaymentStatus.succeeded) {
    return { eligible: false, reason: 'not_succeeded', payoutStatus: PayoutStatus.not_ready };
  }
  if (params.paymentState !== 'fully_paid') {
    return { eligible: false, reason: 'not_fully_paid', payoutStatus: PayoutStatus.not_ready };
  }
  if (params.bookingStatus === BookingStatus.cancelled) {
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

  if (hoursUntilBookingStart(params.slotDate, now) > 0) {
    return { eligible: false, reason: 'visit_not_passed', payoutStatus: PayoutStatus.pending };
  }

  const payoutStatus = resolvePayoutStatus({
    paymentSucceeded: true,
    bookingFullyPaid: true,
    bookingCancelled: false,
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
