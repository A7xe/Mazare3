import {
  prisma,
  PromotionStatus,
  PromotionDiscountType,
  Prisma,
  type AvailabilityPeriod,
} from '@mazare3/db';
import type {
  CreatePropertyPromotionInput,
  PropertyPromotionRow,
  PublicPropertySummary,
  UpdatePropertyPromotionInput,
  UserRole,
} from '@mazare3/shared';
import { resolveSlotPromotion, computePromotionDiscount, type PromotionPriceInput } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { resolveOwnerScope } from './owner-access.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : value.toNumber();
}

export function toPromotionRow(row: {
  id: string;
  propertyId: string;
  titleAr: string;
  titleEn: string;
  discountType: PromotionDiscountType;
  discountValue: { toNumber(): number } | number;
  startsAt: Date;
  endsAt: Date;
  period: AvailabilityPeriod | null;
  status: PromotionStatus;
  createdAt: Date;
  updatedAt: Date;
}): PropertyPromotionRow {
  return {
    id: row.id,
    propertyId: row.propertyId,
    titleAr: row.titleAr,
    titleEn: row.titleEn,
    discountType: row.discountType,
    discountValue: decimalToNumber(row.discountValue),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    period: row.period,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function expireDuePromotions(propertyIds?: string[]) {
  await prisma.propertyPromotion.updateMany({
    where: {
      status: PromotionStatus.active,
      endsAt: { lt: new Date() },
      ...(propertyIds?.length ? { propertyId: { in: propertyIds } } : {}),
    },
    data: { status: PromotionStatus.expired },
  });
}

export function toPriceInput(row: PropertyPromotionRow | ReturnType<typeof toPromotionRow>): PromotionPriceInput {
  return {
    id: row.id,
    discountType: row.discountType,
    discountValue: row.discountValue,
    period: row.period,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status,
    titleAr: row.titleAr,
    titleEn: row.titleEn,
  };
}

export async function loadLivePromotionsByProperty(
  propertyIds: string[],
): Promise<Map<string, PropertyPromotionRow[]>> {
  const map = new Map<string, PropertyPromotionRow[]>();
  if (!propertyIds.length) return map;
  await expireDuePromotions(propertyIds);
  const now = new Date();
  const rows = await prisma.propertyPromotion.findMany({
    where: {
      propertyId: { in: propertyIds },
      status: PromotionStatus.active,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
  });
  for (const row of rows) {
    const list = map.get(row.propertyId) ?? [];
    list.push(toPromotionRow(row));
    map.set(row.propertyId, list);
  }
  return map;
}

/** Live promotion property filter — mirrors Featured placement truthfulness. */
export function liveActivePromotionFilter(now = new Date()): Prisma.PropertyWhereInput {
  return {
    promotions: {
      some: {
        status: PromotionStatus.active,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    },
  };
}

/**
 * Best live promotion summary for public browse cards.
 * Prices are computed from `basePrice` only when the discount applies safely.
 */
export function buildActivePromotionSummary(
  basePrice: number,
  promos: PropertyPromotionRow[],
): NonNullable<PublicPropertySummary['activePromotionSummary']> | null {
  if (!promos.length) return null;

  let best: NonNullable<PublicPropertySummary['activePromotionSummary']> | null = null;

  for (const promo of promos) {
    const computed = computePromotionDiscount(
      basePrice,
      promo.discountType,
      promo.discountValue,
    );
    const candidate: NonNullable<PublicPropertySummary['activePromotionSummary']> = {
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      endsAt: promo.endsAt,
      titleAr: promo.titleAr,
      titleEn: promo.titleEn,
      originalFromPrice: computed?.originalPrice ?? null,
      promotionalFromPrice: computed?.finalPrice ?? null,
      savingsAmount: computed?.discountAmount ?? null,
    };

    const bestSavings = best?.savingsAmount ?? -1;
    const nextSavings = candidate.savingsAmount ?? -1;
    if (!best || nextSavings > bestSavings) {
      best = candidate;
    }
  }

  return best;
}

/** Live promotion property ids — independent of newest-catalog caps. */
export async function listLivePromotionPropertyIds(params: {
  propertyWhere?: Prisma.PropertyWhereInput;
  take?: number;
}): Promise<string[]> {
  await expireDuePromotions();
  const now = new Date();
  const take = params.take ?? 24;
  const rows = await prisma.propertyPromotion.findMany({
    where: {
      status: PromotionStatus.active,
      startsAt: { lte: now },
      endsAt: { gte: now },
      property: {
        status: 'published',
        owner: { status: 'approved' },
        ...(params.propertyWhere ?? {}),
      },
    },
    select: { propertyId: true, updatedAt: true },
    orderBy: [{ updatedAt: 'desc' }, { propertyId: 'asc' }],
    take: take * 3,
  });
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.propertyId)) continue;
    seen.add(row.propertyId);
    ids.push(row.propertyId);
    if (ids.length >= take) break;
  }
  return ids;
}

export async function resolvePriceForSlot(params: {
  propertyId: string;
  period: AvailabilityPeriod;
  slotPrice: number;
}) {
  const map = await loadLivePromotionsByProperty([params.propertyId]);
  const applied = resolveSlotPromotion(
    params.slotPrice,
    params.period,
    (map.get(params.propertyId) ?? []).map(toPriceInput),
  );
  if (!applied) {
    return {
      originalPrice: params.slotPrice,
      discountAmount: 0,
      finalPrice: params.slotPrice,
      promotionId: null as string | null,
      titleAr: undefined as string | undefined,
      titleEn: undefined as string | undefined,
    };
  }
  return applied;
}

async function assertOwnedProperty(userId: string, role: UserRole, propertyId: string) {
  const scope = await resolveOwnerScope(userId, role);
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, ownerId: true },
  });
  if (!property) throw new AppError(404, 'NOT_FOUND', 'Property not found');
  if (!scope.isAdmin && property.ownerId !== scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not own this property');
  }
  return property;
}

