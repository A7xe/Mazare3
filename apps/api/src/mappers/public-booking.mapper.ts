import type { Prisma } from '@mazare3/db';
import { PaymentStatus, OwnerStatus, PropertyStatus } from '@mazare3/db';
import type {
  CancellationPolicyView,
  OwnerDecisionState,
  PaymentPurpose,
  PublicBookingSummary,
} from '@mazare3/shared';
import { canRevealExactLocation, toBookingArrival } from '@mazare3/shared';
import { formatLocalTime, getPlatformTimeZone } from '@mazare3/shared';
import {
  resolveBookingPeriodStart,
  resolveVisitLifecycleProjection,
} from '@mazare3/shared';
import { loadPaymentPolicyConfig } from '../config/payment-policy.config.js';
import {
  evaluateCancellationPolicy,
  snapshotToBreakdown,
  type CancellationPolicyResult,
} from '../services/payment-policy.service.js';
import { toPaymentDisplayStatus } from './payment.mapper.js';
import { derivePayFlags } from '../lib/booking-ledger.js';

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    property: {
      select: {
        slug: true;
        titleAr: true;
        titleEn: true;
        approximateAddress: true;
        exactAddress: true;
        arrivalInstructionsAr: true;
        arrivalInstructionsEn: true;
        latitudeExact: true;
        longitudeExact: true;
      };
    };
    slot: { select: { date: true; period: true; startAt: true; endAt: true } };
    payments: true;
  };
}>;

const PENDING_REBOOK_STATUSES = new Set([
  'pending',
  'pending_payment',
  'pending_owner_approval',
]);

export function isPropertyCurrentlyBookable(property: {
  status: string;
  owner: { status: string };
}): boolean {
  // Base published + owner.approved gates only.
  // Full NEW Booking eligibility (authority + regulatory READY) lives in
  // evaluatePropertyBookability (Phase 3C.4D.4B) — do not expand this sync helper.
  return property.status === PropertyStatus.published && property.owner.status === OwnerStatus.approved;
}

