import {
  prisma,
  Prisma,
  AvailabilitySlotStatus,
  BookingPaymentState,
  BookingStatus,
  OwnerDecisionOutcome,
  PaymentCollectionMode,
  PaymentStatus,
  PayoutStatus,
  PropertyStatus,
  RefundStatus,
  OwnerStatus,
  CommissionSource,
} from '@mazare3/db';
import { SLOT_HOLDING_STATUSES, bookingSlotUnavailableError, isBookingSlotUniqueViolation } from '../lib/payment-hold.js';
import type { CreateBookingInput, RebookIntent } from '@mazare3/shared';
import {
  BOOKING_CANCELLATION_REASON,
  filsToJod,
  jodToFils,
  resolvePaymentPlan,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { assertPriorConsentsActive } from './legal/data-processing-consent.service.js';
import {
  toPublicBookingSummary,
  withBookingOperationsFlags,
} from '../mappers/public-booking.mapper.js';
import { BLOCKING_REFUND_REQUEST_STATUSES } from '@mazare3/shared';
import {
  classifyReviewEligibility,
  maybeInviteReview,
  reviewsForBookings,
} from './review.service.js';
import { canOpenDisputeForBooking } from './dispute.service.js';
import { toPaymentSummary } from '../mappers/payment.mapper.js';
import type { CheckoutBookingView } from '@mazare3/shared';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  assertCustomerBookingLegalForCommitment,
  finalizeCustomerBookingLegalEvidence,
} from './legal/customer-booking-legal.service.js';
import { mapPendingRescheduleByBookingIds } from './reschedule.service.js';
import { mapForceMajeureResolutionByBookingIds } from './force-majeure.service.js';
import { randomBytes } from 'node:crypto';
import { PAYMENT_HOLD_MINUTES } from '@mazare3/shared';
import { buildInitialPaymentOptions } from '../lib/initial-payment-choice.js';
import {
  buildBookingFinancialSnapshot,
  buildPlatformFundedSnapshot,
  evaluateCancellationPolicy,
  hoursUntilBookingStart,
  snapshotToBreakdown,
  computePayoutAvailableAt,
} from './payment-policy.service.js';
import { ensureSystemCancellationRefund } from './refund-request.service.js';
import { checkoutDueNow } from '../mappers/public-booking.mapper.js';
import {
  bookingsNeedingLifecycleRefreshWhere,
  refreshBookingPaymentLifecycle,
  releaseSlotIfUnheld,
} from './booking-hold.service.js';
import { refundableCapturedFils } from '../lib/booking-ledger.js';
import { syncPayoutStatusForPayment } from './payment-payout.service.js';
import {
  notifyBookingAccepted,
  notifyBookingCreated,
  notifyBookingRejected,
  notifyBookingRequestCreated,
} from './notification.service.js';
import { computeOwnerApprovalExpiresAt } from '../config/owner-approval-config.js';
import { expireOwnerApprovalIfNeeded } from './owner-approval-expiry.service.js';
import { resolveOwnerScope } from './owner-access.js';
import {
  releaseCouponReservationInTx,
  reserveCouponInTx,
} from './coupon.service.js';
import {
  releasePlatformCouponReservationInTx,
  reservePlatformCouponInTx,
} from './platform-coupon.service.js';
import { resolveBookingPricing } from './booking-quote.service.js';
import { resolvePropertyMediaPublicUrl } from '../lib/property-media-public-url.js';
function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

