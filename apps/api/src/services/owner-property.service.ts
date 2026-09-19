import { prisma, PropertyStatus, type PropertyType } from '@mazare3/db';
import {
  type CreateOwnerPropertyDraftInput,
  type CreateOwnerPropertyInput,
  type OwnerPropertyEdit,
  type UpdateOwnerPropertyInput,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { uniquePropertySlug } from '../lib/slug.js';
import { createAuditLog } from './audit.service.js';
import { notifyPropertySubmittedForReview } from './notification.service.js';
import { assertMediaForSubmitReview } from '../lib/property-media-guards.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { resolveOwnerScope } from './owner-access.js';
import { resolvePropertyMediaPublicUrl } from '../lib/property-media-public-url.js';
import { assertPropertyListingComplete } from '../lib/property-listing-guards.js';
import {
  assertOwnerCanEditListingStatus,
  assertOwnerNotPendingReview,
} from '../lib/owner-property-mutation-guards.js';
import { assertOwnerListingSoftGate } from './legal/legal-reacceptance.service.js';
import { assertPriorConsentActive } from './legal/data-processing-consent.service.js';
import {
  assertAuthorityPackageCompleteForSubmit,
  markAuthorityUnderReviewOnPropertySubmit,
} from './property-authority.service.js';

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : value.toNumber();
}

/** Exact-location Personal Data (not approximate city/area/public approx coords). */
function hasExactLocationPersonalData(fields: {
  exactAddress?: string | null;
  latitudeExact?: number | null;
  longitudeExact?: number | null;
  arrivalInstructionsAr?: string | null;
  arrivalInstructionsEn?: string | null;
}): boolean {
  if (typeof fields.exactAddress === 'string' && fields.exactAddress.trim().length > 0) {
    return true;
  }
  if (fields.latitudeExact != null || fields.longitudeExact != null) return true;
  if (
    typeof fields.arrivalInstructionsAr === 'string' &&
    fields.arrivalInstructionsAr.trim().length > 0
  ) {
    return true;
  }
  if (
    typeof fields.arrivalInstructionsEn === 'string' &&
    fields.arrivalInstructionsEn.trim().length > 0
  ) {
    return true;
  }
  return false;
}

async function assertExactLocationPriorConsentIfNeeded(
  userId: string,
  fields: {
    exactAddress?: string | null;
    latitudeExact?: number | null;
    longitudeExact?: number | null;
    arrivalInstructionsAr?: string | null;
    arrivalInstructionsEn?: string | null;
  },
) {
  if (!hasExactLocationPersonalData(fields)) return;
  await assertPriorConsentActive(userId, 'property_and_exact_location_processing');
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
  const media = p.media.map((m) => ({
    id: m.id,
    propertyId: m.propertyId,
    url: resolvePropertyMediaPublicUrl({ url: m.url, storageKey: m.storageKey }),
    storageKey: m.storageKey ?? null,
    type: m.type === 'image' ? 'image' : (m.type as any),
    altAr: m.altAr ?? null,
    altEn: m.altEn ?? null,
    sortOrder: m.sortOrder,
    isCover: m.sortOrder === 0,
    createdAt: m.createdAt.toISOString(),
  }));

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
    latitudeApprox: p.latitudeApprox,
    longitudeApprox: p.longitudeApprox,
    latitudeExact: p.latitudeExact,
    longitudeExact: p.longitudeExact,
    arrivalInstructionsAr: p.arrivalInstructionsAr,
    arrivalInstructionsEn: p.arrivalInstructionsEn,
    basePrice: p.basePrice == null ? null : decimalToNumber(p.basePrice),
    currency: p.currency,
    capacity: p.capacity,
    status: p.status,
    allowsOvernight: p.allowsOvernight,
    allowsFamilies: p.allowsFamilies,
    allowsYouth: p.allowsYouth,
    instantBookingEnabled: p.instantBookingEnabled,
    poolsCount: p.poolsCount,
    amenityKeys: p.amenities.map((a) => a.amenity.key),
    imageUrls: media.map((m) => m.url),
    media,
    rules: p.rules.map((r) => ({ titleAr: r.titleAr, titleEn: r.titleEn })),
    reviewChangeReason: p.reviewChangeReason ?? null,
    reviewRejectionReason: p.reviewRejectionReason ?? null,
    reviewRejectedAt: p.reviewRejectedAt?.toISOString() ?? null,
  };
}

