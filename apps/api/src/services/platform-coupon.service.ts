import {
  prisma,
  PromotionStatus,
  PromotionDiscountType,
  CouponRedemptionStatus,
  Prisma,
} from '@mazare3/db';
import type { CreatePlatformCouponInput, PlatformCouponRow } from '@mazare3/shared';
import { calculatePlatformFundedSnapshot, normalizeCouponCode } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { resolveCommercialTerms } from './commercial-terms.service.js';
import { resolvePriceForSlot } from './promotion.service.js';
import { applyCouponDiscount, couponIsCurrentlyApplicable, loadCouponForProperty } from './coupon.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  loadPaymentPolicyConfig,
  resolveDepositPercent,
} from '../config/payment-policy.config.js';

type Tx = Prisma.TransactionClient;

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === 'number' ? value : value.toNumber();
}

const ACTIVE_USAGE: CouponRedemptionStatus[] = [
  CouponRedemptionStatus.reserved,
  CouponRedemptionStatus.redeemed,
];

export async function expireDuePlatformCoupons() {
  await prisma.platformCoupon.updateMany({
    where: { status: PromotionStatus.active, endsAt: { lt: new Date() } },
    data: { status: PromotionStatus.expired },
  });
}

async function usageCount(couponId: string, tx: Tx | typeof prisma = prisma) {
  return tx.platformCouponRedemption.count({
    where: { couponId, status: { in: ACTIVE_USAGE } },
  });
}

function toRow(
  row: {
    id: string;
    normalizedCode: string;
    titleAr: string;
    titleEn: string;
    discountType: PromotionDiscountType;
    discountValue: { toNumber(): number } | number;
    startsAt: Date;
    endsAt: Date;
    minBookingAmount: { toNumber(): number } | number | null;
    maxUses: number | null;
    maxUsesPerCustomer: number;
    propertyId: string | null;
    status: PromotionStatus;
    createdAt: Date;
    updatedAt: Date;
  },
  usage: number,
): PlatformCouponRow {
  return {
    id: row.id,
    normalizedCode: row.normalizedCode,
    titleAr: row.titleAr,
    titleEn: row.titleEn,
    discountType: row.discountType,
    discountValue: decimalToNumber(row.discountValue) ?? 0,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    minBookingAmount: decimalToNumber(row.minBookingAmount),
    maxUses: row.maxUses,
    maxUsesPerCustomer: row.maxUsesPerCustomer,
    propertyId: row.propertyId,
    status: row.status,
    usageCount: usage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAdminPlatformCoupons() {
  await expireDuePlatformCoupons();
  const rows = await prisma.platformCoupon.findMany({ orderBy: { createdAt: 'desc' } });
  const counts = await Promise.all(rows.map((r) => usageCount(r.id)));
  return rows.map((r, i) => toRow(r, counts[i] ?? 0));
}

export async function createAdminPlatformCoupon(
  actorUserId: string,
  input: CreatePlatformCouponInput,
  req?: AuthenticatedRequest,
) {
  if (input.propertyId) {
    const property = await prisma.property.findUnique({
      where: { id: input.propertyId },
      select: { id: true },
    });
    if (!property) throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }
  try {
    const row = await prisma.platformCoupon.create({
      data: {
        normalizedCode: input.code,
        titleAr: input.titleAr,
        titleEn: input.titleEn,
        discountType: input.discountType as PromotionDiscountType,
        discountValue: input.discountValue,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        minBookingAmount: input.minBookingAmount ?? null,
        maxUses: input.maxUses ?? null,
        maxUsesPerCustomer: input.maxUsesPerCustomer ?? 1,
        propertyId: input.propertyId ?? null,
        status: PromotionStatus.draft,
      },
    });
    await createAuditLog({
      actorUserId,
      action: 'admin.platform_coupon_created',
      entityType: 'platform_coupon',
      entityId: row.id,
      metadata: { code: row.normalizedCode, propertyId: row.propertyId },
      req,
    });
    return toRow(row, 0);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'COUPON_CODE_TAKEN', 'This platform coupon code already exists');
    }
    throw err;
  }
}