function generatePublicCode(): string {
  return `MZ-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export type FirstPaymentPlanSyncResult = {
  changed: boolean;
  fullPaymentRequired: boolean;
  hoursUntilStart: number;
  previousDepositPercent: number;
  currentDepositPercent: number;
  previousRemainingAmount: number;
  currentRemainingAmount: number;
  customerPayableTotal: number;
};

/**
 * Phase 3C.4E.2B — Recompute unpaid first-payment plan from live Booking Start.
 * Does NOT change commercial price / commission / merchant value — only deposit% /
 * due-now / remaining / balanceDueAt when the 72h boundary is crossed before first capture.
 * No-op after any successful capture (confirmed deposit Bookings keep balance architecture).
 */
export async function syncLivePaymentPlanForBooking(
  bookingId: string,
  options?: { actorUserId?: string | null; req?: AuthenticatedRequest; audit?: boolean },
): Promise<FirstPaymentPlanSyncResult | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      slot: true,
      property: { select: { depositPercent: true } },
      payments: { select: { status: true } },
    },
  });
  if (!booking) return null;
  if (
    booking.status !== BookingStatus.pending_payment &&
    booking.status !== BookingStatus.pending_owner_approval
  ) {
    return null;
  }
  if (booking.payments.some((p) => p.status === PaymentStatus.succeeded)) return null;

  const propertyDeposit =
    booking.property.depositPercent != null
      ? decimalToNumber(booking.property.depositPercent)
      : null;
  const hoursUntilStart = hoursUntilBookingStart(booking.bookingStartAt, booking.slot.date);
  const planProbe = resolvePaymentPlan({
    hoursUntilStart,
    customerPayable: decimalToNumber(booking.customerPayableTotal),
  });

  const previousDepositPercent = decimalToNumber(booking.depositPercent);
  const previousRemainingAmount = decimalToNumber(booking.remainingAmount);

  const snap = booking.platformCouponId
    ? buildPlatformFundedSnapshot({
        merchantBookingValue: decimalToNumber(
          booking.merchantBookingValue ?? booking.totalAmount,
        ),
        platformDiscountAmount: decimalToNumber(booking.platformDiscountAmount),
        propertyDepositPercent: propertyDeposit,
        slotDate: booking.slot.date,
        bookingStartAt: booking.bookingStartAt,
        platformCommissionPercent: decimalToNumber(booking.platformCommissionPercent),
        hoursUntilStart,
      })
    : buildBookingFinancialSnapshot({
        bookingTotalAmount: decimalToNumber(booking.totalAmount),
        propertyDepositPercent: propertyDeposit,
        slotDate: booking.slot.date,
        bookingStartAt: booking.bookingStartAt,
        platformCommissionPercent: decimalToNumber(booking.platformCommissionPercent),
        hoursUntilStart,
      });

  const changed =
    jodToFils(previousDepositPercent) !== jodToFils(snap.depositPercent) ||
    jodToFils(previousRemainingAmount) !== jodToFils(snap.remainingAmount);

  if (changed) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        depositPercent: snap.depositPercent,
        depositAmount: snap.depositAmount,
        remainingAmount: snap.remainingAmount,
        customerPayableTotal: snap.customerPayableTotal,
        customerServiceFeeAmount: snap.customerServiceFeeAmount,
        platformCommissionAmount: snap.platformCommissionAmount,
        ownerNetPayoutAmount: snap.ownerNetPayoutAmount,
        balanceDueAt: snap.balanceDueAt,
      },
    });

    // Stale deposit/full sessions no longer match the live due-now obligation.
    await prisma.payment.updateMany({
      where: {
        bookingId,
        status: { in: [PaymentStatus.initiated, PaymentStatus.pending] },
        purpose: { in: ['deposit', 'full'] },
      },
      data: { status: PaymentStatus.expired },
    });

    if (options?.audit !== false) {
      await createAuditLog({
        actorUserId: options?.actorUserId ?? undefined,
        action: 'booking.payment_plan_revalidated',
        entityType: 'booking',
        entityId: bookingId,
        metadata: {
          reasonCategory:
            planProbe.fullPaymentRequired && previousDepositPercent < 100
              ? 'DEPOSIT_ELIGIBLE_TO_FULL_REQUIRED_BEFORE_FIRST_CAPTURE'
              : 'FIRST_PAYMENT_PLAN_SYNC',
          previousDepositPercent,
          currentDepositPercent: snap.depositPercent,
          previousRemainingAmount,
          currentRemainingAmount: snap.remainingAmount,
          hoursUntilStart,
          fullPaymentRequired: planProbe.fullPaymentRequired,
          evaluatedAt: new Date().toISOString(),
        },
        req: options?.req,
      });
    }
  }

  return {
    changed,
    fullPaymentRequired: planProbe.fullPaymentRequired,
    hoursUntilStart,
    previousDepositPercent,
    currentDepositPercent: changed ? snap.depositPercent : previousDepositPercent,
    previousRemainingAmount,
    currentRemainingAmount: changed ? snap.remainingAmount : previousRemainingAmount,
    customerPayableTotal: decimalToNumber(
      changed ? snap.customerPayableTotal : booking.customerPayableTotal,
    ),
  };
}

const bookingInclude = {
  property: {
    select: {
      slug: true,
      titleAr: true,
      titleEn: true,
      approximateAddress: true,
      exactAddress: true,
      arrivalInstructionsAr: true,
      arrivalInstructionsEn: true,
      latitudeExact: true,
      longitudeExact: true,
      status: true,
      capacity: true,
      owner: { select: { status: true } },
    },
  },
  slot: { select: { date: true, period: true, startAt: true, endAt: true } },
  payments: true,
};

export async function createBooking(
  userId: string,
  input: CreateBookingInput,
  req?: AuthenticatedRequest,
) {
  // Purpose-specific Prior Consent before Booking Personal Data processing begins.
  // Does not re-ask every click when valid consent remains active.
  await assertPriorConsentsActive(userId, [
    'marketplace_booking_processing',
    'payment_and_refund_processing',
  ]);

  const resolved = await resolveBookingPricing({
    propertySlug: input.propertySlug,
    date: input.date,
    period: input.period,
    guestsCount: input.guestsCount,
    couponCode: input.couponCode,
    userId,
  });

  const {
    propertyId,
    ownerUserId,
    instantBookingEnabled: instant,
    slot,
    slotPrice,
    timed,
    priced,
    terms,
    payable,
    usePlatformCoupon,
    couponId,
    couponCodeSnapshot,
    couponDiscountAmount,
    priceBeforeCoupon,
    platformCouponId,
    platformCouponCodeSnapshot,
    platformDiscountAmount,
    snap,
  } = resolved;

  const promotionApplies = Boolean(priced.promotionId && priced.discountAmount > 0);

  // Phase 3C.4D.6 — capture gate summary before TX (avoid nested writes inside Booking TX)
  const { evaluatePropertyBookability } = await import('./property-bookability.service.js');
  const gateSummary = await evaluatePropertyBookability(propertyId, 'new_booking');

  // Phase 3C.4E.4A — server-authoritative legal corpus before commitment
  const locale: 'ar' | 'en' = 'ar';
  let legalSet;
  try {
    legalSet = await assertCustomerBookingLegalForCommitment({
      userId,
      submitted: input.acceptedDocumentVersionIds ?? null,
      locale,
    });
  } catch (err) {
    if (err instanceof AppError && err.code === 'CUSTOMER_BOOKING_LEGAL_TERMS_UNAVAILABLE') {
      throw err;
    }
    throw err;
  }

  if (
    input.expectedTotalAmount != null &&
    jodToFils(input.expectedTotalAmount) !== jodToFils(payable)
  ) {
    throw new AppError(
      409,
      'PRICING_CHANGED',
      'The offer or price changed. Refresh and try again.',
      {
        originalPrice: priceBeforeCoupon ?? priced.originalPrice,
        discountAmount: couponDiscountAmount || platformDiscountAmount || priced.discountAmount,
        finalPrice: payable,
        promotionId: priced.promotionId,
        couponId,
        platformCouponId,
      },
    );
  }

  try {
    const booking = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Property" WHERE id = ${propertyId} FOR UPDATE`,
      );

      const activeOnSlot = await tx.booking.findFirst({
        where: {
          availabilitySlotId: slot.id,
          status: { in: SLOT_HOLDING_STATUSES },
        },
      });
      if (activeOnSlot) {
        throw bookingSlotUnavailableError();
      }

      const timedSlot = slot.startAt && slot.endAt;
      if (timedSlot) {
        const overlaps = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT b.id
          FROM "Booking" b
          INNER JOIN "AvailabilitySlot" s ON s.id = b."availabilitySlotId"
          WHERE b."propertyId" = ${propertyId}
            AND b.status IN ('pending_owner_approval', 'pending_payment', 'pending', 'confirmed')
            AND (
              (b."bookingStartAt" IS NOT NULL AND b."bookingEndAt" IS NOT NULL
                AND b."bookingStartAt" < ${slot.endAt} AND b."bookingEndAt" > ${slot.startAt})
              OR
              (s."startAt" IS NOT NULL AND s."endAt" IS NOT NULL
                AND s."startAt" < ${slot.endAt} AND s."endAt" > ${slot.startAt})
            )
          LIMIT 1
        `);
        if (overlaps.length > 0) {
          throw bookingSlotUnavailableError(
            'This time overlaps another booking on this property',
          );
        }
      }

      const updated = await tx.availabilitySlot.updateMany({
        where: { id: slot.id, status: AvailabilitySlotStatus.available },
        data: { status: AvailabilitySlotStatus.booked },
      });

      if (updated.count !== 1) {
        throw bookingSlotUnavailableError();
      }

      const holdExpiresAt = instant ? new Date() : null;
      if (holdExpiresAt) {
        holdExpiresAt.setMinutes(holdExpiresAt.getMinutes() + PAYMENT_HOLD_MINUTES);
      }
      const ownerApprovalExpiresAt = instant ? null : computeOwnerApprovalExpiresAt();

      const created = await tx.booking.create({
        data: {
          publicCode: generatePublicCode(),
          userId,
          propertyId,
          availabilitySlotId: slot.id,
          guestsCount: input.guestsCount,
          totalAmount: snap.bookingTotalAmount,
          currency: snap.currency,
          commercialTermsId: terms.termsId,
          commissionSource: terms.source as CommissionSource,
          ownerPayoutDelayHours: terms.payoutDelayHours,
          status: instant
            ? BookingStatus.pending_payment
            : BookingStatus.pending_owner_approval,
          instantBookingEnabled: instant,
          ownerDecisionAt: null,
          ownerDecisionReason: null,
          paymentCollectionMode: PaymentCollectionMode.deposit_balance,
          paymentState: BookingPaymentState.unpaid,
          depositPercent: snap.depositPercent,
          depositAmount: snap.depositAmount,
          remainingAmount: snap.remainingAmount,
          platformCommissionPercent: snap.platformCommissionPercent,
          platformCommissionAmount: snap.platformCommissionAmount,
          ownerNetPayoutAmount: snap.ownerNetPayoutAmount,
          customerServiceFeeAmount: snap.customerServiceFeeAmount,
          customerPayableTotal: snap.customerPayableTotal,
          originalSlotPrice: priced.originalPrice,
          promotionDiscountAmount: couponId || usePlatformCoupon ? 0 : priced.discountAmount,
          promotionId: couponId || usePlatformCoupon ? null : priced.promotionId,
          couponId,
          couponCodeSnapshot,
          couponDiscountAmount,
          priceBeforeCoupon,
          platformCouponId,
          platformCouponCodeSnapshot,
          platformDiscountAmount,
          merchantBookingValue: usePlatformCoupon
            ? snap.bookingTotalAmount
            : payable,
          commissionBasisAmount: snap.bookingTotalAmount,
          balanceDueAt: snap.balanceDueAt,
          holdExpiresAt,
          ownerApprovalExpiresAt,
          bookingStartAt: timed ? slot.startAt : null,
          bookingEndAt: timed ? slot.endAt : null,
          usesLegacyTiming: !timed,
        },
        include: bookingInclude,
      });
      if (input.couponCode && usePlatformCoupon) {
        await reservePlatformCouponInTx(tx, {
          propertyId,
          userId,
          bookingId: created.id,
          code: input.couponCode,
          slotPrice,
          promotionApplies,
        });
      } else if (input.couponCode) {
        await reserveCouponInTx(tx, {
          propertyId,
          userId,
          bookingId: created.id,
          code: input.couponCode,
          slotPrice,
          promotionApplies,
        });
      }

      // Phase 3C.4D.6 — immutable listing snapshot required for NEW Booking (same TX)
      const { createInitialBookingListingSnapshot } = await import(
        './booking-listing-snapshot.service.js'
      );
      await createInitialBookingListingSnapshot({
        bookingId: created.id,
        propertyId,
        booking: {
          currency: created.currency,
          totalAmount: created.totalAmount,
          platformCommissionPercent: created.platformCommissionPercent,
        },
        policyVersionRefs: {
          termsVersionId: legalSet.corpusReady ? legalSet.terms!.versionId : undefined,
          cancellationPolicyVersionId: legalSet.corpusReady
            ? legalSet.cancellation!.versionId
            : undefined,
          bookingTermsVersionId: legalSet.corpusReady
            ? legalSet.bookingTerms!.versionId
            : undefined,
          privacyNoticeVersionId: legalSet.privacy?.versionId,
        },
        gateSummary: {
          eligible: gateSummary.eligible,
          layers: {
            regulatoryReadiness: gateSummary.layers.regulatoryReadiness,
            authorityReviewStatus: gateSummary.layers.authorityReviewStatus,
          },
        },
        tx,
      });

      // Phase 3C.4E.4A.1 — snapshot + LegalAcceptance in SAME TX as Booking
      // (ACTIVE versions only; no DRAFT fabricate; no after-commit acceptance gap)
      await finalizeCustomerBookingLegalEvidence({
        userId,
        bookingId: created.id,
        legalSet,
        submitted: input.acceptedDocumentVersionIds ?? null,
        commissionPercent: Number(created.platformCommissionPercent),
        depositPercent: Number(created.depositPercent),
        req,
        tx,
        phase: 'all',
      });

      return created;
    }, { timeout: 30_000, maxWait: 10_000 });

    if (legalSet.corpusReady) {
      await createAuditLog({
        actorUserId: userId,
        action: 'booking.legal_acceptance_atomic',
        entityType: 'booking',
        entityId: booking.id,
        metadata: {
          acceptancePresentationKey: legalSet.acceptancePresentationKey,
          termsVersionId: legalSet.terms?.versionId,
          cancellationPolicyVersionId: legalSet.cancellation?.versionId,
          bookingTermsVersionId: legalSet.bookingTerms?.versionId,
          note: 'LegalAcceptance persisted in Booking TX (3C.4E.4A.1)',
        },
        req,
      });
    }

    await createAuditLog({
      actorUserId: userId,
      action: instant ? 'booking.created' : 'booking.request_created',
      entityType: 'booking',
      entityId: booking.id,
      metadata: {
        publicCode: booking.publicCode,
        propertySlug: input.propertySlug,
        instantBookingEnabled: instant,
        legalCorpusReady: legalSet.corpusReady,
        legalEvidenceAtomic: true,
      },
      req,
    });

    if (instant) {
      void notifyBookingCreated({
        customerUserId: userId,
        bookingId: booking.id,
        publicCode: booking.publicCode,
        propertyTitleAr: booking.property.titleAr,
        propertyTitleEn: booking.property.titleEn ?? booking.property.titleAr,
      }).catch((err) => console.error('[notifications] booking.created', err));
    } else {
      void notifyBookingRequestCreated({
        ownerUserId,
        bookingId: booking.id,
        publicCode: booking.publicCode,
        propertyTitleAr: booking.property.titleAr,
        propertyTitleEn: booking.property.titleEn ?? booking.property.titleAr,
      }).catch((err) => console.error('[notifications] booking.request_created', err));
    }

    return toPublicBookingSummary(booking);
  } catch (err) {
    if (err instanceof AppError && (err.code === 'BOOKING_SLOT_UNAVAILABLE' || err.code === 'SLOT_UNAVAILABLE')) {
      await createAuditLog({
        actorUserId: userId,
        action: 'booking.slot_conflict',
        entityType: 'availability_slot',
        entityId: slot.id,
        metadata: {
          propertyId,
          propertySlug: input.propertySlug,
          date: input.date,
          period: input.period,
          context: 'booking.create',
        },
        req,
      });
      throw err.code === 'SLOT_UNAVAILABLE' ? bookingSlotUnavailableError() : err;
    }
    if (isBookingSlotUniqueViolation(err)) {
      await createAuditLog({
        actorUserId: userId,
        action: 'booking.slot_conflict',
        entityType: 'availability_slot',
        entityId: slot.id,
        metadata: {
          propertyId,
          propertySlug: input.propertySlug,
          date: input.date,
          period: input.period,
          context: 'booking.create',
          reason: 'unique_violation',
        },
        req,
      });
      throw bookingSlotUnavailableError();
    }
    throw err;
  }
}

async function enrichBookingSummariesForCustomer(
  userId: string,
  rows: Awaited<ReturnType<typeof prisma.booking.findMany<{ include: typeof bookingInclude }>>>,
) {
  const ids = rows.map((r) => r.id);
  const { mapInitialListingSnapshotsByBookingIds, applyListingSnapshotIdentity } = await import(
    './booking-listing-snapshot.service.js'
  );
  const [refunds, disputes, reviewMap, fmByBooking, snapByBooking] = await Promise.all([
    prisma.refundRequest.findMany({
      where: {
        bookingId: { in: ids },
        customerId: userId,
      },
      orderBy: { createdAt: 'desc' },
      include: { allocations: true },
    }),
    prisma.dispute.findMany({
      where: { bookingId: { in: ids }, openedByUserId: userId },
      orderBy: { createdAt: 'desc' },
    }),
    reviewsForBookings(ids),
    mapForceMajeureResolutionByBookingIds(ids),
    mapInitialListingSnapshotsByBookingIds(ids),
  ]);

  const refundByBooking = new Map<string, (typeof refunds)[0]>();
  for (const r of refunds) {
    if (!refundByBooking.has(r.bookingId)) refundByBooking.set(r.bookingId, r);
  }
  const disputeByBooking = new Map<string, (typeof disputes)[0]>();
  for (const d of disputes) {
    if (!disputeByBooking.has(d.bookingId)) disputeByBooking.set(d.bookingId, d);
  }

  const reviewInviteIds: string[] = [];
  const pendingByBooking = await mapPendingRescheduleByBookingIds(ids);
  const summaries = rows.map((row) => {
    const summary = applyListingSnapshotIdentity(
      toPublicBookingSummary(row),
      snapByBooking.get(row.id),
    );
    summary.pendingReschedule = pendingByBooking.get(row.id) ?? null;
    const hasCaptured = row.payments.some((p) => p.status === PaymentStatus.succeeded);
    const refundRow = refundByBooking.get(row.id);
    const hasBlockingRefund =
      refundRow &&
      (BLOCKING_REFUND_REQUEST_STATUSES as readonly string[]).includes(refundRow.status);
    const refundRequest = refundRow
      ? (() => {
          const refundedAmount = decimalToNumber(refundRow.refundedAmount ?? 0);
          const requestedAmount = decimalToNumber(refundRow.requestedAmount);
          const remainingAmount = Math.max(
            0,
            Math.round((requestedAmount - refundedAmount) * 100) / 100,
          );
          const allocations = (refundRow.allocations ?? []).map((a) => ({
            id: a.id,
            paymentId: a.paymentId,
            status: a.status,
            allocatedAmount: decimalToNumber(a.allocatedAmount),
            refundedAmount: decimalToNumber(a.refundedAmount),
            providerRefundRef: a.providerRefundRef,
            lastError: a.lastError,
          }));
          let aggregateLabel:
            | 'pending'
            | 'partially_refunded'
            | 'refunded'
            | 'action_required' = 'pending';
          if (refundRow.status === 'processed' || remainingAmount <= 0.001) {
            aggregateLabel = 'refunded';
          } else if (refundedAmount > 0 && remainingAmount > 0.001) {
            aggregateLabel = allocations.some((a) => a.status === 'failed')
              ? 'action_required'
              : 'partially_refunded';
          } else if (allocations.some((a) => a.status === 'failed')) {
            aggregateLabel = 'action_required';
          }
          return {
            id: refundRow.id,
            bookingId: refundRow.bookingId,
            status: refundRow.status,
            policyRefundAmount: decimalToNumber(refundRow.policyRefundAmount),
            requestedAmount,
            approvedAmount:
              refundRow.approvedAmount != null
                ? decimalToNumber(refundRow.approvedAmount)
                : null,
            refundedAmount,
            remainingAmount,
            aggregateLabel,
            allocations,
            reason: refundRow.reason,
            adminNote: refundRow.adminNote,
            createdAt: refundRow.createdAt.toISOString(),
            updatedAt: refundRow.updatedAt.toISOString(),
          };
        })()
      : null;

    const existingReview = reviewMap.get(row.id);
    const verdict = classifyReviewEligibility(
      {
        userId: row.userId,
        status: row.status,
        paymentState: row.paymentState,
        paymentCollectionMode: row.paymentCollectionMode,
        customerPayableTotal: row.customerPayableTotal,
        payments: row.payments,
        refundRequests: refunds.filter((r) => r.bookingId === row.id),
        review: existingReview ?? null,
        bookingEndAt: row.bookingEndAt,
        slot: row.slot,
      },
      userId,
    );
    if (verdict.eligible) {
      reviewInviteIds.push(row.id);
    }

    return withBookingOperationsFlags(summary, {
      refundRequest,
      canRequestRefund:
        hasCaptured &&
        row.status === BookingStatus.confirmed &&
        row.paymentState !== 'refunded' &&
        !hasBlockingRefund,
      canOpenDispute:
        hasCaptured &&
        canOpenDisputeForBooking(row.status, true, row.slot.date) &&
        !disputeByBooking.get(row.id),
      canReview: verdict.eligible,
      myReview: existingReview
        ? {
            id: existingReview.id,
            rating: existingReview.rating,
            comment: existingReview.comment,
            status: existingReview.status,
            createdAt: existingReview.createdAt.toISOString(),
          }
        : null,
      forceMajeureResolution: fmByBooking.get(row.id) ?? null,
    });
  });

  void (async () => {
    for (const id of reviewInviteIds) {
      await maybeInviteReview(userId, id).catch((err) =>
        console.error('[notifications] review.invite', err),
      );
    }
  })();

  return summaries;
}

export async function listMyBookings(userId: string) {
  const due = await prisma.booking.findMany({
    where: bookingsNeedingLifecycleRefreshWhere(userId),
    select: { id: true },
  });
  for (const b of due) {
    await refreshBookingPaymentLifecycle(b.id);
  }

  const rows = await prisma.booking.findMany({
    where: { userId },
    include: bookingInclude,
    orderBy: { createdAt: 'desc' },
  });

  return enrichBookingSummariesForCustomer(userId, rows);
}

export async function getMyBookingById(userId: string, bookingId: string) {
  await refreshBookingPaymentLifecycle(bookingId);
  const row = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: bookingInclude,
  });

  if (!row) return null;
  const [enriched] = await enrichBookingSummariesForCustomer(userId, [row]);
  return enriched ?? null;
}

export async function getRebookIntent(userId: string, bookingId: string): Promise<RebookIntent> {
  const row = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: {
      property: {
        select: {
          id: true,
          slug: true,
          status: true,
          capacity: true,
          owner: { select: { status: true } },
        },
      },
      slot: { select: { period: true } },
    },
  });
  if (!row) {
    throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  }
  if (
    row.status === BookingStatus.pending ||
    row.status === BookingStatus.pending_payment ||
    row.status === BookingStatus.pending_owner_approval
  ) {
    throw new AppError(400, 'REBOOK_NOT_ELIGIBLE', 'This booking cannot be used to book again');
  }

  const capacity = row.property.capacity;
  const guestsToApply = Math.min(Math.max(1, row.guestsCount), capacity);
  const { evaluatePropertyBookability } = await import('./property-bookability.service.js');
  const evalResult = await evaluatePropertyBookability(row.property.id, 'new_booking');
  return {
    bookable: evalResult.canBook,
    propertySlug: row.property.slug,
    propertyCapacity: capacity,
    guestsCount: row.guestsCount,
    guestsToApply,
    guestsCapped: row.guestsCount > capacity,
    preferredPeriod: row.slot.period,
  };
}

export async function getCheckoutBooking(
  userId: string,
  bookingId: string,
): Promise<CheckoutBookingView | null> {
  await refreshBookingPaymentLifecycle(bookingId);
  await syncLivePaymentPlanForBooking(bookingId);
  const row = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: bookingInclude,
  });
  if (!row) return null;

  const summary = toPublicBookingSummary(row);
  const due = checkoutDueNow(summary);
  const latestMatching =
    row.payments.find(
      (p) =>
        due.duePurpose &&
        p.purpose === due.duePurpose &&
        (p.status === PaymentStatus.initiated || p.status === PaymentStatus.pending),
    ) ??
    row.payments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  let paymentSummary = latestMatching ? toPaymentSummary(latestMatching) : null;
  if (latestMatching?.status === PaymentStatus.succeeded) {
    await syncPayoutStatusForPayment(latestMatching.id);
    const synced = await prisma.payment.findUnique({ where: { id: latestMatching.id } });
    if (synced) paymentSummary = toPaymentSummary(synced);
  }

  const pricing = snapshotToBreakdown({
    bookingTotalAmount: decimalToNumber(row.totalAmount),
    depositPercent: decimalToNumber(row.depositPercent),
    depositAmount: decimalToNumber(row.depositAmount),
    remainingAmount: decimalToNumber(row.remainingAmount),
    platformCommissionPercent: decimalToNumber(row.platformCommissionPercent),
    platformCommissionAmount: decimalToNumber(row.platformCommissionAmount),
    ownerGrossAmount: decimalToNumber(row.totalAmount),
    ownerNetPayoutAmount: decimalToNumber(row.ownerNetPayoutAmount),
    customerServiceFeePercent: 0,
    customerServiceFeeAmount: decimalToNumber(row.customerServiceFeeAmount),
    customerPayableTotal: decimalToNumber(row.customerPayableTotal),
    depositDueAmount: decimalToNumber(row.depositAmount) + decimalToNumber(row.customerServiceFeeAmount),
    balanceDueAmount: decimalToNumber(row.remainingAmount),
    currency: row.currency,
  });

  const cover = await prisma.propertyMedia.findFirst({
    where: { propertyId: row.propertyId, type: 'image' },
    orderBy: { sortOrder: 'asc' },
    select: { url: true, storageKey: true, thumbnailUrl: true },
  });
  const propertyCoverUrl = cover
    ? resolvePropertyMediaPublicUrl({
        url: cover.thumbnailUrl || cover.url,
        storageKey: cover.storageKey,
      })
    : null;

  const hoursUntilStart = hoursUntilBookingStart(row.bookingStartAt, row.slot.date);
  const paymentPlan = resolvePaymentPlan({
    hoursUntilStart,
    customerPayable: decimalToNumber(row.customerPayableTotal),
    depositPercent: decimalToNumber(row.depositPercent),
  });

  const choiceBuilt = buildInitialPaymentOptions({
    status: row.status,
    paymentCollectionMode: row.paymentCollectionMode,
    paymentState: row.paymentState,
    holdExpiresAt: row.holdExpiresAt,
    depositAmount: decimalToNumber(row.depositAmount),
    remainingAmount: decimalToNumber(row.remainingAmount),
    customerServiceFeeAmount: decimalToNumber(row.customerServiceFeeAmount),
    customerPayableTotal: decimalToNumber(row.customerPayableTotal),
    fullPaymentRequired: paymentPlan.fullPaymentRequired,
    payments: row.payments.map((p) => ({
      status: p.status,
      purpose: p.purpose,
      providerRef: p.providerRef,
    })),
  });

  // When Deposit/Full choice is available, surface deposit due by default for CTA consistency.
  let dueNowAmount = due.dueNowAmount;
  let duePurpose = due.duePurpose;
  if (choiceBuilt.options && choiceBuilt.defaultChoice) {
    const selected =
      choiceBuilt.options.find((o) => o.choice === choiceBuilt.defaultChoice) ??
      choiceBuilt.options[0]!;
    dueNowAmount = selected.dueNowAmount;
    duePurpose = selected.choice === 'full' ? 'full' : 'deposit';
  }

  return {
    ...summary,
    payment: paymentSummary,
    pricing,
    dueNowAmount,
    duePurpose,
    propertyCoverUrl,
    initialPaymentOptions: choiceBuilt.options,
    defaultInitialPaymentChoice: choiceBuilt.defaultChoice,
    initialPaymentChoiceLocked: choiceBuilt.choiceLocked,
    lockedInitialPaymentChoice: choiceBuilt.lockedChoice,
  };
}

export async function cancelMyBooking(
  userId: string,
  bookingId: string,
  req?: AuthenticatedRequest,
) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: { slot: true, payments: true, refundRequests: { include: { allocations: true } } },
  });

  if (!booking) {
    throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  }

  if (
    booking.status === BookingStatus.cancelled ||
    booking.status === BookingStatus.expired
  ) {
    throw new AppError(400, 'INVALID_STATUS', 'Booking cannot be cancelled');
  }

  if (
    booking.status !== BookingStatus.pending_payment &&
    booking.status !== BookingStatus.pending_owner_approval &&
    booking.status !== BookingStatus.confirmed
  ) {
    throw new AppError(400, 'INVALID_STATUS', 'Booking cannot be cancelled');
  }

  let cancellationMeta: Record<string, unknown> | undefined;

  if (booking.status === BookingStatus.confirmed) {
    const funds = refundableCapturedFils(booking.payments, booking.refundRequests);
    if (funds.captured <= 0) {
      throw new AppError(400, 'INVALID_STATUS', 'Booking cannot be cancelled');
    }
    const capturedJod = filsToJod(funds.captured);
    const merchantValue = decimalToNumber(booking.merchantBookingValue ?? booking.totalAmount);
    const commissionPercent = decimalToNumber(booking.platformCommissionPercent);
    const policy = evaluateCancellationPolicy(
      merchantValue,
      capturedJod,
      booking.bookingStartAt,
      booking.slot.date,
      commissionPercent,
      new Date(),
      booking.rescheduleCount > 0
        ? { originalBookingStartAt: booking.originalBookingStartAt, applyRescheduleAnchor: true }
        : undefined,
    );
    if (!policy.canCancel) {
      throw new AppError(
        400,
        'CANCELLATION_NOT_ALLOWED',
        policy.reason ?? 'Cancellation is not allowed for this booking',
      );
    }
    const refundableAmount = Math.min(policy.refundableAmount, filsToJod(funds.refundable));
    cancellationMeta = {
      refundableAmount,
      cancellationPenaltyAmount: policy.retainedAmount,
      retainedAmount: policy.retainedAmount,
      platformRetained: policy.platformRetained,
      ownerRetained: policy.ownerRetained,
      chargePercent: policy.chargePercent,
      refundPercent: policy.refundPercent,
      tier: policy.tier,
    };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.cancelled,
        cancelledAt: new Date(),
        ...(booking.status === BookingStatus.confirmed
          ? { cancellationReasonCode: BOOKING_CANCELLATION_REASON.CUSTOMER_CANCEL }
          : {}),
      },
      include: bookingInclude,
    });

    if (booking.status === BookingStatus.confirmed && cancellationMeta) {
      const refundAmt = cancellationMeta.refundableAmount as number;
      const retainedAmt = cancellationMeta.retainedAmount as number;
      const payoutAvailableAt = computePayoutAvailableAt(booking.slot.date);
      await tx.payment.updateMany({
        where: { bookingId: booking.id, status: PaymentStatus.succeeded },
        data: {
          refundStatus: refundAmt > 0 ? RefundStatus.pending : RefundStatus.none,
          cancellationRefundAmount: refundAmt,
          cancellationPenaltyAmount: retainedAmt,
          platformCommissionAmount: cancellationMeta.platformRetained as number,
          ownerNetPayoutAmount: cancellationMeta.ownerRetained as number,
          ownerGrossAmount: retainedAmt,
          payoutStatus: PayoutStatus.blocked,
          payoutAvailableAt,
        },
      });
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          platformCommissionAmount: cancellationMeta.platformRetained as number,
          ownerNetPayoutAmount: cancellationMeta.ownerRetained as number,
        },
      });
    } else {
      await tx.payment.updateMany({
        where: {
          bookingId: booking.id,
          status: { in: [PaymentStatus.initiated, PaymentStatus.pending] },
        },
        data: { status: PaymentStatus.cancelled },
      });
    }

    await tx.availabilitySlot.update({
      where: { id: booking.availabilitySlotId },
      data: { status: AvailabilitySlotStatus.available },
    });
    await releaseCouponReservationInTx(tx, booking.id);
    await releasePlatformCouponReservationInTx(tx, booking.id);

    return b;
  });

  const auditAction =
    booking.status === BookingStatus.confirmed
      ? 'booking.cancel_requested'
      : 'booking.cancelled';

  await createAuditLog({
    actorUserId: userId,
    action: auditAction,
    entityType: 'booking',
    entityId: booking.id,
    metadata: { publicCode: booking.publicCode, ...cancellationMeta },
    req,
  });

  if (booking.status === BookingStatus.confirmed && cancellationMeta) {
    await ensureSystemCancellationRefund({
      bookingId: booking.id,
      customerId: userId,
      customerRefund: cancellationMeta.refundableAmount as number,
      retainedAmount: cancellationMeta.retainedAmount as number,
      tier: cancellationMeta.tier as string | undefined,
      req,
    });
    const succeeded = await prisma.payment.findMany({
      where: { bookingId: booking.id, status: PaymentStatus.succeeded },
      select: { id: true },
    });
    for (const p of succeeded) {
      await syncPayoutStatusForPayment(p.id);
    }
  }

  return toPublicBookingSummary(updated);
}

async function loadOwnerBookingForDecision(ownerUserId: string, role: import('@mazare3/shared').UserRole, bookingId: string) {
  const scope = await resolveOwnerScope(ownerUserId, role);
  if (scope.isAdmin || !scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Owner access required');
  }

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, property: { ownerId: scope.ownerProfileId } },
    include: {
      property: {
        select: {
          id: true,
          status: true,
          ownerId: true,
          titleAr: true,
          titleEn: true,
          owner: { select: { status: true, userId: true } },
        },
      },
      slot: true,
      user: { select: { id: true } },
    },
  });
  if (!booking) {
    throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  }
  return booking;
}

export async function acceptOwnerBooking(
  ownerUserId: string,
  role: import('@mazare3/shared').UserRole,
  bookingId: string,
  req?: AuthenticatedRequest,
) {
  await expireOwnerApprovalIfNeeded(bookingId);
  const booking = await loadOwnerBookingForDecision(ownerUserId, role, bookingId);

  if (booking.status === BookingStatus.expired) {
    throw new AppError(409, 'OWNER_APPROVAL_EXPIRED', 'The owner response deadline has passed');
  }
  if (booking.status !== BookingStatus.pending_owner_approval) {
    throw new AppError(409, 'OWNER_DECISION_ALREADY_MADE', 'This request is no longer awaiting approval');
  }
  if (booking.property.owner.status !== OwnerStatus.approved) {
    throw new AppError(
      409,
      'PARTNER_NOT_BOOKABLE',
      'This Property is currently unavailable for Booking.',
    );
  }
  if (booking.property.status !== PropertyStatus.published) {
    throw new AppError(
      409,
      'PROPERTY_NOT_BOOKABLE',
      'This Property is currently unavailable for Booking.',
    );
  }
  // Phase 3C.4D.4B — re-check authority + regulatory READY before accepting unpaid request
  {
    const { assertPropertyEligibleForNewPaidBooking } = await import(
      './property-bookability.service.js'
    );
    await assertPropertyEligibleForNewPaidBooking(booking.property.id, 'owner_accept');
  }
  if (booking.slot.status !== AvailabilitySlotStatus.booked) {
    throw new AppError(409, 'SLOT_UNAVAILABLE', 'This time slot is no longer valid');
  }

  const holdExpiresAt = new Date();
  holdExpiresAt.setMinutes(holdExpiresAt.getMinutes() + PAYMENT_HOLD_MINUTES);
  const decidedAt = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`);
    const now = new Date();
    const result = await tx.booking.updateMany({
      where: {
        id: bookingId,
        status: BookingStatus.pending_owner_approval,
        ownerApprovalExpiresAt: { gt: now },
      },
      data: {
        status: BookingStatus.pending_payment,
        ownerDecisionAt: decidedAt,
        ownerDecisionReason: null,
        ownerDecisionOutcome: OwnerDecisionOutcome.accepted,
        holdExpiresAt,
      },
    });
    if (result.count !== 1) {
      throw new AppError(409, 'OWNER_DECISION_ALREADY_MADE', 'This request is no longer awaiting approval');
    }

    const current = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: {
        slot: true,
        property: { select: { depositPercent: true } },
      },
    });
    const propertyDeposit =
      current.property.depositPercent != null
        ? decimalToNumber(current.property.depositPercent)
        : null;
    const hoursUntilStart = hoursUntilBookingStart(current.bookingStartAt, current.slot.date);
    const snap = current.platformCouponId
      ? buildPlatformFundedSnapshot({
          merchantBookingValue: decimalToNumber(
            current.merchantBookingValue ?? current.totalAmount,
          ),
          platformDiscountAmount: decimalToNumber(current.platformDiscountAmount),
          propertyDepositPercent: propertyDeposit,
          slotDate: current.slot.date,
          bookingStartAt: current.bookingStartAt,
          platformCommissionPercent: decimalToNumber(current.platformCommissionPercent),
          hoursUntilStart,
        })
      : buildBookingFinancialSnapshot({
          bookingTotalAmount: decimalToNumber(current.totalAmount),
          propertyDepositPercent: propertyDeposit,
          slotDate: current.slot.date,
          bookingStartAt: current.bookingStartAt,
          platformCommissionPercent: decimalToNumber(current.platformCommissionPercent),
          hoursUntilStart,
        });

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        depositPercent: snap.depositPercent,
        depositAmount: snap.depositAmount,
        remainingAmount: snap.remainingAmount,
        customerPayableTotal: snap.customerPayableTotal,
        customerServiceFeeAmount: snap.customerServiceFeeAmount,
        platformCommissionAmount: snap.platformCommissionAmount,
        ownerNetPayoutAmount: snap.ownerNetPayoutAmount,
        balanceDueAt: snap.balanceDueAt,
      },
    });

    return tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: bookingInclude,
    });
  });

  await createAuditLog({
    actorUserId: ownerUserId,
    action: 'booking.owner_accepted',
    entityType: 'booking',
    entityId: bookingId,
    metadata: { publicCode: booking.publicCode },
    req,
  });

  void notifyBookingAccepted({
    customerUserId: booking.userId,
    bookingId,
    publicCode: booking.publicCode,
    propertyTitleAr: booking.property.titleAr,
    propertyTitleEn: booking.property.titleEn ?? booking.property.titleAr,
  }).catch((err) => console.error('[notifications] booking.accepted', err));

  return toPublicBookingSummary(updated);
}

