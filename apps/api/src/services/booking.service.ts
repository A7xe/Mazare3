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
import { SLOT_HOLDING_STATUSES } from '../lib/payment-hold.js';
import type { CreateBookingInput, RebookIntent } from '@mazare3/shared';
import {
  BOOKING_CANCELLATION_REASON,
  filsToJod,
  jodToFils,
  resolvePaymentPlan,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import {
  toPublicBookingSummary,
  withBookingOperationsFlags,
  isPropertyCurrentlyBookable,
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

async function syncLivePaymentPlanForBooking(bookingId: string): Promise<boolean> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      slot: true,
      property: { select: { depositPercent: true } },
      payments: { select: { status: true } },
    },
  });
  if (!booking) return false;
  if (
    booking.status !== BookingStatus.pending_payment &&
    booking.status !== BookingStatus.pending_owner_approval
  ) {
    return false;
  }
  if (booking.payments.some((p) => p.status === PaymentStatus.succeeded)) return false;

  const propertyDeposit =
    booking.property.depositPercent != null
      ? decimalToNumber(booking.property.depositPercent)
      : null;
  const hoursUntilStart = hoursUntilBookingStart(booking.bookingStartAt, booking.slot.date);

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
    jodToFils(decimalToNumber(booking.depositPercent)) !== jodToFils(snap.depositPercent) ||
    jodToFils(decimalToNumber(booking.remainingAmount)) !== jodToFils(snap.remainingAmount);

  if (!changed) return false;

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
  return true;
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
        throw new AppError(409, 'SLOT_UNAVAILABLE', 'This time slot is not available for booking');
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
          throw new AppError(
            409,
            'SLOT_UNAVAILABLE',
            'This time overlaps another booking on this property',
          );
        }
      }

      const updated = await tx.availabilitySlot.updateMany({
        where: { id: slot.id, status: AvailabilitySlotStatus.available },
        data: { status: AvailabilitySlotStatus.booked },
      });

      if (updated.count !== 1) {
        throw new AppError(409, 'SLOT_UNAVAILABLE', 'This time slot was just booked');
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
      return created;
    }, { timeout: 20_000, maxWait: 10_000 });

    await createAuditLog({
      actorUserId: userId,
      action: instant ? 'booking.created' : 'booking.request_created',
      entityType: 'booking',
      entityId: booking.id,
      metadata: {
        publicCode: booking.publicCode,
        propertySlug: input.propertySlug,
        instantBookingEnabled: instant,
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
    if (err instanceof AppError && err.code === 'SLOT_UNAVAILABLE') {
      await createAuditLog({
        actorUserId: userId,
        action: 'booking.conflict_rejected',
        entityType: 'availability_slot',
        entityId: slot.id,
        metadata: { propertySlug: input.propertySlug, date: input.date, period: input.period },
        req,
      });
      throw err;
    }
    const prismaCode = (err as { code?: string })?.code;
    if (prismaCode === 'P2002') {
      await createAuditLog({
        actorUserId: userId,
        action: 'booking.conflict_rejected',
        entityType: 'availability_slot',
        entityId: slot.id,
        metadata: { propertySlug: input.propertySlug, reason: 'unique_violation' },
        req,
      });
      throw new AppError(409, 'SLOT_UNAVAILABLE', 'This time slot is not available for booking');
    }
    throw err;
  }
}

async function enrichBookingSummariesForCustomer(
  userId: string,
  rows: Awaited<ReturnType<typeof prisma.booking.findMany<{ include: typeof bookingInclude }>>>,
) {
  const ids = rows.map((r) => r.id);
  const [refunds, disputes, reviewMap] = await Promise.all([
    prisma.refundRequest.findMany({
      where: {
        bookingId: { in: ids },
        customerId: userId,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.dispute.findMany({
      where: { bookingId: { in: ids }, openedByUserId: userId },
      orderBy: { createdAt: 'desc' },
    }),
    reviewsForBookings(ids),
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
  const summaries = rows.map((row) => {
    const summary = toPublicBookingSummary(row);
    const hasCaptured = row.payments.some((p) => p.status === PaymentStatus.succeeded);
    const refundRow = refundByBooking.get(row.id);
    const hasBlockingRefund =
      refundRow &&
      (BLOCKING_REFUND_REQUEST_STATUSES as readonly string[]).includes(refundRow.status);
    const refundRequest = refundRow
      ? {
          id: refundRow.id,
          bookingId: refundRow.bookingId,
          status: refundRow.status,
          policyRefundAmount: decimalToNumber(refundRow.policyRefundAmount),
          requestedAmount: decimalToNumber(refundRow.requestedAmount),
          approvedAmount:
            refundRow.approvedAmount != null
              ? decimalToNumber(refundRow.approvedAmount)
              : null,
          reason: refundRow.reason,
          adminNote: refundRow.adminNote,
          createdAt: refundRow.createdAt.toISOString(),
          updatedAt: refundRow.updatedAt.toISOString(),
        }
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
  return {
    bookable: isPropertyCurrentlyBookable(row.property),
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
    include: { slot: true, payments: true, refundRequests: true },
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
    throw new AppError(409, 'PARTNER_NOT_BOOKABLE', 'This property is not accepting new bookings');
  }
  if (booking.property.status !== PropertyStatus.published) {
    throw new AppError(409, 'PROPERTY_NOT_BOOKABLE', 'Property is not published');
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