export async function activateAdminPlatformCoupon(
  actorUserId: string,
  couponId: string,
  req?: AuthenticatedRequest,
) {
  const existing = await prisma.platformCoupon.findUnique({ where: { id: couponId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Coupon not found');
  if (existing.endsAt < new Date()) {
    await prisma.platformCoupon.update({
      where: { id: couponId },
      data: { status: PromotionStatus.expired },
    });
    throw new AppError(400, 'COUPON_EXPIRED', 'This coupon has ended');
  }
  const row = await prisma.platformCoupon.update({
    where: { id: couponId },
    data: { status: PromotionStatus.active },
  });
  await createAuditLog({
    actorUserId,
    action: 'admin.platform_coupon_activated',
    entityType: 'platform_coupon',
    entityId: row.id,
    req,
  });
  return toRow(row, await usageCount(row.id));
}

export async function pauseAdminPlatformCoupon(
  actorUserId: string,
  couponId: string,
  req?: AuthenticatedRequest,
) {
  const existing = await prisma.platformCoupon.findUnique({ where: { id: couponId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Coupon not found');
  const row = await prisma.platformCoupon.update({
    where: { id: couponId },
    data: { status: PromotionStatus.paused },
  });
  await createAuditLog({
    actorUserId,
    action: 'admin.platform_coupon_paused',
    entityType: 'platform_coupon',
    entityId: row.id,
    req,
  });
  return toRow(row, await usageCount(row.id));
}

async function assertPlatformUsageAvailable(
  tx: Tx,
  coupon: { id: string; maxUses: number | null; maxUsesPerCustomer: number },
  userId: string,
) {
  const used = await tx.platformCouponRedemption.count({
    where: { couponId: coupon.id, status: { in: ACTIVE_USAGE } },
  });
  if (coupon.maxUses != null && used >= coupon.maxUses) {
    throw new AppError(400, 'COUPON_USAGE_LIMIT', 'This coupon has reached its usage limit');
  }
  const customerUsed = await tx.platformCouponRedemption.count({
    where: { couponId: coupon.id, userId, status: { in: ACTIVE_USAGE } },
  });
  if (customerUsed >= coupon.maxUsesPerCustomer) {
    throw new AppError(400, 'COUPON_ALREADY_USED', 'You have already used this coupon');
  }
}

export async function loadPlatformCoupon(code: string) {
  await expireDuePlatformCoupons();
  return prisma.platformCoupon.findUnique({
    where: { normalizedCode: normalizeCouponCode(code) },
  });
}

export function platformCouponAppliesToProperty(
  coupon: { propertyId: string | null },
  propertyId: string,
) {
  return coupon.propertyId == null || coupon.propertyId === propertyId;
}

export function platformMoneyForMerchant(params: {
  merchantBookingValue: number;
  platformDiscountAmount: number;
  propertyDepositPercent: number | null;
  platformCommissionPercent: number;
}) {
  const config = loadPaymentPolicyConfig();
  return calculatePlatformFundedSnapshot({
    merchantBookingValue: params.merchantBookingValue,
    platformDiscountAmount: params.platformDiscountAmount,
    depositPercent: resolveDepositPercent(params.propertyDepositPercent),
    platformCommissionPercent: params.platformCommissionPercent,
    customerServiceFeePercent: config.customerServiceFeePercent,
    currency: config.currency,
  });
}

export async function evaluatePlatformCouponForCustomer(params: {
  propertyId: string;
  userId: string;
  code: string;
  slotPrice: number;
  promotionApplies: boolean;
  propertyDepositPercent?: number | null;
  platformCommissionPercent: number;
}) {
  if (params.promotionApplies) {
    throw new AppError(
      409,
      'DISCOUNT_NOT_STACKABLE',
      'A property offer already applies. Coupons cannot be combined in this phase.',
    );
  }
  const owner = await loadCouponForProperty(params.propertyId, params.code);
  if (owner && couponIsCurrentlyApplicable(params.slotPrice, owner)) {
    throw new AppError(
      409,
      'DISCOUNT_NOT_STACKABLE',
      'An owner coupon already applies. Platform coupons cannot be combined in this phase.',
    );
  }
  const coupon = await loadPlatformCoupon(params.code);
  if (!coupon || !platformCouponAppliesToProperty(coupon, params.propertyId)) {
    throw new AppError(400, 'COUPON_INVALID', 'Invalid coupon code');
  }
  const priced = applyCouponDiscount(params.slotPrice, coupon);
  await assertPlatformUsageAvailable(prisma, coupon, params.userId);
  const money = platformMoneyForMerchant({
    merchantBookingValue: params.slotPrice,
    platformDiscountAmount: priced.discountAmount,
    propertyDepositPercent: params.propertyDepositPercent ?? null,
    platformCommissionPercent: params.platformCommissionPercent,
  });
  return { coupon, priced, money };
}

export async function reservePlatformCouponInTx(
  tx: Tx,
  params: {
    propertyId: string;
    userId: string;
    bookingId: string;
    code: string;
    slotPrice: number;
    promotionApplies: boolean;
  },
) {
  if (params.promotionApplies) {
    throw new AppError(
      409,
      'DISCOUNT_NOT_STACKABLE',
      'A property offer already applies. Coupons cannot be combined in this phase.',
    );
  }
  const coupon = await tx.platformCoupon.findUnique({
    where: { normalizedCode: normalizeCouponCode(params.code) },
  });
  if (!coupon || !platformCouponAppliesToProperty(coupon, params.propertyId)) {
    throw new AppError(400, 'COUPON_INVALID', 'Invalid coupon code');
  }
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "PlatformCoupon" WHERE id = ${coupon.id} FOR UPDATE`);
  const locked = await tx.platformCoupon.findUniqueOrThrow({ where: { id: coupon.id } });
  applyCouponDiscount(params.slotPrice, locked);
  await assertPlatformUsageAvailable(tx, locked, params.userId);
  await tx.platformCouponRedemption.create({
    data: {
      couponId: locked.id,
      bookingId: params.bookingId,
      userId: params.userId,
      status: CouponRedemptionStatus.reserved,
    },
  });
  return { coupon: locked };
}

export async function releasePlatformCouponReservationInTx(tx: Tx, bookingId: string) {
  await tx.platformCouponRedemption.updateMany({
    where: { bookingId, status: CouponRedemptionStatus.reserved },
    data: { status: CouponRedemptionStatus.released },
  });
}

export async function redeemPlatformCouponInTx(tx: Tx, bookingId: string) {
  await tx.platformCouponRedemption.updateMany({
    where: { bookingId, status: CouponRedemptionStatus.reserved },
    data: { status: CouponRedemptionStatus.redeemed },
  });
}

export async function validatePlatformCouponForPublishedSlot(params: {
  slug: string;
  userId: string;
  code: string;
  date: string;
  period: 'morning' | 'evening' | 'full_day' | 'overnight';
}) {
  const property = await prisma.property.findFirst({
    where: { slug: params.slug, status: 'published' },
    select: { id: true, depositPercent: true, ownerId: true },
  });
  if (!property) throw new AppError(404, 'NOT_FOUND', 'Property not found');
  const [y, m, d] = params.date.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d));
  const slot = await prisma.availabilitySlot.findUnique({
    where: {
      propertyId_date_period: { propertyId: property.id, date, period: params.period },
    },
  });
  if (!slot) throw new AppError(409, 'SLOT_UNAVAILABLE', 'This time slot is not available');
  const slotPrice = decimalToNumber(slot.price) ?? 0;
  const promo = await resolvePriceForSlot({
    propertyId: property.id,
    period: slot.period,
    slotPrice,
  });
  const terms = await resolveCommercialTerms({
    ownerProfileId: property.ownerId,
    propertyId: property.id,
  });
  const evaluated = await evaluatePlatformCouponForCustomer({
    propertyId: property.id,
    userId: params.userId,
    code: params.code,
    slotPrice,
    promotionApplies: Boolean(promo.promotionId && promo.discountAmount > 0),
    propertyDepositPercent: decimalToNumber(property.depositPercent),
    platformCommissionPercent: terms.commissionPercent,
  });
  return {
    valid: true,
    fundedBy: 'platform' as const,
    normalizedCode: evaluated.coupon.normalizedCode,
    couponId: evaluated.coupon.id,
    originalPrice: evaluated.priced.originalPrice,
    discountAmount: evaluated.priced.discountAmount,
    finalPrice: evaluated.money.customerPayableBeforeFee,
    originalBookingValue: evaluated.money.merchantBookingValue,
    platformDiscount: evaluated.money.platformDiscountAmount,
    customerPayableTotal: evaluated.money.customerPayableBeforeFee,
    depositAmount: evaluated.money.depositAmount,
    remainingAmount: evaluated.money.remainingAmount,
    depositDueNow: evaluated.money.depositAmount,
    remainingCustomerBalance: evaluated.money.remainingAmount,
    commissionBasis: evaluated.money.commissionBasisAmount,
    ownerExpectedNet: evaluated.money.ownerNetPayoutAmount,
  };
}
