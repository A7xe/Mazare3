import { prisma, PlacementType, PromotionStatus, Prisma } from '@mazare3/db';
import type { CreatePropertyPlacementInput, PropertyPlacementRow } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { completeExpiredSponsorshipOrders } from './sponsorship.service.js';

export type LivePlacementFlags = {
  isSponsored: boolean;
  isFeatured: boolean;
  placementType: 'sponsored' | 'featured' | null;
};

export function emptyPlacementFlags(): LivePlacementFlags {
  return { isSponsored: false, isFeatured: false, placementType: null };
}

export function placementRank(flags: LivePlacementFlags | undefined): number {
  if (flags?.isSponsored) return 2;
  if (flags?.isFeatured) return 1;
  return 0;
}

export async function expireDuePlacements(propertyIds?: string[]) {
  await prisma.propertyPlacement.updateMany({
    where: {
      status: PromotionStatus.active,
      endsAt: { lt: new Date() },
      ...(propertyIds?.length ? { propertyId: { in: propertyIds } } : {}),
    },
    data: { status: PromotionStatus.expired },
  });
  await completeExpiredSponsorshipOrders(propertyIds);
}

/** Live placement property ids — independent of newest-catalog caps. */
export async function listLivePlacementPropertyIds(params: {
  placementType: PlacementType;
  propertyWhere?: Prisma.PropertyWhereInput;
  take?: number;
}): Promise<string[]> {
  await expireDuePlacements();
  const now = new Date();
  const take = params.take ?? 24;
  const rows = await prisma.propertyPlacement.findMany({
    where: {
      placementType: params.placementType,
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

function toRow(row: {
  id: string;
  propertyId: string;
  placementType: PlacementType;
  startsAt: Date;
  endsAt: Date;
  status: PromotionStatus;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PropertyPlacementRow {
  return {
    id: row.id,
    propertyId: row.propertyId,
    placementType: row.placementType,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status,
    adminNote: row.adminNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** One query for all requested properties. Does not leak unpublished campaigns. */
export async function loadLivePlacementsByPropertyIds(
  propertyIds: string[],
): Promise<Map<string, LivePlacementFlags>> {
  const map = new Map<string, LivePlacementFlags>();
  for (const id of propertyIds) map.set(id, emptyPlacementFlags());
  if (!propertyIds.length) return map;

  await expireDuePlacements(propertyIds);
  const now = new Date();
  const rows = await prisma.propertyPlacement.findMany({
    where: {
      propertyId: { in: propertyIds },
      status: PromotionStatus.active,
      startsAt: { lte: now },
      endsAt: { gte: now },
      property: { status: 'published', owner: { status: 'approved' } },
    },
    select: { propertyId: true, placementType: true },
  });

  for (const row of rows) {
    const flags = map.get(row.propertyId) ?? emptyPlacementFlags();
    if (row.placementType === PlacementType.sponsored) flags.isSponsored = true;
    if (row.placementType === PlacementType.featured) flags.isFeatured = true;
    flags.placementType = flags.isSponsored ? 'sponsored' : flags.isFeatured ? 'featured' : null;
    map.set(row.propertyId, flags);
  }
  return map;
}

export function applyPlacementFlags<T extends { id: string }>(
  items: T[],
  map: Map<string, LivePlacementFlags>,
): Array<T & LivePlacementFlags> {
  return items.map((item) => {
    const flags = map.get(item.id) ?? emptyPlacementFlags();
    return { ...item, ...flags };
  });
}

export async function listAdminPropertyPlacements(propertyId: string) {
  await expireDuePlacements([propertyId]);
  const rows = await prisma.propertyPlacement.findMany({
    where: { propertyId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toRow);
}

export async function createAdminPlacement(
  actorUserId: string,
  propertyId: string,
  input: CreatePropertyPlacementInput,
  req?: AuthenticatedRequest,
) {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } });
  if (!property) throw new AppError(404, 'NOT_FOUND', 'Property not found');
  const row = await prisma.propertyPlacement.create({
    data: {
      propertyId,
      placementType: input.placementType as PlacementType,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      adminNote: input.adminNote ?? null,
      createdByAdminId: actorUserId,
      status: PromotionStatus.draft,
    },
  });
  await createAuditLog({
    actorUserId,
    action: 'admin.placement_created',
    entityType: 'property_placement',
    entityId: row.id,
    metadata: { propertyId, placementType: row.placementType },
    req,
  });
  return toRow(row);
}

export async function activateAdminPlacement(
  actorUserId: string,
  propertyId: string,
  placementId: string,
  req?: AuthenticatedRequest,
) {
  const existing = await prisma.propertyPlacement.findFirst({
    where: { id: placementId, propertyId },
  });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Placement not found');
  if (existing.endsAt < new Date()) {
    await prisma.propertyPlacement.update({
      where: { id: placementId },
      data: { status: PromotionStatus.expired },
    });
    throw new AppError(400, 'PLACEMENT_EXPIRED', 'This placement has ended');
  }
  const row = await prisma.propertyPlacement.update({
    where: { id: placementId },
    data: { status: PromotionStatus.active },
  });
  await createAuditLog({
    actorUserId,
    action: 'admin.placement_activated',
    entityType: 'property_placement',
    entityId: row.id,
    metadata: { propertyId },
    req,
  });
  return toRow(row);
}

export async function pauseAdminPlacement(
  actorUserId: string,
  propertyId: string,
  placementId: string,
  req?: AuthenticatedRequest,
) {
  const existing = await prisma.propertyPlacement.findFirst({
    where: { id: placementId, propertyId },
  });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Placement not found');
  const row = await prisma.propertyPlacement.update({
    where: { id: placementId },
    data: { status: PromotionStatus.paused },
  });
  await createAuditLog({
    actorUserId,
    action: 'admin.placement_paused',
    entityType: 'property_placement',
    entityId: row.id,
    metadata: { propertyId },
    req,
  });
  return toRow(row);
}

export function liveFeaturedFilter(now = new Date()): Prisma.PropertyWhereInput {
  return {
    placements: {
      some: {
        placementType: PlacementType.featured,
        status: PromotionStatus.active,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    },
  };
}
