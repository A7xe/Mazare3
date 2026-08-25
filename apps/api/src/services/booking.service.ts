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
import { filsToJod, jodToFils } from '@mazare3/shared';
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
import {
  evaluateCancellationPolicy,
  buildBookingFinancialSnapshot,
  buildPlatformFundedSnapshot,
  snapshotToBreakdown,
} from './payment-policy.service.js';
import { checkoutDueNow } from '../mappers/public-booking.mapper.js';
import { resolveCommercialTerms } from './commercial-terms.service.js';
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
import { resolvePriceForSlot } from './promotion.service.js';
import {
  evaluateCouponForCustomer,
  couponIsCurrentlyApplicable,
  loadCouponForProperty,
  releaseCouponReservationInTx,
  reserveCouponInTx,
} from './coupon.service.js';
import {
  evaluatePlatformCouponForCustomer,
  releasePlatformCouponReservationInTx,
  reservePlatformCouponInTx,
} from './platform-coupon.service.js';
function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d));
}

function generatePublicCode(): string {
  return `MZ-${randomBytes(4).toString('hex').toUpperCase()}`;
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
  const property = await prisma.property.findFirst({
    where: { slug: input.propertySlug, status: PropertyStatus.published },
    select: {
      id: true,
      capacity: true,
      depositPercent: true,
      ownerId: true,
      instantBookingEnabled: true,
      owner: { select: { status: true, userId: true } },
    },
  });

  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }

  if (property.owner.status !== OwnerStatus.approved) {
    throw new AppError(
      409,
      'PARTNER_NOT_BOOKABLE',
      'This property is not accepting new bookings',
    );
  }

  if (input.guestsCount > property.capacity) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Guest count exceeds property capacity');
  }

  const date = parseDateOnly(input.date);

  const slot = await prisma.availabilitySlot.findUnique({
    where: {
      propertyId_date_period: {
        propertyId: property.id,
        date,
        period: input.period,
      },
    },
  });

  if (!slot || slot.status !== AvailabilitySlotStatus.available) {
    await createAuditLog({
      actorUserId: userId,
      action: 'booking.conflict_rejected',
      entityType: 'availability_slot',
      entityId: slot?.id,
      metadata: {
        propertySlug: input.propertySlug,
        date: input.date,
        period: input.period,
        reason: slot ? 'slot_not_available' : 'slot_missing',
      },
      req,
    });
    throw new AppError(409, 'SLOT_UNAVAILABLE', 'This time slot is not available for booking');
  }

  const instant = property.instantBookingEnabled;
  const slotPrice = decimalToNumber(slot.price);
  const timed = Boolean(slot.startAt && slot.endAt);
  const priced = await resolvePriceForSlot({
    propertyId: property.id,
    period: slot.period,
    slotPrice,
  });
  const promotionApplies = Boolean(priced.promotionId && priced.discountAmount > 0);
  const terms = await resolveCommercialTerms({
    ownerProfileId: property.ownerId,
    propertyId: property.id,
  });
  let couponId: string | null = null;
  let couponCodeSnapshot: string | null = null;
  let couponDiscountAmount = 0;
  let priceBeforeCoupon: number | null = null;
  let platformCouponId: string | null = null;
  let platformCouponCodeSnapshot: string | null = null;
  let platformDiscountAmount = 0;
  let payable = priced.finalPrice;
  let usePlatformCoupon = false;
  if (input.couponCode) {
    const ownerRow = await loadCouponForProperty(property.id, input.couponCode);
    const ownerLive = ownerRow ? couponIsCurrentlyApplicable(slotPrice, ownerRow) : false;
    if (ownerLive) {
      const preview = await evaluateCouponForCustomer({
        propertyId: property.id,
        userId,
        code: input.couponCode,
        slotPrice,
        promotionApplies,
        propertyDepositPercent:
          property.depositPercent != null ? decimalToNumber(property.depositPercent) : null,
      });
      payable = preview.priced.finalPrice;
      couponId = preview.coupon.id;
      couponCodeSnapshot = preview.coupon.normalizedCode;
      couponDiscountAmount = preview.priced.discountAmount;
      priceBeforeCoupon = preview.priced.originalPrice;
    } else {
      try {
        const preview = await evaluatePlatformCouponForCustomer({
          propertyId: property.id,
          userId,
          code: input.couponCode,
          slotPrice,
          promotionApplies,
          propertyDepositPercent:
            property.depositPercent != null ? decimalToNumber(property.depositPercent) : null,
          platformCommissionPercent: terms.commissionPercent,
        });
        usePlatformCoupon = true;
        payable = preview.money.customerPayableBeforeFee;
        platformCouponId = preview.coupon.id;
        platformCouponCodeSnapshot = preview.coupon.normalizedCode;
        platformDiscountAmount = preview.priced.discountAmount;
      } catch (err) {
        if (ownerRow) {
          await evaluateCouponForCustomer({
            propertyId: property.id,
            userId,
            code: input.couponCode,
            slotPrice,
            promotionApplies,
            propertyDepositPercent:
              property.depositPercent != null ? decimalToNumber(property.depositPercent) : null,
          });
        }
        throw err;
      }
    }
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
        Prisma.sql`SELECT id FROM "Property" WHERE id = ${property.id} FOR UPDATE`,
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
          WHERE b."propertyId" = ${property.id}
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
      const snap = usePlatformCoupon
        ? buildPlatformFundedSnapshot({
            merchantBookingValue: slotPrice,
            platformDiscountAmount,
            propertyDepositPercent:
              property.depositPercent != null ? decimalToNumber(property.depositPercent) : null,
            slotDate: slot.date,
            bookingStartAt: timed ? slot.startAt : null,
            platformCommissionPercent: terms.commissionPercent,
          })
        : buildBookingFinancialSnapshot({
            bookingTotalAmount: payable,
            propertyDepositPercent:
              property.depositPercent != null ? decimalToNumber(property.depositPercent) : null,
            slotDate: slot.date,
            bookingStartAt: timed ? slot.startAt : null,
            platformCommissionPercent: terms.commissionPercent,
          });

      const created = await tx.booking.create({
        data: {
          publicCode: generatePublicCode(),
          userId,
          propertyId: property.id,
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
          propertyId: property.id,
          userId,
          bookingId: created.id,
          code: input.couponCode,
          slotPrice,
          promotionApplies,
        });
      } else if (input.couponCode) {
        await reserveCouponInTx(tx, {
          propertyId: property.id,
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
        ownerUserId: property.owner.userId,
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

  return {
    ...summary,
    payment: paymentSummary,
    pricing,
    dueNowAmount: due.dueNowAmount,
    duePurpose: due.duePurpose,
  };
}

export async function cancelMyBooking(
  userId: string,
  bookingId: string,
  req?: AuthenticatedRequest,
) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: { slot: true },
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
    const payments = await prisma.payment.findMany({
      where: { bookingId: booking.id },
    });
    const refunds = await prisma.refundRequest.findMany({
      where: { bookingId: booking.id },
    });
    const funds = refundableCapturedFils(payments, refunds);
    if (funds.captured <= 0) {
      throw new AppError(400, 'INVALID_STATUS', 'Booking cannot be cancelled');
    }
    const capturedJod = filsToJod(funds.captured);
    const policy = evaluateCancellationPolicy(capturedJod, booking.slot.date);
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
      cancellationPenaltyAmount: Math.max(0, capturedJod - refundableAmount),
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
      },
      include: bookingInclude,
    });

    if (booking.status === BookingStatus.confirmed && cancellationMeta) {
      await tx.payment.updateMany({
        where: { bookingId: booking.id, status: PaymentStatus.succeeded },
        data: {
          refundStatus: RefundStatus.pending,
          cancellationRefundAmount: cancellationMeta.refundableAmount as number,
          cancellationPenaltyAmount: cancellationMeta.cancellationPenaltyAmount as number,
          payoutStatus: PayoutStatus.blocked,
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