export async function listOwnerPromotions(userId: string, role: UserRole, propertyId: string) {
  await assertOwnedProperty(userId, role, propertyId);
  await expireDuePromotions([propertyId]);
  const rows = await prisma.propertyPromotion.findMany({
    where: { propertyId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toPromotionRow);
}

export async function createOwnerPromotion(
  userId: string,
  role: UserRole,
  propertyId: string,
  input: CreatePropertyPromotionInput,
  req?: AuthenticatedRequest,
) {
  await assertOwnedProperty(userId, role, propertyId);
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { basePrice: true },
  });
  if (!property) throw new AppError(404, 'NOT_FOUND', 'Property not found');
  if (property.basePrice == null) {
    throw new AppError(400, 'PROPERTY_LISTING_INCOMPLETE', 'Set a base price before creating a promotion');
  }
  if (
    input.discountType === 'fixed_amount' &&
    input.discountValue >= decimalToNumber(property.basePrice)
  ) {
    throw new AppError(
      400,
      'INVALID_DISCOUNT',
      'Fixed discount must be smaller than the property price',
    );
  }
  const row = await prisma.propertyPromotion.create({
    data: {
      propertyId,
      titleAr: input.titleAr,
      titleEn: input.titleEn,
      discountType: input.discountType as PromotionDiscountType,
      discountValue: input.discountValue,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      period: input.period ?? null,
      status: PromotionStatus.draft,
    },
  });
  await createAuditLog({
    actorUserId: userId,
    action: 'owner.promotion_created',
    entityType: 'property_promotion',
    entityId: row.id,
    metadata: { propertyId, discountType: input.discountType, discountValue: input.discountValue },
    req,
  });
  return toPromotionRow(row);
}

