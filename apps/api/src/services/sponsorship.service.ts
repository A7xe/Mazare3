import {
  prisma,
  Prisma,
  CatalogPackageStatus,
  SponsoredOrderStatus,
  PlacementType,
  PromotionStatus,
  PropertyStatus,
  OwnerStatus,
} from '@mazare3/db';
import {
  filsToJod,
  jodToFils,
  type ConfirmSponsoredPaymentInput,
  type CreateSponsoredOrderInput,
  type CreateSponsoredPackageInput,
  type SponsoredPlacementOrderRow,
  type SponsoredPlacementPackageRow,
  type UpdateSponsoredPackageInput,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { assertSponsoredOrderTransition } from '../lib/sponsored-order-machine.js';
import { createAuditLog } from './audit.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { decimalToNumber } from '../lib/availability-times.js';

function moneyJod(value: number): Prisma.Decimal {
  return new Prisma.Decimal(filsToJod(jodToFils(value)).toFixed(2));
}

function toPackageRow(row: {
  id: string;
  nameAr: string;
  nameEn: string;
  durationDays: number;
  priceAmount: Prisma.Decimal | number;
  currency: string;
  status: CatalogPackageStatus;
  createdAt: Date;
  updatedAt: Date;
}): SponsoredPlacementPackageRow {
  return {
    id: row.id,
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    durationDays: row.durationDays,
    priceAmount: decimalToNumber(row.priceAmount),
    currency: row.currency,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function dateOnly(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

type OrderWithJoins = Prisma.SponsoredPlacementOrderGetPayload<{
  include: {
    property: { select: { titleAr: true; titleEn: true; slug: true } };
    owner: { select: { displayName: true } };
    placement: { select: { startsAt: true; endsAt: true } };
  };
}>;

function toOrderRow(row: OrderWithJoins): SponsoredPlacementOrderRow {
  return {
    id: row.id,
    ownerId: row.ownerId,
    propertyId: row.propertyId,
    propertyTitleAr: row.property.titleAr,
    propertyTitleEn: row.property.titleEn ?? row.property.titleAr,
    propertySlug: row.property.slug,
    ownerDisplayName: row.owner.displayName,
    packageId: row.packageId,
    packageNameArSnapshot: row.packageNameArSnapshot,
    packageNameEnSnapshot: row.packageNameEnSnapshot,
    durationDaysSnapshot: row.durationDaysSnapshot,
    priceAmountSnapshot: decimalToNumber(row.priceAmountSnapshot),
    currency: row.currency,
    advertisingRevenueAmount:
      row.advertisingRevenueAmount == null ? null : decimalToNumber(row.advertisingRevenueAmount),
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    paidAt: row.paidAt?.toISOString() ?? null,
    activatedAt: row.activatedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    paymentReference: row.paymentReference,
    paymentDate: dateOnly(row.paymentDate),
    adminNote: row.adminNote,
    placementId: row.placementId,
    placementStartsAt: row.placement?.startsAt.toISOString() ?? null,
    placementEndsAt: row.placement?.endsAt.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const orderInclude = {
  property: { select: { titleAr: true, titleEn: true, slug: true } },
  owner: { select: { displayName: true } },
  placement: { select: { startsAt: true, endsAt: true } },
} as const;

async function loadOrder(id: string) {
  const row = await prisma.sponsoredPlacementOrder.findUnique({
    where: { id },
    include: orderInclude,
  });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Sponsorship order not found');
  return row;
}

export async function completeExpiredSponsorshipOrders(propertyIds?: string[]) {
  await prisma.sponsoredPlacementOrder.updateMany({
    where: {
      status: SponsoredOrderStatus.active,
      ...(propertyIds?.length ? { propertyId: { in: propertyIds } } : {}),
      OR: [
        { placement: { endsAt: { lt: new Date() } } },
        { placement: { status: PromotionStatus.expired } },
      ],
    },
    data: { status: SponsoredOrderStatus.completed },
  });
}

export async function listAdminSponsoredPackages() {
  const rows = await prisma.sponsoredPlacementPackage.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(toPackageRow);
}

export async function listActiveSponsoredPackages() {
  const rows = await prisma.sponsoredPlacementPackage.findMany({
    where: { status: CatalogPackageStatus.active },
    orderBy: { durationDays: 'asc' },
  });
  return rows.map(toPackageRow);
}

export async function createAdminSponsoredPackage(
  actorUserId: string,
  input: CreateSponsoredPackageInput,
  req?: AuthenticatedRequest,
) {
  const row = await prisma.sponsoredPlacementPackage.create({
    data: {
      nameAr: input.nameAr,
      nameEn: input.nameEn,
      durationDays: input.durationDays,
      priceAmount: moneyJod(input.priceAmount),
      currency: input.currency ?? 'JOD',
      status: CatalogPackageStatus.active,
    },
  });
  await createAuditLog({
    actorUserId,
    action: 'admin.sponsorship_package_created',
    entityType: 'sponsored_placement_package',
    entityId: row.id,
    metadata: { durationDays: row.durationDays, priceAmount: decimalToNumber(row.priceAmount) },
    req,
  });
  return toPackageRow(row);
}

export async function updateAdminSponsoredPackage(
  actorUserId: string,
  id: string,
  input: UpdateSponsoredPackageInput,
  req?: AuthenticatedRequest,
) {
  const existing = await prisma.sponsoredPlacementPackage.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Package not found');
  const row = await prisma.sponsoredPlacementPackage.update({
    where: { id },
    data: {
      ...(input.nameAr != null ? { nameAr: input.nameAr } : {}),
      ...(input.nameEn != null ? { nameEn: input.nameEn } : {}),
      ...(input.durationDays != null ? { durationDays: input.durationDays } : {}),
      ...(input.priceAmount != null ? { priceAmount: moneyJod(input.priceAmount) } : {}),
    },
  });
  await createAuditLog({
    actorUserId,
    action: 'admin.sponsorship_package_updated',
    entityType: 'sponsored_placement_package',
    entityId: row.id,
    req,
  });
  return toPackageRow(row);
}

export async function setAdminSponsoredPackageStatus(
  actorUserId: string,
  id: string,
  status: CatalogPackageStatus,
  req?: AuthenticatedRequest,
) {
  const existing = await prisma.sponsoredPlacementPackage.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Package not found');
  const row = await prisma.sponsoredPlacementPackage.update({
    where: { id },
    data: { status },
  });
  await createAuditLog({
    actorUserId,
    action: status === CatalogPackageStatus.active ? 'admin.sponsorship_package_activated' : 'admin.sponsorship_package_deactivated',
    entityType: 'sponsored_placement_package',
    entityId: row.id,
    req,
  });
  return toPackageRow(row);
}

export async function createOwnerSponsoredOrder(
  actorUserId: string,
  propertyId: string,
  input: CreateSponsoredOrderInput,
  req?: AuthenticatedRequest,
) {
  const owner = await prisma.ownerProfile.findUnique({ where: { userId: actorUserId } });
  if (!owner || owner.status !== OwnerStatus.approved) {
    throw new AppError(403, 'OWNER_NOT_APPROVED', 'Owner profile not approved');
  }
  const property = await prisma.property.findFirst({
    where: { id: propertyId, ownerId: owner.id },
    select: { id: true, status: true, ownerId: true },
  });
  if (!property) throw new AppError(403, 'FORBIDDEN', 'Property not found for this owner');
  if (property.status !== PropertyStatus.published) {
    throw new AppError(409, 'PROPERTY_NOT_PUBLISHED', 'Only published properties can request sponsorship');
  }
  const pkg = await prisma.sponsoredPlacementPackage.findUnique({ where: { id: input.packageId } });
  if (!pkg || pkg.status !== CatalogPackageStatus.active) {
    throw new AppError(409, 'PACKAGE_INACTIVE', 'This sponsorship package is not available');
  }
  const row = await prisma.sponsoredPlacementOrder.create({
    data: {
      ownerId: owner.id,
      propertyId: property.id,
      packageId: pkg.id,
      packageNameArSnapshot: pkg.nameAr,
      packageNameEnSnapshot: pkg.nameEn,
      durationDaysSnapshot: pkg.durationDays,
      priceAmountSnapshot: pkg.priceAmount,
      currency: pkg.currency,
      status: SponsoredOrderStatus.pending_review,
    },
    include: orderInclude,
  });
  await createAuditLog({
    actorUserId,
    action: 'owner.sponsorship_requested',
    entityType: 'sponsored_placement_order',
    entityId: row.id,
    metadata: { propertyId, packageId: pkg.id, priceAmount: decimalToNumber(pkg.priceAmount) },
    req,
  });
  return toOrderRow(row);
}

export async function listOwnerSponsoredOrders(actorUserId: string, propertyId?: string) {
  const owner = await prisma.ownerProfile.findUnique({ where: { userId: actorUserId } });
  if (!owner) throw new AppError(403, 'FORBIDDEN', 'Owner profile required');
  if (propertyId) {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, ownerId: owner.id },
      select: { id: true },
    });
    if (!property) throw new AppError(403, 'FORBIDDEN', 'Property not found for this owner');
  }
  const rows = await prisma.sponsoredPlacementOrder.findMany({
    where: { ownerId: owner.id, ...(propertyId ? { propertyId } : {}) },
    include: orderInclude,
    orderBy: { requestedAt: 'desc' },
  });
  return rows.map(toOrderRow);
}

export async function listAdminSponsoredOrders(status?: SponsoredOrderStatus) {
  const rows = await prisma.sponsoredPlacementOrder.findMany({
    where: status ? { status } : {},
    include: orderInclude,
    orderBy: { requestedAt: 'desc' },
    take: 200,
  });
  return rows.map(toOrderRow);
}

export async function approveSponsoredOrder(
  actorUserId: string,
  orderId: string,
  adminNote: string | undefined,
  req?: AuthenticatedRequest,
) {
  const existing = await prisma.sponsoredPlacementOrder.findUnique({ where: { id: orderId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Sponsorship order not found');
  assertSponsoredOrderTransition(existing.status, SponsoredOrderStatus.approved_pending_payment);
  const updated = await prisma.sponsoredPlacementOrder.updateMany({
    where: { id: orderId, status: SponsoredOrderStatus.pending_review },
    data: {
      status: SponsoredOrderStatus.approved_pending_payment,
      approvedAt: new Date(),
      ...(adminNote != null ? { adminNote } : {}),
    },
  });
  if (updated.count !== 1) throw new AppError(409, 'INVALID_SPONSORSHIP_TRANSITION', 'Order was already processed');
  await createAuditLog({
    actorUserId,
    action: 'admin.sponsorship_approved',
    entityType: 'sponsored_placement_order',
    entityId: orderId,
    req,
  });
  return toOrderRow(await loadOrder(orderId));
}

export async function rejectSponsoredOrder(
  actorUserId: string,
  orderId: string,
  adminNote: string | undefined,
  req?: AuthenticatedRequest,
) {
  const existing = await prisma.sponsoredPlacementOrder.findUnique({ where: { id: orderId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Sponsorship order not found');
  assertSponsoredOrderTransition(existing.status, SponsoredOrderStatus.rejected);
  const updated = await prisma.sponsoredPlacementOrder.updateMany({
    where: { id: orderId, status: { in: [SponsoredOrderStatus.pending_review, SponsoredOrderStatus.approved_pending_payment] } },
    data: {
      status: SponsoredOrderStatus.rejected,
      rejectedAt: new Date(),
      ...(adminNote != null ? { adminNote } : {}),
    },
  });
  if (updated.count !== 1) throw new AppError(409, 'INVALID_SPONSORSHIP_TRANSITION', 'Order cannot be rejected');
  await createAuditLog({
    actorUserId,
    action: 'admin.sponsorship_rejected',
    entityType: 'sponsored_placement_order',
    entityId: orderId,
    req,
  });
  return toOrderRow(await loadOrder(orderId));
}

export async function cancelSponsoredOrder(
  actorUserId: string,
  orderId: string,
  req?: AuthenticatedRequest,
) {
  const existing = await prisma.sponsoredPlacementOrder.findUnique({ where: { id: orderId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Sponsorship order not found');
  assertSponsoredOrderTransition(existing.status, SponsoredOrderStatus.cancelled);
  const updated = await prisma.sponsoredPlacementOrder.updateMany({
    where: {
      id: orderId,
      status: {
        in: [
          SponsoredOrderStatus.pending_review,
          SponsoredOrderStatus.approved_pending_payment,
          SponsoredOrderStatus.paid,
        ],
      },
      placementId: null,
    },
    data: { status: SponsoredOrderStatus.cancelled, cancelledAt: new Date() },
  });
  if (updated.count !== 1) throw new AppError(409, 'INVALID_SPONSORSHIP_TRANSITION', 'Order cannot be cancelled');
  await createAuditLog({
    actorUserId,
    action: 'admin.sponsorship_cancelled',
    entityType: 'sponsored_placement_order',
    entityId: orderId,
    req,
  });
  return toOrderRow(await loadOrder(orderId));
}

export async function confirmSponsoredPayment(
  actorUserId: string,
  orderId: string,
  input: ConfirmSponsoredPaymentInput,
  req?: AuthenticatedRequest,
) {
  const existing = await prisma.sponsoredPlacementOrder.findUnique({ where: { id: orderId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Sponsorship order not found');
  assertSponsoredOrderTransition(existing.status, SponsoredOrderStatus.paid);
  const paymentDate = new Date(`${input.paymentDate}T00:00:00.000Z`);
  const updated = await prisma.sponsoredPlacementOrder.updateMany({
    where: { id: orderId, status: SponsoredOrderStatus.approved_pending_payment },
    data: {
      status: SponsoredOrderStatus.paid,
      paidAt: new Date(),
      paymentReference: input.paymentReference,
      paymentDate,
      advertisingRevenueAmount: existing.priceAmountSnapshot,
    },
  });
  if (updated.count !== 1) {
    throw new AppError(409, 'PAYMENT_ALREADY_CONFIRMED', 'Payment was already confirmed for this order');
  }
  await createAuditLog({
    actorUserId,
    action: 'admin.sponsorship_payment_confirmed',
    entityType: 'sponsored_placement_order',
    entityId: orderId,
    metadata: { paymentReference: input.paymentReference, paymentDate: input.paymentDate },
    req,
  });
  return toOrderRow(await loadOrder(orderId));
}

export async function activateSponsoredOrder(
  actorUserId: string,
  orderId: string,
  req?: AuthenticatedRequest,
) {
  const existing = await prisma.sponsoredPlacementOrder.findUnique({ where: { id: orderId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Sponsorship order not found');
  if (existing.status !== SponsoredOrderStatus.paid) {
    throw new AppError(409, 'SPONSORSHIP_UNPAID', 'Only paid sponsorship orders can be activated');
  }
  assertSponsoredOrderTransition(existing.status, SponsoredOrderStatus.active);
  if (existing.placementId) {
    throw new AppError(409, 'ALREADY_ACTIVATED', 'This order already has a placement');
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + existing.durationDaysSnapshot * 24 * 60 * 60 * 1000);

  const placement = await prisma.$transaction(async (tx) => {
    const claimed = await tx.sponsoredPlacementOrder.updateMany({
      where: { id: orderId, status: SponsoredOrderStatus.paid, placementId: null },
      data: { status: SponsoredOrderStatus.active, activatedAt: startsAt },
    });
    if (claimed.count !== 1) {
      throw new AppError(409, 'ALREADY_ACTIVATED', 'This order was already activated');
    }
    const created = await tx.propertyPlacement.create({
      data: {
        propertyId: existing.propertyId,
        placementType: PlacementType.sponsored,
        startsAt,
        endsAt,
        status: PromotionStatus.active,
        createdByAdminId: actorUserId,
        adminNote: `sponsorship-order:${orderId}`,
      },
    });
    await tx.sponsoredPlacementOrder.update({
      where: { id: orderId },
      data: { placementId: created.id },
    });
    return created;
  });

  await createAuditLog({
    actorUserId,
    action: 'admin.sponsorship_activated',
    entityType: 'sponsored_placement_order',
    entityId: orderId,
    metadata: { placementId: placement.id, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
    req,
  });
  return toOrderRow(await loadOrder(orderId));
}
