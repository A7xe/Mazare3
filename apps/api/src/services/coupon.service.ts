import {
  prisma,
  PromotionStatus,
  PromotionDiscountType,
  CouponRedemptionStatus,
  Prisma,
} from '@mazare3/db';
import type {
  CreatePropertyCouponInput,
  PropertyCouponRow,
  UserRole,
} from '@mazare3/shared';
import { computePromotionDiscount, normalizeCouponCode } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { resolveOwnerScope } from './owner-access.js';
import { resolvePriceForSlot } from './promotion.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  loadPaymentPolicyConfig,
  resolveDepositPercent,
} from '../config/payment-policy.config.js';
import { calculateBookingFinancialSnapshot } from '@mazare3/shared';

type Tx = Prisma.TransactionClient;

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === 'number' ? value : value.toNumber();
}

const ACTIVE_USAGE: CouponRedemptionStatus[] = [
  CouponRedemptionStatus.reserved,
  CouponRedemptionStatus.redeemed,
];

export async function expireDueCoupons(propertyIds?: string[]) {
  await prisma.propertyCoupon.updateMany({
    where: {
      status: PromotionStatus.active,
      endsAt: { lt: new Date() },
      ...(propertyIds?.length ? { propertyId: { in: propertyIds } } : {}),
    },
    data: { status: PromotionStatus.expired },
  });
}

async function usageCount(couponId: string, tx: Tx | typeof prisma = prisma) {
  return tx.couponRedemption.count({
    where: { couponId, status: { in: ACTIVE_USAGE } },
  });
}

function toCouponRow(
  row: {
    id: string;
    propertyId: string;
    normalizedCode: string;
    discountType: PromotionDiscountType;
    discountValue: { toNumber(): number } | number;
    startsAt: Date;
    endsAt: Date;
    minBookingAmount: { toNumber(): number } | number | null;
    maxUses: number | null;
    maxUsesPerCustomer: number;
    status: PromotionStatus;
    createdAt: Date;
    updatedAt: Date;
  },
  usage: number,
): PropertyCouponRow {
  return {
    id: row.id,
    propertyId: row.propertyId,
    normalizedCode: row.normalizedCode,
    discountType: row.discountType,
    discountValue: decimalToNumber(row.discountValue) ?? 0,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    minBookingAmount: decimalToNumber(row.minBookingAmount),
    maxUses: row.maxUses,
    maxUsesPerCustomer: row.maxUsesPerCustomer,
    status: row.status,
    usageCount: usage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertOwnedProperty(userId: string, role: UserRole, propertyId: string) {
  const scope = await resolveOwnerScope(userId, role);
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, ownerId: true, basePrice: true },
  });
  if (!property) throw new AppError(404, 'NOT_FOUND', 'Property not found');
  if (!scope.isAdmin && property.ownerId !== scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not own this property');
  }
  return property;
}

export async function listOwnerCoupons(userId: string, role: UserRole, propertyId: string) {
  await assertOwnedProperty(userId, role, propertyId);
  await expireDueCoupons([propertyId]);
  const rows = await prisma.propertyCoupon.findMany({
    where: { propertyId },
    orderBy: { createdAt: 'desc' },
  });
  const counts = await Promise.all(rows.map((r) => usageCount(r.id)));
  return rows.map((r, i) => toCouponRow(r, counts[i] ?? 0));
}

export async function createOwnerCoupon(
  userId: string,
  role: UserRole,
  propertyId: string,
  input: CreatePropertyCouponInput,
  req?: AuthenticatedRequest,
) {
  const property = await assertOwnedProperty(userId, role, propertyId);
  if (
    input.discountType === 'fixed_amount' &&
    input.discountValue >= (decimalToNumber(property.basePrice) ?? 0)
  ) {
    throw new AppError(
      400,
      'INVALID_DISCOUNT',
      'Fixed discount must be smaller than the property price',
    );
  }
  try {
    const row = await prisma.propertyCoupon.create({
      data: {
        propertyId,
        normalizedCode: input.code,
        discountType: input.discountType as PromotionDiscountType,
        discountValue: input.discountValue,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        minBookingAmount: input.minBookingAmount ?? null,
        maxUses: input.maxUses ?? null,
        maxUsesPerCustomer: input.maxUsesPerCustomer ?? 1,
        status: PromotionStatus.draft,
      },
    });
    await createAuditLog({
      actorUserId: userId,
      action: 'owner.coupon_created',
      entityType: 'property_coupon',
      entityId: row.id,
      metadata: { propertyId, code: row.normalizedCode },
      req,
    });
    return toCouponRow(row, 0);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'COUPON_CODE_TAKEN', 'This coupon code already exists on the property');
    }
    throw err;
  }
}