export async function updateOwnerPromotion(
  userId: string,
  role: UserRole,
  propertyId: string,
  promotionId: string,
  input: UpdatePropertyPromotionInput,
  req?: AuthenticatedRequest,
) {
  await assertOwnedProperty(userId, role, propertyId);
  const existing = await prisma.propertyPromotion.findFirst({
    where: { id: promotionId, propertyId },
  });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Promotion not found');
  if (existing.status === PromotionStatus.expired) {
    throw new AppError(400, 'PROMOTION_LOCKED', 'Expired promotions cannot be edited');
  }
  const future = existing.startsAt > new Date();
  if (existing.status === PromotionStatus.active && !future) {
    throw new AppError(400, 'PROMOTION_LOCKED', 'Only draft or future promotions can be edited');
  }
  const row = await prisma.propertyPromotion.update({
    where: { id: promotionId },
    data: {
      ...(input.titleAr != null ? { titleAr: input.titleAr } : {}),
      ...(input.titleEn != null ? { titleEn: input.titleEn } : {}),
      ...(input.discountType != null ? { discountType: input.discountType as PromotionDiscountType } : {}),
      ...(input.discountValue != null ? { discountValue: input.discountValue } : {}),
      ...(input.startsAt != null ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt != null ? { endsAt: input.endsAt } : {}),
      ...(input.period !== undefined ? { period: input.period ?? null } : {}),
    },
  });
  await createAuditLog({
    actorUserId: userId,
    action: 'owner.promotion_updated',
    entityType: 'property_promotion',
    entityId: row.id,
    metadata: { propertyId },
    req,
  });
  return toPromotionRow(row);
}

export async function activateOwnerPromotion(
  userId: string,
  role: UserRole,
  propertyId: string,
  promotionId: string,
  req?: AuthenticatedRequest,
) {
  await assertOwnedProperty(userId, role, propertyId);
  const existing = await prisma.propertyPromotion.findFirst({
    where: { id: promotionId, propertyId },
  });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Promotion not found');
  if (existing.endsAt < new Date()) {
    await prisma.propertyPromotion.update({
      where: { id: promotionId },
      data: { status: PromotionStatus.expired },
    });
    throw new AppError(400, 'PROMOTION_EXPIRED', 'This promotion has ended');
  }
  const row = await prisma.propertyPromotion.update({
    where: { id: promotionId },
    data: { status: PromotionStatus.active },
  });
  await createAuditLog({
    actorUserId: userId,
    action: 'owner.promotion_activated',
    entityType: 'property_promotion',
    entityId: row.id,
    metadata: { propertyId },
    req,
  });
  return toPromotionRow(row);
}

export async function pauseOwnerPromotion(
  userId: string,
  role: UserRole,
  propertyId: string,
  promotionId: string,
  req?: AuthenticatedRequest,
) {
  await assertOwnedProperty(userId, role, propertyId);
  const existing = await prisma.propertyPromotion.findFirst({
    where: { id: promotionId, propertyId },
  });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Promotion not found');
  const row = await prisma.propertyPromotion.update({
    where: { id: promotionId },
    data: { status: PromotionStatus.paused },
  });
  await createAuditLog({
    actorUserId: userId,
    action: 'owner.promotion_paused',
    entityType: 'property_promotion',
    entityId: row.id,
    metadata: { propertyId },
    req,
  });
  return toPromotionRow(row);
}

export async function listAdminPropertyPromotions(propertyId: string) {
  await expireDuePromotions([propertyId]);
  const rows = await prisma.propertyPromotion.findMany({
    where: { propertyId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toPromotionRow);
}

export async function disableAdminPromotion(
  actorUserId: string,
  propertyId: string,
  promotionId: string,
  req?: AuthenticatedRequest,
) {
  const existing = await prisma.propertyPromotion.findFirst({
    where: { id: promotionId, propertyId },
  });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Promotion not found');
  const row = await prisma.propertyPromotion.update({
    where: { id: promotionId },
    data: { status: PromotionStatus.paused },
  });
  await createAuditLog({
    actorUserId,
    action: 'admin.promotion_disabled',
    entityType: 'property_promotion',
    entityId: row.id,
    metadata: { propertyId },
    req,
  });
  return toPromotionRow(row);
}
