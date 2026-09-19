/**
 * CB-2 — read-only booking quote (same pricing path as createBooking, no mutations).
 */
import {
  prisma,
  AvailabilitySlotStatus,
  OwnerStatus,
  PropertyStatus,
} from '@mazare3/db';
import type {
  AvailabilityPeriod,
  BookingQuote,
  BookingQuoteInput,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { SLOT_HOLDING_STATUSES } from '../lib/payment-hold.js';
import { formatDateOnlyUtc, mapTimedFields } from '../lib/availability-times.js';
import {
  buildBookingFinancialSnapshot,
  buildPlatformFundedSnapshot,
  hoursUntilBookingStart,
} from './payment-policy.service.js';
import { resolveCommercialTerms } from './commercial-terms.service.js';
import { resolvePriceForSlot } from './promotion.service.js';
import {
  evaluateCouponForCustomer,
  couponIsCurrentlyApplicable,
  loadCouponForProperty,
} from './coupon.service.js';
import { evaluatePlatformCouponForCustomer } from './platform-coupon.service.js';

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d));
}

export type ResolvedBookingPricing = {
  propertyId: string;
  propertySlug: string;
  capacity: number;
  ownerId: string;
  ownerUserId: string;
  instantBookingEnabled: boolean;
  depositPercentRaw: number | null;
  slot: {
    id: string;
    date: Date;
    period: AvailabilityPeriod;
    price: { toNumber(): number } | number;
    startAt: Date | null;
    endAt: Date | null;
    status: AvailabilitySlotStatus;
  };
  slotPrice: number;
  timed: boolean;
  priced: Awaited<ReturnType<typeof resolvePriceForSlot>>;
  terms: Awaited<ReturnType<typeof resolveCommercialTerms>>;
  payable: number;
  usePlatformCoupon: boolean;
  couponId: string | null;
  couponCodeSnapshot: string | null;
  couponDiscountAmount: number;
  priceBeforeCoupon: number | null;
  platformCouponId: string | null;
  platformCouponCodeSnapshot: string | null;
  platformDiscountAmount: number;
  snap: ReturnType<typeof buildBookingFinancialSnapshot>;
  quote: BookingQuote;
};

/**
 * Authoritative pricing snapshot for quote + createBooking expected totals.
 * Does not create Booking / Payment / hold / AvailabilitySlot mutations.
 */
