import { prisma, PropertyStatus, type PropertyType } from '@mazare3/db';
import type {
  CreateOwnerPropertyInput,
  OwnerPropertyEdit,
  UpdateOwnerPropertyInput,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { uniquePropertySlug } from '../lib/slug.js';
import { createAuditLog } from './audit.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { resolveOwnerScope } from './owner-access.js';

const OWNER_EDITABLE_STATUSES: PropertyStatus[] = [
  PropertyStatus.draft,
  PropertyStatus.changes_requested,
];

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

async function resolveAmenityIds(keys: string[]): Promise<string[]> {
  if (!keys.length) return [];
  const amenities = await prisma.amenity.findMany({
    where: { key: { in: keys }, isActive: true },
    select: { id: true, key: true },
  });
  const found = new Set(amenities.map((a) => a.key));
  const missing = keys.filter((k) => !found.has(k));
  if (missing.length) {
    throw new AppError(400, 'INVALID_AMENITY', `Unknown amenities: ${missing.join(', ')}`);
  }
  return amenities.map((a) => a.id);
}

function mapPropertyEdit(
  p: Awaited<ReturnType<typeof loadPropertyForEdit>>,
): OwnerPropertyEdit {
  return {
    id: p.id,
    slug: p.slug,
    type: p.type,
    titleAr: p.titleAr,
    titleEn: p.titleEn ?? p.titleAr,
    descriptionAr: p.descriptionAr,
    descriptionEn: p.descriptionEn ?? '',
    city: p.city,
    area: p.area,
    approximateAddress: p.approximateAddress,
    exactAddress: p.exactAddress,
    basePrice: decimalToNumber(p.basePrice),
    currency: p.currency,
    capacity: p.capacity,
    status: p.status,
    allowsOvernight: p.allowsOvernight,
    allowsFamilies: p.allowsFamilies,
    allowsYouth: p.allowsYouth,
    poolsCount: p.poolsCount,
    amenityKeys: p.amenities.map((a) => a.amenity.key),
    imageUrls: p.media.map((m) => m.url),
    rules: p.rules.map((r) => ({ titleAr: r.titleAr, titleEn: r.titleEn })),
  };
}

async function loadPropertyForEdit(propertyId: string, ownerProfileId: string) {
  const p = await prisma.property.findFirst({
    where: { id: propertyId, ownerId: ownerProfileId },
    include: {
      media: { orderBy: { sortOrder: 'asc' } },
      amenities: { include: { amenity: true } },
      rules: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!p) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }
  return p;
}

function assertOwnerCanEditStatus(status: PropertyStatus) {
  if (!OWNER_EDITABLE_STATUSES.includes(status)) {
    throw new AppError(
      403,
      'PROPERTY_NOT_EDITABLE',
      'Property cannot be edited in its current status',
    );
  }
}

export async function createOwnerProperty(
  userId: string,
  role: import('@mazare3/shared').UserRole,
  input: CreateOwnerPropertyInput,
  req?: AuthenticatedRequest,
): Promise<OwnerPropertyEdit> {
  const scope = await resolveOwnerScope(userId, role);
  if (scope.isAdmin) {
    throw new AppError(403, 'FORBIDDEN', 'Use admin tools to create properties');
  }

  const slug = await uniquePropertySlug(input.titleEn ?? input.titleAr);
  const amenityIds = await resolveAmenityIds(input.amenityKeys ?? []);
  const poolsCount = input.poolsCount ?? 0;

  const property = await prisma.property.create({
    data: {
      ownerId: scope.ownerProfileId!,
      slug,
      type: input.type as PropertyType,
      titleAr: input.titleAr.trim(),
      titleEn: input.titleEn?.trim() || null,
      descriptionAr: input.descriptionAr.trim(),
      descriptionEn: input.descriptionEn?.trim() || null,
      city: input.city.trim(),
      area: input.area.trim(),
      approximateAddress: input.approximateAddress.trim(),
      exactAddress: input.exactAddress.trim(),
      capacity: input.capacity,
      basePrice: input.basePrice,
      allowsOvernight: input.allowsOvernight ?? true,
      allowsFamilies: input.allowsFamilies ?? true,
      allowsYouth: input.allowsYouth ?? false,
      poolsCount,
      hasIndoorPool: (input.amenityKeys ?? []).includes('indoor_pool'),
      hasHeatedPool: (input.amenityKeys ?? []).includes('heated_pool'),
      hasFootballField: (input.amenityKeys ?? []).includes('football'),
      status: PropertyStatus.draft,
      media: {
        create: input.imageUrls.map((url, i) => ({
          url,
          sortOrder: i,
          altAr: input.titleAr,
          altEn: input.titleEn ?? input.titleAr,
        })),
      },
      amenities: {
        create: amenityIds.map((amenityId) => ({ amenityId })),
      },
      rules: {
        create: (input.rules ?? []).map((r, i) => ({
          titleAr: r.titleAr,
          titleEn: r.titleEn ?? null,
          sortOrder: i,
        })),
      },
    },
    include: {
      media: { orderBy: { sortOrder: 'asc' } },
      amenities: { include: { amenity: true } },
      rules: { orderBy: { sortOrder: 'asc' } },
    },
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'owner.property_created',
    entityType: 'property',
    entityId: property.id,
    metadata: { slug: property.slug, status: property.status },
    req,
  });

  return mapPropertyEdit(property);
}

export async function getOwnerPropertyForEdit(
  userId: string,
  role: import('@mazare3/shared').UserRole,
  propertyId: string,
): Promise<OwnerPropertyEdit | null> {
  const scope = await resolveOwnerScope(userId, role);
  if (scope.isAdmin) return null;
  const p = await loadPropertyForEdit(propertyId, scope.ownerProfileId!);
  return mapPropertyEdit(p);
}

export async function updateOwnerProperty(
  userId: string,
  role: import('@mazare3/shared').UserRole,
  propertyId: string,
  input: UpdateOwnerPropertyInput,
  req?: AuthenticatedRequest,
): Promise<OwnerPropertyEdit> {
  const scope = await resolveOwnerScope(userId, role);
  if (scope.isAdmin) {
    throw new AppError(403, 'FORBIDDEN', 'Use admin tools to update properties');
  }

  const existing = await loadPropertyForEdit(propertyId, scope.ownerProfileId!);
  assertOwnerCanEditStatus(existing.status);

  const amenityIds =
    input.amenityKeys !== undefined ? await resolveAmenityIds(input.amenityKeys) : undefined;

  const poolsCount = input.poolsCount ?? existing.poolsCount;
  const amenityKeys = input.amenityKeys ?? existing.amenities.map((a) => a.amenity.key);

  await prisma.$transaction(async (tx) => {
    await tx.property.update({
      where: { id: propertyId },
      data: {
        ...(input.type !== undefined && { type: input.type as PropertyType }),
        ...(input.titleAr !== undefined && { titleAr: input.titleAr.trim() }),
        ...(input.titleEn !== undefined && { titleEn: input.titleEn?.trim() || null }),
        ...(input.descriptionAr !== undefined && { descriptionAr: input.descriptionAr.trim() }),
        ...(input.descriptionEn !== undefined && {
          descriptionEn: input.descriptionEn?.trim() || null,
        }),
        ...(input.city !== undefined && { city: input.city.trim() }),
        ...(input.area !== undefined && { area: input.area.trim() }),
        ...(input.approximateAddress !== undefined && {
          approximateAddress: input.approximateAddress.trim(),
        }),
        ...(input.exactAddress !== undefined && { exactAddress: input.exactAddress.trim() }),
        ...(input.basePrice !== undefined && { basePrice: input.basePrice }),
        ...(input.capacity !== undefined && { capacity: input.capacity }),
        ...(input.allowsOvernight !== undefined && { allowsOvernight: input.allowsOvernight }),
        ...(input.allowsFamilies !== undefined && { allowsFamilies: input.allowsFamilies }),
        ...(input.allowsYouth !== undefined && { allowsYouth: input.allowsYouth }),
        ...(input.poolsCount !== undefined && { poolsCount }),
        hasIndoorPool: amenityKeys.includes('indoor_pool'),
        hasHeatedPool: amenityKeys.includes('heated_pool'),
        hasFootballField: amenityKeys.includes('football'),
      },
    });

    if (input.imageUrls !== undefined) {
      await tx.propertyMedia.deleteMany({ where: { propertyId } });
      await tx.propertyMedia.createMany({
        data: input.imageUrls.map((url, i) => ({
          propertyId,
          url,
          sortOrder: i,
          altAr: input.titleAr ?? existing.titleAr,
          altEn: input.titleEn ?? existing.titleEn ?? existing.titleAr,
        })),
      });
    }

    if (amenityIds !== undefined) {
      await tx.propertyAmenity.deleteMany({ where: { propertyId } });
      if (amenityIds.length) {
        await tx.propertyAmenity.createMany({
          data: amenityIds.map((amenityId) => ({ propertyId, amenityId })),
        });
      }
    }

    if (input.rules !== undefined) {
      await tx.propertyRule.deleteMany({ where: { propertyId } });
      await tx.propertyRule.createMany({
        data: input.rules.map((r, i) => ({
          propertyId,
          titleAr: r.titleAr,
          titleEn: r.titleEn ?? null,
          sortOrder: i,
        })),
      });
    }
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'owner.property_updated',
    entityType: 'property',
    entityId: propertyId,
    req,
  });

  const updated = await loadPropertyForEdit(propertyId, scope.ownerProfileId!);
  return mapPropertyEdit(updated);
}

export async function submitOwnerPropertyForReview(
  userId: string,
  role: import('@mazare3/shared').UserRole,
  propertyId: string,
  req?: AuthenticatedRequest,
): Promise<OwnerPropertyEdit> {
  const scope = await resolveOwnerScope(userId, role);
  if (scope.isAdmin) {
    throw new AppError(403, 'FORBIDDEN', 'Owners only');
  }

  const existing = await loadPropertyForEdit(propertyId, scope.ownerProfileId!);
  if (
    existing.status !== PropertyStatus.draft &&
    existing.status !== PropertyStatus.changes_requested
  ) {
    throw new AppError(
      400,
      'INVALID_STATUS',
      'Only draft or changes_requested properties can be submitted',
    );
  }

  await prisma.property.update({
    where: { id: propertyId },
    data: { status: PropertyStatus.pending_review },
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'owner.property_submitted_for_review',
    entityType: 'property',
    entityId: propertyId,
    metadata: { previousStatus: existing.status },
    req,
  });

  const updated = await loadPropertyForEdit(propertyId, scope.ownerProfileId!);
  return mapPropertyEdit(updated);
}