export async function rejectOwnerBooking(
  ownerUserId: string,
  role: import('@mazare3/shared').UserRole,
  bookingId: string,
  reason: string | undefined,
  req?: AuthenticatedRequest,
) {
  await expireOwnerApprovalIfNeeded(bookingId);
  const booking = await loadOwnerBookingForDecision(ownerUserId, role, bookingId);

  if (booking.status === BookingStatus.expired) {
    throw new AppError(409, 'OWNER_APPROVAL_EXPIRED', 'The owner response deadline has passed');
  }
  if (booking.status !== BookingStatus.pending_owner_approval) {
    throw new AppError(409, 'OWNER_DECISION_ALREADY_MADE', 'This request is no longer awaiting approval');
  }

  const decidedAt = new Date();
  const trimmed = reason?.trim() || null;

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`);
    const now = new Date();
    const result = await tx.booking.updateMany({
      where: {
        id: bookingId,
        status: BookingStatus.pending_owner_approval,
        ownerApprovalExpiresAt: { gt: now },
      },
      data: {
        status: BookingStatus.cancelled,
        cancelledAt: decidedAt,
        ownerDecisionAt: decidedAt,
        ownerDecisionReason: trimmed,
        ownerDecisionOutcome: OwnerDecisionOutcome.rejected,
      },
    });
    if (result.count !== 1) {
      throw new AppError(409, 'OWNER_DECISION_ALREADY_MADE', 'This request is no longer awaiting approval');
    }
    await tx.payment.updateMany({
      where: {
        bookingId,
        status: { in: [PaymentStatus.initiated, PaymentStatus.pending] },
      },
      data: { status: PaymentStatus.cancelled },
    });
    await releaseSlotIfUnheld(tx, booking.availabilitySlotId, bookingId);
    await releaseCouponReservationInTx(tx, bookingId);
    await releasePlatformCouponReservationInTx(tx, bookingId);
  });

  await createAuditLog({
    actorUserId: ownerUserId,
    action: 'booking.owner_rejected',
    entityType: 'booking',
    entityId: bookingId,
    metadata: { publicCode: booking.publicCode, reason: trimmed },
    req,
  });

  void notifyBookingRejected({
    customerUserId: booking.userId,
    bookingId,
    publicCode: booking.publicCode,
    propertyTitleAr: booking.property.titleAr,
    propertyTitleEn: booking.property.titleEn ?? booking.property.titleAr,
    reason: trimmed,
  }).catch((err) => console.error('[notifications] booking.rejected', err));

  const row = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: bookingInclude,
  });
  return toPublicBookingSummary(row);
}