export async function resolveBookingPricing(params: {
  propertySlug: string;
  date: string;
  period: AvailabilityPeriod;
  guestsCount: number;
  couponCode?: string;
  userId?: string | null;
}): Promise<ResolvedBookingPricing> {
  const property = await prisma.property.findFirst({
    where: { slug: params.propertySlug, status: PropertyStatus.published },
    select: {
      id: true,
      slug: true,
      capacity: true,
      depositPercent: true,
      ownerId: true,
      instantBookingEnabled: true,
      verificationStatus: true,
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
      'This Property is currently unavailable for Booking.',
    );
  }

  // Phase 3C.4D.4B — authority + regulatory READY for NEW Booking commitment
  const { assertPropertyEligibleForNewPaidBooking } = await import(
    './property-bookability.service.js'
  );
  await assertPropertyEligibleForNewPaidBooking(property.id, 'new_booking');

  if (params.guestsCount < 1) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Guest count must be at least 1');
  }

  if (params.guestsCount > property.capacity) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Guest count exceeds property capacity');
  }

  const date = parseDateOnly(params.date);
  const slot = await prisma.availabilitySlot.findUnique({
    where: {
      propertyId_date_period: {
        propertyId: property.id,
        date,
        period: params.period,
      },
    },
  });

  if (!slot || slot.status !== AvailabilitySlotStatus.available) {
    throw new AppError(409, 'SLOT_UNAVAILABLE', 'This time slot is not available for booking');
  }

  const activeHold = await prisma.booking.findFirst({
    where: {
      availabilitySlotId: slot.id,
      status: { in: SLOT_HOLDING_STATUSES },
    },
    select: { id: true },
  });
  if (activeHold) {
    throw new AppError(409, 'SLOT_UNAVAILABLE', 'This time slot is not available for booking');
  }

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
    verificationStatus: property.verificationStatus,
  });

  const hoursUntilStart = hoursUntilBookingStart(
    timed ? slot.startAt : null,
    slot.date,
  );

  let couponId: string | null = null;
  let couponCodeSnapshot: string | null = null;
  let couponDiscountAmount = 0;
  let priceBeforeCoupon: number | null = null;
  let platformCouponId: string | null = null;
  let platformCouponCodeSnapshot: string | null = null;
  let platformDiscountAmount = 0;
  let payable = priced.finalPrice;
  let usePlatformCoupon = false;

  if (params.couponCode) {
    if (!params.userId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Sign in to apply a coupon');
    }
    const ownerRow = await loadCouponForProperty(property.id, params.couponCode);
    const ownerLive = ownerRow ? couponIsCurrentlyApplicable(slotPrice, ownerRow) : false;
    if (ownerLive) {
      const preview = await evaluateCouponForCustomer({
        propertyId: property.id,
        userId: params.userId,
        code: params.couponCode,
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
          userId: params.userId,
          code: params.couponCode,
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
            userId: params.userId,
            code: params.couponCode,
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

  const depositPercentRaw =
    property.depositPercent != null ? decimalToNumber(property.depositPercent) : null;

  const snap = usePlatformCoupon
    ? buildPlatformFundedSnapshot({
        merchantBookingValue: slotPrice,
        platformDiscountAmount,
        propertyDepositPercent: depositPercentRaw,
        slotDate: slot.date,
        bookingStartAt: timed ? slot.startAt : null,
        platformCommissionPercent: terms.commissionPercent,
        hoursUntilStart,
      })
    : buildBookingFinancialSnapshot({
        bookingTotalAmount: payable,
        propertyDepositPercent: depositPercentRaw,
        slotDate: slot.date,
        bookingStartAt: timed ? slot.startAt : null,
        platformCommissionPercent: terms.commissionPercent,
        hoursUntilStart,
      });

  const timedFields = mapTimedFields(slot);
  const discountAmount =
    couponDiscountAmount || platformDiscountAmount || (couponId || usePlatformCoupon ? 0 : priced.discountAmount);
  const baseAmount =
    priceBeforeCoupon ??
    (discountAmount > 0 && !couponId && !usePlatformCoupon ? priced.originalPrice : slotPrice);

  const quote: BookingQuote = {
    propertyId: property.id,
    propertySlug: property.slug,
    date: formatDateOnlyUtc(slot.date),
    period: slot.period,
    guestsCount: params.guestsCount,
    currency: snap.currency,
    baseAmount,
    discountAmount,
    /** Matches createBooking `expectedTotalAmount` / pre-fee payable. */
    expectedTotalAmount: payable,
    bookingAmount: payable,
    customerServiceFeeAmount: snap.customerServiceFeeAmount,
    customerPayableTotal: snap.customerPayableTotal,
    depositPercent: snap.depositPercent,
    depositAmount: snap.depositAmount,
    remainingAmount: snap.remainingAmount,
    depositDueAmount: snap.depositDueAmount,
    startAtLocal: timedFields.startAtLocal,
    endAtLocal: timedFields.endAtLocal,
    instantBookingEnabled: property.instantBookingEnabled,
    paymentCollectionMode: 'deposit_balance',
    appliedPromotion:
      !couponId && !usePlatformCoupon && priced.promotionId && priced.discountAmount > 0
        ? { id: priced.promotionId }
        : null,
    appliedCoupon: couponCodeSnapshot
      ? { code: couponCodeSnapshot, fundedBy: 'property' as const }
      : platformCouponCodeSnapshot
        ? { code: platformCouponCodeSnapshot, fundedBy: 'platform' as const }
        : null,
  };

  return {
    propertyId: property.id,
    propertySlug: property.slug,
    capacity: property.capacity,
    ownerId: property.ownerId,
    ownerUserId: property.owner.userId,
    instantBookingEnabled: property.instantBookingEnabled,
    depositPercentRaw,
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
    quote,
  };
}

export async function getBookingQuote(
  input: BookingQuoteInput,
  userId?: string | null,
): Promise<BookingQuote> {
  const resolved = await resolveBookingPricing({
    propertySlug: input.propertySlug,
    date: input.date,
    period: input.period,
    guestsCount: input.guestsCount,
    couponCode: input.couponCode,
    userId,
  });
  return resolved.quote;
}