async function loadPropertyForEdit(propertyId: string, ownerProfileId: string) {
  const p = await prisma.property.findFirst({
    where: { id: propertyId, ownerId: ownerProfileId },
    include: {
      media: {
        where: { removedFromListingAt: null },
        orderBy: { sortOrder: 'asc' as const },
      },
      amenities: { include: { amenity: true } },
      rules: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!p) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }
  return p;
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

  await assertOwnerListingSoftGate(userId);

  // Approximate city/area/approx coords do not require this purpose.
  // Exact address / exact coords / arrival instructions do.
  await assertExactLocationPriorConsentIfNeeded(userId, {
    exactAddress: input.exactAddress,
    latitudeExact: input.latitudeExact ?? null,
    longitudeExact: input.longitudeExact ?? null,
    arrivalInstructionsAr: input.arrivalInstructionsAr ?? null,
    arrivalInstructionsEn: input.arrivalInstructionsEn ?? null,
  });

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
      latitudeApprox: input.latitudeApprox ?? null,
      longitudeApprox: input.longitudeApprox ?? null,
      latitudeExact: input.latitudeExact ?? null,
      longitudeExact: input.longitudeExact ?? null,
      arrivalInstructionsAr: input.arrivalInstructionsAr?.trim() || null,
      arrivalInstructionsEn: input.arrivalInstructionsEn?.trim() || null,
      capacity: input.capacity,
      basePrice: input.basePrice,
      allowsOvernight: input.allowsOvernight ?? true,
      allowsFamilies: input.allowsFamilies ?? true,
      allowsYouth: input.allowsYouth ?? false,
      instantBookingEnabled: input.instantBookingEnabled ?? true,
      poolsCount,
      hasIndoorPool: (input.amenityKeys ?? []).includes('indoor_pool'),
      hasHeatedPool: (input.amenityKeys ?? []).includes('heated_pool'),
      hasFootballField: (input.amenityKeys ?? []).includes('football'),
      status: PropertyStatus.draft,
      ...(input.imageUrls.length
        ? {
            media: {
              create: input.imageUrls.map((url, i) => ({
                url,
                sortOrder: i,
                altAr: input.titleAr,
                altEn: input.titleEn ?? input.titleAr,
              })),
            },
          }
        : {}),
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
      media: {
        where: { removedFromListingAt: null },
        orderBy: { sortOrder: 'asc' as const },
      },
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

/**
 * AF-1.1c — Create an incomplete onboarding draft from Basic Information only.
 * Location + basePrice remain null. Status is always draft.
 */
export async function createOwnerPropertyDraft(
  userId: string,
  role: import('@mazare3/shared').UserRole,
  input: CreateOwnerPropertyDraftInput,
  req?: AuthenticatedRequest,
): Promise<OwnerPropertyEdit> {
  const scope = await resolveOwnerScope(userId, role);
  if (scope.isAdmin) {
    throw new AppError(403, 'FORBIDDEN', 'Use admin tools to create properties');
  }
  if (!scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Approved owner profile required');
  }

  await assertOwnerListingSoftGate(userId);

  const slug = await uniquePropertySlug(input.titleEn ?? input.titleAr);

  const property = await prisma.property.create({
    data: {
      ownerId: scope.ownerProfileId,
      slug,
      type: input.type as PropertyType,
      titleAr: input.titleAr.trim(),
      titleEn: input.titleEn?.trim() || null,
      descriptionAr: input.descriptionAr.trim(),
      descriptionEn: input.descriptionEn?.trim() || null,
      capacity: input.capacity,
      allowsOvernight: input.allowsOvernight ?? true,
      allowsFamilies: input.allowsFamilies ?? true,
      allowsYouth: input.allowsYouth ?? false,
      // Truthful incomplete draft — do not invent location/price.
      city: null,
      area: null,
      approximateAddress: null,
      exactAddress: null,
      basePrice: null,
      status: PropertyStatus.draft,
    },
    include: {
      media: {
        where: { removedFromListingAt: null },
        orderBy: { sortOrder: 'asc' as const },
      },
      amenities: { include: { amenity: true } },
      rules: { orderBy: { sortOrder: 'asc' } },
    },
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'owner.property_draft_created',
    entityType: 'property',
    entityId: property.id,
    metadata: { slug: property.slug, status: property.status, source: 'add_farm' },
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
  const definedKeys = (Object.keys(input) as (keyof UpdateOwnerPropertyInput)[]).filter(
    (key) => input[key] !== undefined,
  );
  const bookingModeOnly =
    definedKeys.length === 1 && definedKeys[0] === 'instantBookingEnabled';
  if (bookingModeOnly) {
    // Operational toggle for live listings; still frozen while Admin is reviewing.
    assertOwnerNotPendingReview(existing.status);
    await prisma.property.update({
      where: { id: propertyId },
      data: { instantBookingEnabled: input.instantBookingEnabled },
    });
    await createAuditLog({
      actorUserId: userId,
      action: 'property.booking_mode_updated',
      entityType: 'property',
      entityId: propertyId,
      metadata: { instantBookingEnabled: input.instantBookingEnabled },
      req,
    });
    return mapPropertyEdit(await loadPropertyForEdit(propertyId, scope.ownerProfileId!));
  }

  // Location-only must not bypass the canonical listing edit gate.
  assertOwnerCanEditListingStatus(existing.status);

  // Gate only when this update writes exact-location Personal Data (not approx).
  if (
    input.exactAddress !== undefined ||
    input.latitudeExact !== undefined ||
    input.longitudeExact !== undefined ||
    input.arrivalInstructionsAr !== undefined ||
    input.arrivalInstructionsEn !== undefined
  ) {
    await assertExactLocationPriorConsentIfNeeded(userId, {
      exactAddress: input.exactAddress,
      latitudeExact: input.latitudeExact,
      longitudeExact: input.longitudeExact,
      arrivalInstructionsAr: input.arrivalInstructionsAr,
      arrivalInstructionsEn: input.arrivalInstructionsEn,
    });
  }

  const amenityIds =
    input.amenityKeys !== undefined ? await resolveAmenityIds(input.amenityKeys) : undefined;

  const poolsCount = input.poolsCount ?? existing.poolsCount;
  const amenityKeys = input.amenityKeys ?? existing.amenities.map((a) => a.amenity.key);

  const locationChanged =
    (input.city !== undefined && input.city.trim() !== (existing.city ?? '')) ||
    (input.area !== undefined && input.area.trim() !== (existing.area ?? '')) ||
    (input.exactAddress !== undefined &&
      input.exactAddress.trim() !== (existing.exactAddress ?? ''));

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
        ...(input.latitudeApprox !== undefined && { latitudeApprox: input.latitudeApprox }),
        ...(input.longitudeApprox !== undefined && { longitudeApprox: input.longitudeApprox }),
        ...(input.latitudeExact !== undefined && { latitudeExact: input.latitudeExact }),
        ...(input.longitudeExact !== undefined && { longitudeExact: input.longitudeExact }),
        ...(input.arrivalInstructionsAr !== undefined && {
          arrivalInstructionsAr: input.arrivalInstructionsAr?.trim() || null,
        }),
        ...(input.arrivalInstructionsEn !== undefined && {
          arrivalInstructionsEn: input.arrivalInstructionsEn?.trim() || null,
        }),
        ...(input.basePrice !== undefined && { basePrice: input.basePrice }),
        ...(input.capacity !== undefined && { capacity: input.capacity }),
        ...(input.allowsOvernight !== undefined && { allowsOvernight: input.allowsOvernight }),
        ...(input.allowsFamilies !== undefined && { allowsFamilies: input.allowsFamilies }),
        ...(input.allowsYouth !== undefined && { allowsYouth: input.allowsYouth }),
        ...(input.instantBookingEnabled !== undefined && {
          instantBookingEnabled: input.instantBookingEnabled,
        }),
        ...(input.poolsCount !== undefined && { poolsCount }),
        hasIndoorPool: amenityKeys.includes('indoor_pool'),
        hasHeatedPool: amenityKeys.includes('heated_pool'),
        hasFootballField: amenityKeys.includes('football'),
      },
    });

    if (input.imageUrls !== undefined) {
      // Soft-remove existing live media (retain for Booking listing snapshots)
      await tx.propertyMedia.updateMany({
        where: { propertyId, removedFromListingAt: null },
        data: { removedFromListingAt: new Date() },
      });
      if (input.imageUrls.length) {
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

  if (locationChanged) {
    try {
      const { onPropertyRegulatoryReassessmentTrigger } = await import(
        './property-regulatory.service.js'
      );
      await onPropertyRegulatoryReassessmentTrigger(
        propertyId,
        userId,
        'property_location_changed',
        req,
      );
    } catch (err) {
      console.error('[3c4d4a] regulatory reassessment on location change', err);
    }
  }

  // Phase 3C.4D.5 — sync swimming_pool activity from poolsCount / pool amenities
  if (input.poolsCount !== undefined || input.amenityKeys !== undefined) {
    try {
      const { syncSwimmingPoolActivityFromListingSignals } = await import(
        './property-pool-safety.service.js'
      );
      await syncSwimmingPoolActivityFromListingSignals(propertyId, userId, req);
    } catch (err) {
      console.error('[3c4d5] pool activity sync on property update', err);
    }
  }

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

  assertMediaForSubmitReview(existing.media);
  assertPropertyListingComplete(existing);

  await assertOwnerListingSoftGate(userId);

  // Phase 3C.4D.3 — authority package required to submit; approval not required yet
  await assertAuthorityPackageCompleteForSubmit(propertyId, scope.ownerProfileId!);

  // Phase 3C.4D.5 — pool safety profile + attestation when offering swimming pool
  const { assertPoolSafetyCompleteForSubmit, syncSwimmingPoolActivityFromListingSignals } =
    await import('./property-pool-safety.service.js');
  await syncSwimmingPoolActivityFromListingSignals(propertyId, userId, req);
  await assertPoolSafetyCompleteForSubmit(propertyId);

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      status: PropertyStatus.pending_review,
      reviewChangeReason: null,
      reviewChangeRequestedAt: null,
    },
  });

  await markAuthorityUnderReviewOnPropertySubmit(propertyId, userId, req);

  await createAuditLog({
    actorUserId: userId,
    action: 'owner.property_submitted_for_review',
    entityType: 'property',
    entityId: propertyId,
    metadata: { previousStatus: existing.status },
    req,
  });

  void notifyPropertySubmittedForReview({
    propertyId,
    titleAr: existing.titleAr,
  }).catch((err) => console.error('[notifications] owner.property_submitted_for_review', err));

  const updated = await loadPropertyForEdit(propertyId, scope.ownerProfileId!);
  return mapPropertyEdit(updated);
}