export async function activateOwnerCoupon(
  userId: string,
  role: UserRole,
  propertyId: string,
  couponId: string,
  req?: AuthenticatedRequest,
) {
  await assertOwnedProperty(userId, role, propertyId);
  const existing = await prisma.propertyCoupon.findFirst({ where: { id: couponId, propertyId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Coupon not found');
  if (existing.endsAt < new Date()) {
    await prisma.propertyCoupon.update({
      where: { id: couponId },
      data: { status: PromotionStatus.expired },
    });
    throw new AppError(400, 'COUPON_EXPIRED', 'This coupon has ended');
  }
  const row = await prisma.propertyCoupon.update({
    where: { id: couponId },
    data: { status: PromotionStatus.active },
  });
  await createAuditLog({
    actorUserId: userId,
    action: 'owner.coupon_activated',
    entityType: 'property_coupon',
    entityId: row.id,
    metadata: { propertyId },
    req,
  });
  return toCouponRow(row, await usageCount(row.id));
}

export async function pauseOwnerCoupon(
  userId: string,
  role: UserRole,
  propertyId: string,
  couponId: string,
  req?: AuthenticatedRequest,
) {
  await assertOwnedProperty(userId, role, propertyId);
  const existing = await prisma.propertyCoupon.findFirst({ where: { id: couponId, propertyId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Coupon not found');
  const row = await prisma.propertyCoupon.update({
    where: { id: couponId },
    data: { status: PromotionStatus.paused },
  });
  await createAuditLog({
    actorUserId: userId,
    action: 'owner.coupon_paused',
    entityType: 'property_coupon',
    entityId: row.id,
    metadata: { propertyId },
    req,
  });
  return toCouponRow(row, await usageCount(row.id));
}

export async function listAdminPropertyCoupons(propertyId: string) {
  await expireDueCoupons([propertyId]);
  const rows = await prisma.propertyCoupon.findMany({
    where: { propertyId },
    orderBy: { createdAt: 'desc' },
  });
  const counts = await Promise.all(rows.map((r) => usageCount(r.id)));
  return rows.map((r, i) => toCouponRow(r, counts[i] ?? 0));
}

export async function disableAdminCoupon(
  actorUserId: string,
  propertyId: string,
  couponId: string,
  req?: AuthenticatedRequest,
) {
  const existing = await prisma.propertyCoupon.findFirst({ where: { id: couponId, propertyId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Coupon not found');
  const row = await prisma.propertyCoupon.update({
    where: { id: couponId },
    data: { status: PromotionStatus.paused },
  });
  await createAuditLog({
    actorUserId,
    action: 'admin.coupon_disabled',
    entityType: 'property_coupon',
    entityId: row.id,
    metadata: { propertyId },
    req,
  });
  return toCouponRow(row, await usageCount(row.id));
}

function couponError(status: PromotionStatus | string): never {
  if (status === PromotionStatus.paused) {
    throw new AppError(400, 'COUPON_PAUSED', 'This coupon is paused');
  }
  if (status === PromotionStatus.expired || status === PromotionStatus.draft) {
    throw new AppError(400, 'COUPON_EXPIRED', 'This coupon is not active');
  }
  throw new AppError(400, 'COUPON_INVALID', 'Invalid coupon code');
}

export async function loadCouponForProperty(propertyId: string, code: string) {
  await expireDueCoupons([propertyId]);
  const normalized = normalizeCouponCode(code);
  return prisma.propertyCoupon.findUnique({
    where: { propertyId_normalizedCode: { propertyId, normalizedCode: normalized } },
  });
}

export function applyCouponDiscount(
  slotPrice: number,
  coupon: {
    discountType: PromotionDiscountType | string;
    discountValue: { toNumber(): number } | number;
    minBookingAmount?: { toNumber(): number } | number | null;
    status: PromotionStatus | string;
    startsAt: Date;
    endsAt: Date;
  },
) {
  const now = new Date();
  if (coupon.status !== PromotionStatus.active) couponError(coupon.status);
  if (now < coupon.startsAt || now > coupon.endsAt) {
    throw new AppError(400, 'COUPON_EXPIRED', 'This coupon is not valid right now');
  }
  const minAmount = decimalToNumber(coupon.minBookingAmount);
  if (minAmount != null && slotPrice < minAmount) {
    throw new AppError(400, 'COUPON_MIN_AMOUNT', 'Booking amount is below the coupon minimum');
  }
  const computed = computePromotionDiscount(
    slotPrice,
    coupon.discountType as 'percentage' | 'fixed_amount',
    decimalToNumber(coupon.discountValue) ?? 0,
  );
  if (!computed) {
    throw new AppError(400, 'INVALID_DISCOUNT', 'Coupon discount is not valid for this price');
  }
  return computed;
}

export function couponIsCurrentlyApplicable(
  slotPrice: number,
  coupon: Parameters<typeof applyCouponDiscount>[1],
): boolean {
  try {
    applyCouponDiscount(slotPrice, coupon);
    return true;
  } catch {
    return false;
  }
}

async function assertCouponUsageAvailable(
  tx: Tx,
  coupon: { id: string; maxUses: number | null; maxUsesPerCustomer: number },
  userId: string,
) {
  const used = await tx.couponRedemption.count({
    where: { couponId: coupon.id, status: { in: ACTIVE_USAGE } },
  });
  if (coupon.maxUses != null && used >= coupon.maxUses) {
    throw new AppError(400, 'COUPON_USAGE_LIMIT', 'This coupon has reached its usage limit');
  }
  const customerUsed = await tx.couponRedemption.count({
    where: { couponId: coupon.id, userId, status: { in: ACTIVE_USAGE } },
  });
  if (customerUsed >= coupon.maxUsesPerCustomer) {
    throw new AppError(400, 'COUPON_ALREADY_USED', 'You have already used this coupon');
  }
}

export async function evaluateCouponForCustomer(params: {
  propertyId: string;
  userId: string;
  code: string;
  slotPrice: number;
  promotionApplies: boolean;
  propertyDepositPercent?: number | null;
}) {
  if (params.promotionApplies) {
    throw new AppError(
      409,
      'DISCOUNT_NOT_STACKABLE',
      'A property offer already applies. Coupons cannot be combined in this phase.',
    );
  }
  const coupon = await loadCouponForProperty(params.propertyId, params.code);
  if (!coupon) throw new AppError(400, 'COUPON_INVALID', 'Invalid coupon code');
  const priced = applyCouponDiscount(params.slotPrice, coupon);
  await assertCouponUsageAvailable(prisma, coupon, params.userId);
  const money = couponMoneyForSlot(priced.finalPrice, params.propertyDepositPercent ?? null);
  return {
    coupon,
    priced,
    depositAmount: money.depositAmount,
    remainingAmount: money.remainingAmount,
  };
}

export async function reserveCouponInTx(
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
  const normalized = normalizeCouponCode(params.code);
  const coupon = await tx.propertyCoupon.findUnique({
    where: { propertyId_normalizedCode: { propertyId: params.propertyId, normalizedCode: normalized } },
  });
  if (!coupon) throw new AppError(400, 'COUPON_INVALID', 'Invalid coupon code');
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "PropertyCoupon" WHERE id = ${coupon.id} FOR UPDATE`);
  const locked = await tx.propertyCoupon.findUniqueOrThrow({ where: { id: coupon.id } });
  const priced = applyCouponDiscount(params.slotPrice, locked);
  await assertCouponUsageAvailable(tx, locked, params.userId);
  await tx.couponRedemption.create({
    data: {
      couponId: locked.id,
      bookingId: params.bookingId,
      userId: params.userId,
      status: CouponRedemptionStatus.reserved,
    },
  });
  return { coupon: locked, priced };
}

export async function releaseCouponReservationInTx(tx: Tx, bookingId: string) {
  await tx.couponRedemption.updateMany({
    where: { bookingId, status: CouponRedemptionStatus.reserved },
    data: { status: CouponRedemptionStatus.released },
  });
}

export async function redeemCouponInTx(tx: Tx, bookingId: string) {
  await tx.couponRedemption.updateMany({
    where: { bookingId, status: CouponRedemptionStatus.reserved },
    data: { status: CouponRedemptionStatus.redeemed },
  });
}

export function couponMoneyForSlot(
  finalPrice: number,
  propertyDepositPercent: number | null,
) {
  const config = loadPaymentPolicyConfig();
  return calculateBookingFinancialSnapshot({
    bookingTotalAmount: finalPrice,
    depositPercent: resolveDepositPercent(propertyDepositPercent),
    platformCommissionPercent: config.platformCommissionPercent,
    customerServiceFeePercent: config.customerServiceFeePercent,
    currency: config.currency,
  });
}

export async function validateCouponForPublishedSlot(params: {
  slug: string;
  userId: string;
  code: string;
  date: string;
  period: 'morning' | 'evening' | 'full_day' | 'overnight';
}) {
  const property = await prisma.property.findFirst({
    where: { slug: params.slug, status: 'published' },
    select: { id: true, depositPercent: true },
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
  const evaluated = await evaluateCouponForCustomer({
    propertyId: property.id,
    userId: params.userId,
    code: params.code,
    slotPrice,
    promotionApplies: Boolean(promo.promotionId && promo.discountAmount > 0),
    propertyDepositPercent: decimalToNumber(property.depositPercent),
  });
  return {
    valid: true,
    normalizedCode: evaluated.coupon.normalizedCode,
    originalPrice: evaluated.priced.originalPrice,
    discountAmount: evaluated.priced.discountAmount,
    finalPrice: evaluated.priced.finalPrice,
    depositAmount: evaluated.depositAmount,
    remainingAmount: evaluated.remainingAmount,
    couponId: evaluated.coupon.id,
  };
}