export function canRebookBooking(booking: {
  status: string;
  property: { status?: string; owner?: { status: string } };
}): boolean {
  if (PENDING_REBOOK_STATUSES.has(booking.status)) return false;
  if (!booking.property.status || !booking.property.owner) return false;
  return isPropertyCurrentlyBookable({
    status: booking.property.status,
    owner: booking.property.owner,
  });
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

export function toCancellationPolicyView(
  result: CancellationPolicyResult,
): CancellationPolicyView {
  return {
    canCancel: result.canCancel,
    tier: result.tier,
    refundPercent: result.refundPercent,
    refundableAmount: result.refundableAmount,
    cancellationPenaltyAmount: result.cancellationPenaltyAmount,
    hoursUntilBookingStart: result.hoursUntilStart,
    chargePercent: result.chargePercent,
    retainedAmount: result.retainedAmount,
    reason: result.reason,
  };
}

export function toPublicBookingSummary(booking: BookingWithRelations): PublicBookingSummary {
  const payments = booking.payments ?? [];
  const latestPayment = [...payments].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )[0];

  const flags = derivePayFlags({
    status: booking.status,
    collectionMode: booking.paymentCollectionMode,
    paymentState: booking.paymentState,
    payments,
    customerPayableTotal: booking.customerPayableTotal,
    remainingSnapshotFils: 0,
    balanceDueAt: booking.balanceDueAt ?? null,
  });

  const paidInFull = flags.isFullyPaid;
  const bookingMode = booking.instantBookingEnabled ? 'instant' : 'owner_approval';
  const ownerApprovalRequired = booking.status === 'pending_owner_approval';
  let ownerDecisionState: OwnerDecisionState = 'not_applicable';
  if (!booking.instantBookingEnabled) {
    if (booking.status === 'pending_owner_approval') ownerDecisionState = 'pending';
    else if (booking.status === 'cancelled' && booking.ownerDecisionAt) ownerDecisionState = 'rejected';
    else if (booking.status === 'expired') ownerDecisionState = 'expired';
    else if (booking.status === 'pending_payment' || booking.status === 'confirmed') {
      ownerDecisionState = 'accepted';
    }
  }
  const canCancel =
    booking.status === 'pending_payment' || booking.status === 'pending_owner_approval';
  const succeededSum = payments
    .filter((p) => p.status === PaymentStatus.succeeded)
    .reduce((s, p) => s + decimalToNumber(p.amount), 0);

  let cancellationPolicy: CancellationPolicyView | null = null;

  if (booking.status === 'pending_payment' || booking.status === 'pending_owner_approval') {
    cancellationPolicy = {
      canCancel: true,
      tier: 'free',
      refundPercent: 100,
      refundableAmount: succeededSum,
      cancellationPenaltyAmount: 0,
    };
  } else if (booking.status === 'confirmed' && succeededSum > 0) {
    const merchantValue =
      'merchantBookingValue' in booking && booking.merchantBookingValue != null
        ? decimalToNumber(booking.merchantBookingValue as { toNumber(): number } | number)
        : decimalToNumber(booking.totalAmount);
    const commissionPercent = decimalToNumber(booking.platformCommissionPercent);
    cancellationPolicy = toCancellationPolicyView(
      evaluateCancellationPolicy(
        merchantValue,
        succeededSum,
        booking.bookingStartAt,
        booking.slot.date,
        commissionPercent,
        new Date(),
        'rescheduleCount' in booking &&
          typeof booking.rescheduleCount === 'number' &&
          booking.rescheduleCount > 0
          ? {
              originalBookingStartAt:
                'originalBookingStartAt' in booking ? booking.originalBookingStartAt : null,
              applyRescheduleAnchor: true,
            }
          : undefined,
      ),
    );
  }

  return {
    id: booking.id,
    publicCode: booking.publicCode,
    status: booking.status,
    propertySlug: booking.property.slug,
    propertyTitleAr: booking.property.titleAr,
    propertyTitleEn: booking.property.titleEn ?? booking.property.titleAr,
    approximateLocation: booking.property.approximateAddress?.trim() || '',
    arrival: canRevealExactLocation({
      status: booking.status,
      paymentState: booking.paymentState,
      hasSucceededPayment: payments.some((p) => p.status === PaymentStatus.succeeded),
    })
      ? toBookingArrival(booking.property)
      : null,
    date: formatDateOnly(booking.slot.date),
    period: booking.slot.period,
    guestsCount: booking.guestsCount,
    totalAmount: decimalToNumber(booking.totalAmount),
    currency: booking.currency,
    createdAt: booking.createdAt.toISOString(),
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    cancellationReasonCode: booking.cancellationReasonCode ?? null,
    visitOutcome: booking.visitOutcome ?? null,
    visitOutcomeAt: booking.visitOutcomeAt?.toISOString() ?? null,
    visitLifecycle: (() => {
      const start = resolveBookingPeriodStart(booking.bookingStartAt, booking.slot.date);
      const grace = loadPaymentPolicyConfig().customerNoShowGraceMinutes;
      const proj = resolveVisitLifecycleProjection({
        bookingStatus: booking.status,
        visitOutcome: booking.visitOutcome ?? null,
        cancellationReasonCode: booking.cancellationReasonCode ?? null,
        checkInStatus: booking.checkInStatus ?? null,
        bookingStartAt: start,
        bookingEndAt: booking.bookingEndAt ?? null,
        slotEndAt: booking.slot.endAt ?? null,
        slotDate: booking.slot.date,
        graceMinutes: grace,
      });
      return {
        outcome: proj.outcome,
        terminal: proj.terminal,
        displayKey: proj.displayKey,
        graceDeadlineAt: proj.graceDeadlineAt,
      };
    })(),
    paymentStatus: toPaymentDisplayStatus(latestPayment, booking.status),
    paymentId: latestPayment?.id ?? null,
    customerPayableAmount: decimalToNumber(booking.customerPayableTotal),
    paidInFull,
    isFullyPaid: paidInFull,
    paymentCollectionMode: booking.paymentCollectionMode,
    paymentState: booking.paymentState,
    depositPercent: decimalToNumber(booking.depositPercent),
    depositAmount: decimalToNumber(booking.depositAmount),
    depositPaidAmount: flags.depositPaidAmount,
    remainingAmount: paidInFull ? 0 : decimalToNumber(booking.remainingAmount),
    balanceDueAt: booking.balanceDueAt?.toISOString() ?? null,
    holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
    ownerApprovalExpiresAt: booking.ownerApprovalExpiresAt?.toISOString() ?? null,
    bookingMode,
    ownerApprovalRequired,
    ownerDecisionState,
    ownerDecisionAt: booking.ownerDecisionAt?.toISOString() ?? null,
    ownerRejectionReason:
      ownerDecisionState === 'rejected' ? booking.ownerDecisionReason ?? null : null,
    canPayDeposit: flags.canPayDeposit,
    canPayBalance: flags.canPayBalance,
    canCancel,
    cancellationPolicy,
    refundRequest: null,
    canRequestRefund: false,
    canOpenDispute: false,
    bookingStartAt: booking.bookingStartAt?.toISOString() ?? null,
    bookingEndAt: booking.bookingEndAt?.toISOString() ?? null,
    startAtLocal: booking.bookingStartAt
      ? formatLocalTime(booking.bookingStartAt, getPlatformTimeZone())
      : null,
    endAtLocal: booking.bookingEndAt
      ? formatLocalTime(booking.bookingEndAt, getPlatformTimeZone())
      : null,
    timeZone: getPlatformTimeZone(),
    usesLegacyTiming: booking.usesLegacyTiming,
    canRebook: canRebookBooking(booking as { status: string; property: { status?: string; owner?: { status: string } } }),
    originalSlotPrice:
      'originalSlotPrice' in booking && booking.originalSlotPrice != null
        ? decimalToNumber(booking.originalSlotPrice as { toNumber(): number } | number)
        : decimalToNumber(booking.totalAmount),
    promotionDiscountAmount:
      'promotionDiscountAmount' in booking && booking.promotionDiscountAmount != null
        ? decimalToNumber(booking.promotionDiscountAmount as { toNumber(): number } | number)
        : 0,
    promotionId: 'promotionId' in booking ? (booking as { promotionId?: string | null }).promotionId ?? null : null,
    couponId: 'couponId' in booking ? (booking as { couponId?: string | null }).couponId ?? null : null,
    couponCodeSnapshot:
      'couponCodeSnapshot' in booking
        ? (booking as { couponCodeSnapshot?: string | null }).couponCodeSnapshot ?? null
        : null,
    couponDiscountAmount:
      'couponDiscountAmount' in booking && booking.couponDiscountAmount != null
        ? decimalToNumber(booking.couponDiscountAmount as { toNumber(): number } | number)
        : 0,
    priceBeforeCoupon:
      'priceBeforeCoupon' in booking && booking.priceBeforeCoupon != null
        ? decimalToNumber(booking.priceBeforeCoupon as { toNumber(): number } | number)
        : null,
    platformCouponId:
      'platformCouponId' in booking ? (booking as { platformCouponId?: string | null }).platformCouponId ?? null : null,
    platformCouponCodeSnapshot:
      'platformCouponCodeSnapshot' in booking
        ? (booking as { platformCouponCodeSnapshot?: string | null }).platformCouponCodeSnapshot ?? null
        : null,
    platformDiscountAmount:
      'platformDiscountAmount' in booking && booking.platformDiscountAmount != null
        ? decimalToNumber(booking.platformDiscountAmount as { toNumber(): number } | number)
        : 0,
  };
}

export function withBookingOperationsFlags(
  summary: PublicBookingSummary,
  flags: {
    refundRequest: PublicBookingSummary['refundRequest'];
    canRequestRefund: boolean;
    canOpenDispute: boolean;
    canReview?: boolean;
    myReview?: PublicBookingSummary['myReview'];
    forceMajeureResolution?: PublicBookingSummary['forceMajeureResolution'];
  },
): PublicBookingSummary {
  return {
    ...summary,
    refundRequest: flags.refundRequest,
    canRequestRefund: flags.canRequestRefund,
    canOpenDispute: flags.canOpenDispute,
    canReview: flags.canReview,
    myReview: flags.myReview,
    forceMajeureResolution: flags.forceMajeureResolution ?? summary.forceMajeureResolution ?? null,
  };
}

export function checkoutDueNow(summary: PublicBookingSummary): {
  dueNowAmount: number;
  duePurpose: PaymentPurpose | null;
} {
  if (
    summary.paymentCollectionMode === 'full' &&
    summary.status === 'pending_payment' &&
    !summary.isFullyPaid
  ) {
    return {
      dueNowAmount: summary.customerPayableAmount ?? summary.totalAmount,
      duePurpose: 'full',
    };
  }
  if (summary.canPayDeposit) {
    const fee =
      (summary.customerPayableAmount ?? summary.totalAmount) - summary.totalAmount;
    return {
      dueNowAmount: (summary.depositAmount ?? 0) + (fee > 0 ? fee : 0),
      duePurpose: 'deposit',
    };
  }
  if (summary.canPayBalance) {
    return {
      dueNowAmount: summary.remainingAmount ?? 0,
      duePurpose: 'balance',
    };
  }
  return { dueNowAmount: 0, duePurpose: null };
}

export { snapshotToBreakdown };
