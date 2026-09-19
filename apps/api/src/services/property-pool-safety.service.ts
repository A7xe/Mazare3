/**
 * Phase 3C.4D.5 — Pool & Property safety profile, attestation, consistency.
 * Does NOT auto-verify regulatory compliance or imply MoH licence.
 * Reuses POOL_REGULATORY_ASSESSMENT via swimming_pool activity + existing readiness gate.
 */
import {
  prisma,
  PoolWaterFeatureKind,
  PoolSeasonality,
  PropertySafetyDisclosureCategory,
  type Prisma,
} from '@mazare3/db';
import {
  amenityKeysIndicateSwimmingPool,
  isPoolSafetyProfileCompleteForSubmit,
  POOL_SAFETY_ATTESTATION_KEY,
  POOL_SAFETY_ATTESTATION_CORPUS_VERSION,
  SWIMMING_POOL_AMENITY_KEYS,
  type PutPoolSafetyProfileInput,
  type PutSafetyDisclosureInput,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { resolveOwnerScope } from './owner-access.js';

export type PoolConsistencyCategory =
  | 'ok'
  | 'pools_count_without_activity'
  | 'activity_without_pools_count'
  | 'amenity_without_activity'
  | 'activity_without_swimming_feature_kind'
  | 'profile_incomplete'
  | 'attestation_missing';

function decimalToNumber(v: { toNumber(): number } | number | null | undefined): number | null {
  if (v == null) return null;
  return typeof v === 'number' ? v : v.toNumber();
}

async function loadOwnedProperty(propertyId: string, ownerProfileId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, ownerId: ownerProfileId },
    include: {
      amenities: { include: { amenity: { select: { key: true } } } },
      activities: { where: { active: true } },
      poolSafetyProfile: true,
    },
  });
  if (!property) throw new AppError(404, 'NOT_FOUND', 'Property not found');
  return property;
}

export function detectPoolConsistency(input: {
  poolsCount: number;
  amenityKeys: string[];
  hasSwimmingPoolActivity: boolean;
  waterFeatureKind: string | null;
  profileComplete: boolean;
  attested: boolean;
}): PoolConsistencyCategory[] {
  const issues: PoolConsistencyCategory[] = [];
  const swimAmenity = amenityKeysIndicateSwimmingPool(input.amenityKeys);
  const offersPool =
    input.poolsCount > 0 || swimAmenity || input.hasSwimmingPoolActivity;

  if (input.poolsCount > 0 && !input.hasSwimmingPoolActivity) {
    issues.push('pools_count_without_activity');
  }
  if (input.hasSwimmingPoolActivity && input.poolsCount <= 0) {
    issues.push('activity_without_pools_count');
  }
  if (swimAmenity && !input.hasSwimmingPoolActivity) {
    issues.push('amenity_without_activity');
  }
  if (
    input.hasSwimmingPoolActivity &&
    input.waterFeatureKind &&
    input.waterFeatureKind !== 'swimming_pool'
  ) {
    issues.push('activity_without_swimming_feature_kind');
  }
  if (offersPool && input.hasSwimmingPoolActivity && !input.profileComplete) {
    issues.push('profile_incomplete');
  }
  if (offersPool && input.hasSwimmingPoolActivity && !input.attested) {
    issues.push('attestation_missing');
  }
  return issues.length ? issues : ['ok'];
}

/**
 * Sync swimming_pool activity from poolsCount / swim amenities.
 * Does not fabricate attestations or mark N/A.
 */
export async function syncSwimmingPoolActivityFromListingSignals(
  propertyId: string,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  const property = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
    include: {
      amenities: { include: { amenity: { select: { key: true } } } },
      activities: true,
      poolSafetyProfile: true,
    },
  });

  const amenityKeys = property.amenities.map((a) => a.amenity.key);
  const shouldHaveSwim =
    property.poolsCount > 0 || amenityKeysIndicateSwimmingPool(amenityKeys);
  const existing = property.activities.find((a) => a.activityCode === 'swimming_pool');

  let material = false;
  if (shouldHaveSwim) {
    if (!existing) {
      await prisma.propertyActivity.create({
        data: {
          propertyId,
          activityCode: 'swimming_pool',
          active: true,
        },
      });
      material = true;
    } else if (!existing.active) {
      await prisma.propertyActivity.update({
        where: { id: existing.id },
        data: { active: true },
      });
      material = true;
    }
    if (property.poolsCount <= 0) {
      await prisma.property.update({
        where: { id: propertyId },
        data: { poolsCount: 1 },
      });
    }
  }
  // Do NOT auto-deactivate swimming_pool when signals clear — Owner must change activities;
  // removal must not self-mark regulatory N/A (handled by Owner activity PUT + admin review).

  if (material) {
    const { ensureRegulatoryAssessmentsForProperty, onPropertyRegulatoryReassessmentTrigger } =
      await import('./property-regulatory.service.js');
    await ensureRegulatoryAssessmentsForProperty(propertyId, actorUserId, req);
    await onPropertyRegulatoryReassessmentTrigger(
      propertyId,
      actorUserId,
      'pool_listing_signals_changed',
      req,
    );
  }

  return { synced: material, shouldHaveSwim };
}

export async function getPoolSafetyPackage(
  userId: string,
  role: import('@mazare3/shared').UserRole,
  propertyId: string,
) {
  const scope = await resolveOwnerScope(userId, role);
  if (scope.isAdmin || !scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Owners only');
  }
  const property = await loadOwnedProperty(propertyId, scope.ownerProfileId);
  return buildPoolSafetyPackageView(property);
}

function buildPoolSafetyPackageView(property: {
  id: string;
  poolsCount: number;
  hasIndoorPool: boolean;
  hasHeatedPool: boolean;
  poolSafetyAttestedAt: Date | null;
  poolSafetyAttestationVersion: string | null;
  amenities: Array<{ amenity: { key: string } }>;
  activities: Array<{ activityCode: string; active: boolean }>;
  poolSafetyProfile: {
    id: string;
    waterFeatureKind: PoolWaterFeatureKind;
    isIndoor: boolean | null;
    isOutdoor: boolean | null;
    minDepthMeters: { toNumber(): number } | null;
    maxDepthMeters: { toNumber(): number } | null;
    childrenAllowed: boolean | null;
    childrenRequireAdultSupervision: boolean | null;
    seasonality: PoolSeasonality;
    accessRestrictionsAr: string | null;
    accessRestrictionsEn: string | null;
    otherWarningsAr: string | null;
    otherWarningsEn: string | null;
    profileComplete: boolean;
  } | null;
}) {
  const amenityKeys = property.amenities.map((a) => a.amenity.key);
  const hasSwimActivity = property.activities.some(
    (a) => a.activityCode === 'swimming_pool' && a.active,
  );
  const profile = property.poolSafetyProfile;
  const consistency = detectPoolConsistency({
    poolsCount: property.poolsCount,
    amenityKeys,
    hasSwimmingPoolActivity: hasSwimActivity,
    waterFeatureKind: profile?.waterFeatureKind ?? null,
    profileComplete: profile?.profileComplete ?? false,
    attested: Boolean(property.poolSafetyAttestedAt),
  });

  return {
    propertyId: property.id,
    poolsCount: property.poolsCount,
    hasIndoorPool: property.hasIndoorPool,
    hasHeatedPool: property.hasHeatedPool,
    amenityKeys: amenityKeys.filter((k) =>
      [...SWIMMING_POOL_AMENITY_KEYS, 'kids_pool'].includes(k as (typeof SWIMMING_POOL_AMENITY_KEYS)[number] | 'kids_pool'),
    ),
    hasSwimmingPoolActivity: hasSwimActivity,
    offersSwimmingPool: hasSwimActivity || property.poolsCount > 0 || amenityKeysIndicateSwimmingPool(amenityKeys),
    consistency,
    attestation: {
      key: POOL_SAFETY_ATTESTATION_KEY,
      corpusVersion: POOL_SAFETY_ATTESTATION_CORPUS_VERSION,
      attestedAt: property.poolSafetyAttestedAt?.toISOString() ?? null,
      attestedVersion: property.poolSafetyAttestationVersion,
      currentVersionAccepted:
        property.poolSafetyAttestationVersion === POOL_SAFETY_ATTESTATION_CORPUS_VERSION &&
        Boolean(property.poolSafetyAttestedAt),
    },
    profile: profile
      ? {
          id: profile.id,
          waterFeatureKind: profile.waterFeatureKind,
          isIndoor: profile.isIndoor,
          isOutdoor: profile.isOutdoor,
          minDepthMeters: decimalToNumber(profile.minDepthMeters),
          maxDepthMeters: decimalToNumber(profile.maxDepthMeters),
          childrenAllowed: profile.childrenAllowed,
          childrenRequireAdultSupervision: profile.childrenRequireAdultSupervision,
          seasonality: profile.seasonality,
          accessRestrictionsAr: profile.accessRestrictionsAr,
          accessRestrictionsEn: profile.accessRestrictionsEn,
          otherWarningsAr: profile.otherWarningsAr,
          otherWarningsEn: profile.otherWarningsEn,
          profileComplete: profile.profileComplete,
          depthSource: 'owner_provided' as const,
        }
      : null,
    /** Explicit: form completion ≠ regulatory verification */
    doesNotGrantRegulatoryVerified: true,
    doesNotGrantPlatformVerified: true,
  };
}

export async function putPoolSafetyProfile(
  userId: string,
  role: import('@mazare3/shared').UserRole,
  propertyId: string,
  input: PutPoolSafetyProfileInput,
  req?: AuthenticatedRequest,
) {
  const scope = await resolveOwnerScope(userId, role);
  if (scope.isAdmin || !scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Owners only');
  }
  const property = await loadOwnedProperty(propertyId, scope.ownerProfileId);
  const prev = property.poolSafetyProfile;

  const waterFeatureKind =
    (input.waterFeatureKind as PoolWaterFeatureKind | undefined) ??
    prev?.waterFeatureKind ??
    PoolWaterFeatureKind.swimming_pool;

  const next = {
    waterFeatureKind,
    isIndoor: input.isIndoor !== undefined ? input.isIndoor : prev?.isIndoor ?? null,
    isOutdoor: input.isOutdoor !== undefined ? input.isOutdoor : prev?.isOutdoor ?? null,
    minDepthMeters:
      input.minDepthMeters !== undefined
        ? input.minDepthMeters
        : decimalToNumber(prev?.minDepthMeters ?? null),
    maxDepthMeters:
      input.maxDepthMeters !== undefined
        ? input.maxDepthMeters
        : decimalToNumber(prev?.maxDepthMeters ?? null),
    childrenAllowed:
      input.childrenAllowed !== undefined ? input.childrenAllowed : prev?.childrenAllowed ?? null,
    childrenRequireAdultSupervision:
      input.childrenRequireAdultSupervision !== undefined
        ? input.childrenRequireAdultSupervision
        : prev?.childrenRequireAdultSupervision ?? null,
    seasonality:
      (input.seasonality as PoolSeasonality | undefined) ??
      prev?.seasonality ??
      PoolSeasonality.unknown,
    accessRestrictionsAr:
      input.accessRestrictionsAr !== undefined
        ? input.accessRestrictionsAr
        : prev?.accessRestrictionsAr ?? null,
    accessRestrictionsEn:
      input.accessRestrictionsEn !== undefined
        ? input.accessRestrictionsEn
        : prev?.accessRestrictionsEn ?? null,
    otherWarningsAr:
      input.otherWarningsAr !== undefined ? input.otherWarningsAr : prev?.otherWarningsAr ?? null,
    otherWarningsEn:
      input.otherWarningsEn !== undefined ? input.otherWarningsEn : prev?.otherWarningsEn ?? null,
  };

  const profileComplete = isPoolSafetyProfileCompleteForSubmit({
    waterFeatureKind: next.waterFeatureKind,
    childrenRequireAdultSupervision: next.childrenRequireAdultSupervision,
    seasonality: next.seasonality,
  });

  const data: Prisma.PropertyPoolSafetyProfileUncheckedCreateInput = {
    propertyId,
    waterFeatureKind: next.waterFeatureKind,
    isIndoor: next.isIndoor,
    isOutdoor: next.isOutdoor,
    minDepthMeters: next.minDepthMeters,
    maxDepthMeters: next.maxDepthMeters,
    childrenAllowed: next.childrenAllowed,
    childrenRequireAdultSupervision: next.childrenRequireAdultSupervision,
    seasonality: next.seasonality,
    accessRestrictionsAr: next.accessRestrictionsAr,
    accessRestrictionsEn: next.accessRestrictionsEn,
    otherWarningsAr: next.otherWarningsAr,
    otherWarningsEn: next.otherWarningsEn,
    profileComplete,
  };

  await prisma.propertyPoolSafetyProfile.upsert({
    where: { propertyId },
    create: data,
    update: {
      waterFeatureKind: data.waterFeatureKind,
      isIndoor: data.isIndoor,
      isOutdoor: data.isOutdoor,
      minDepthMeters: data.minDepthMeters,
      maxDepthMeters: data.maxDepthMeters,
      childrenAllowed: data.childrenAllowed,
      childrenRequireAdultSupervision: data.childrenRequireAdultSupervision,
      seasonality: data.seasonality,
      accessRestrictionsAr: data.accessRestrictionsAr,
      accessRestrictionsEn: data.accessRestrictionsEn,
      otherWarningsAr: data.otherWarningsAr,
      otherWarningsEn: data.otherWarningsEn,
      profileComplete: data.profileComplete,
    },
  });

  // Material safety fact change → clear attestation + regulatory reassessment when swim activity
  const material =
    prev &&
    (prev.waterFeatureKind !== next.waterFeatureKind ||
      decimalToNumber(prev.minDepthMeters) !== next.minDepthMeters ||
      decimalToNumber(prev.maxDepthMeters) !== next.maxDepthMeters ||
      prev.childrenRequireAdultSupervision !== next.childrenRequireAdultSupervision ||
      (prev.accessRestrictionsAr ?? '') !== (next.accessRestrictionsAr ?? '') ||
      (prev.otherWarningsAr ?? '') !== (next.otherWarningsAr ?? ''));

  if (material || !prev) {
    await prisma.property.update({
      where: { id: propertyId },
      data: {
        poolSafetyAttestedAt: null,
        poolSafetyAttestationVersion: null,
        poolSafetyAttestedByUserId: null,
      },
    });
  }

  if (material && property.activities.some((a) => a.activityCode === 'swimming_pool' && a.active)) {
    const { onPropertyRegulatoryReassessmentTrigger } = await import(
      './property-regulatory.service.js'
    );
    await onPropertyRegulatoryReassessmentTrigger(
      propertyId,
      userId,
      'pool_safety_facts_changed',
      req,
    );
  }

  await createAuditLog({
    actorUserId: userId,
    action: 'owner.pool_safety_profile_updated',
    entityType: 'property',
    entityId: propertyId,
    metadata: { waterFeatureKind: next.waterFeatureKind, profileComplete, material },
    req,
  });

  if (next.waterFeatureKind === PoolWaterFeatureKind.swimming_pool) {
    await syncSwimmingPoolActivityFromListingSignals(propertyId, userId, req);
  }

  return getPoolSafetyPackage(userId, role, propertyId);
}

export async function recordPoolSafetyAttestation(
  userId: string,
  role: import('@mazare3/shared').UserRole,
  propertyId: string,
  sourceSurface: string | undefined,
  req?: AuthenticatedRequest,
) {
  const scope = await resolveOwnerScope(userId, role);
  if (scope.isAdmin || !scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Owners only');
  }
  await loadOwnedProperty(propertyId, scope.ownerProfileId);

  await prisma.ownerAttestation.create({
    data: {
      userId,
      ownerProfileId: scope.ownerProfileId,
      propertyId,
      attestationKey: POOL_SAFETY_ATTESTATION_KEY,
      attestationCorpusVersion: POOL_SAFETY_ATTESTATION_CORPUS_VERSION,
      sourceSurface: sourceSurface ?? 'owner.pool_safety',
    },
  });

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      poolSafetyAttestedAt: new Date(),
      poolSafetyAttestationVersion: POOL_SAFETY_ATTESTATION_CORPUS_VERSION,
      poolSafetyAttestedByUserId: userId,
    },
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'owner.pool_safety_attested',
    entityType: 'property',
    entityId: propertyId,
    metadata: {
      attestationKey: POOL_SAFETY_ATTESTATION_KEY,
      attestationCorpusVersion: POOL_SAFETY_ATTESTATION_CORPUS_VERSION,
    },
    req,
  });

  return getPoolSafetyPackage(userId, role, propertyId);
}

/** Submit-for-review gate when Property offers a swimming pool. */
export async function assertPoolSafetyCompleteForSubmit(propertyId: string) {
  const property = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
    include: {
      amenities: { include: { amenity: { select: { key: true } } } },
      activities: { where: { active: true } },
      poolSafetyProfile: true,
    },
  });

  const amenityKeys = property.amenities.map((a) => a.amenity.key);
  const hasSwim = property.activities.some((a) => a.activityCode === 'swimming_pool');
  const offers =
    hasSwim ||
    property.poolsCount > 0 ||
    amenityKeysIndicateSwimmingPool(amenityKeys);

  if (!offers) return;

  // Ensure activity exists for assessment seeding before require profile
  if (!hasSwim && (property.poolsCount > 0 || amenityKeysIndicateSwimmingPool(amenityKeys))) {
    throw new AppError(
      400,
      'POOL_ACTIVITY_INCONSISTENT',
      'Swimming pool listing signals require swimming_pool activity before submit',
      { missing: ['swimming_pool_activity'] },
    );
  }

  const profile = property.poolSafetyProfile;
  if (
    !profile ||
    !isPoolSafetyProfileCompleteForSubmit({
      waterFeatureKind: profile.waterFeatureKind,
      childrenRequireAdultSupervision: profile.childrenRequireAdultSupervision,
      seasonality: profile.seasonality,
    })
  ) {
    throw new AppError(
      400,
      'POOL_SAFETY_PROFILE_INCOMPLETE',
      'Complete the pool safety profile before submitting for review',
      { missing: ['pool_safety_profile'] },
    );
  }

  if (
    !property.poolSafetyAttestedAt ||
    property.poolSafetyAttestationVersion !== POOL_SAFETY_ATTESTATION_CORPUS_VERSION
  ) {
    throw new AppError(
      400,
      'POOL_SAFETY_ATTESTATION_REQUIRED',
      'Pool safety attestation is required before submitting for review',
      { missing: ['pool_safety_attestation'] },
    );
  }
}

export async function listSafetyDisclosures(propertyId: string) {
  const rows = await prisma.propertySafetyDisclosure.findMany({
    where: { propertyId, active: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    descriptionAr: r.descriptionAr,
    descriptionEn: r.descriptionEn,
  }));
}

export async function upsertSafetyDisclosure(
  userId: string,
  role: import('@mazare3/shared').UserRole,
  propertyId: string,
  input: PutSafetyDisclosureInput,
  disclosureId?: string,
  req?: AuthenticatedRequest,
) {
  const scope = await resolveOwnerScope(userId, role);
  if (scope.isAdmin || !scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Owners only');
  }
  await loadOwnedProperty(propertyId, scope.ownerProfileId);

  if (disclosureId) {
    const existing = await prisma.propertySafetyDisclosure.findFirst({
      where: { id: disclosureId, propertyId },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Disclosure not found');
    await prisma.propertySafetyDisclosure.update({
      where: { id: disclosureId },
      data: {
        category: input.category as PropertySafetyDisclosureCategory,
        descriptionAr: input.descriptionAr.trim(),
        descriptionEn: input.descriptionEn?.trim() || null,
        active: input.active ?? true,
      },
    });
  } else {
    await prisma.propertySafetyDisclosure.create({
      data: {
        propertyId,
        category: input.category as PropertySafetyDisclosureCategory,
        descriptionAr: input.descriptionAr.trim(),
        descriptionEn: input.descriptionEn?.trim() || null,
        active: input.active ?? true,
      },
    });
  }

  await createAuditLog({
    actorUserId: userId,
    action: 'owner.safety_disclosure_upserted',
    entityType: 'property',
    entityId: propertyId,
    metadata: { category: input.category },
    req,
  });

  return listSafetyDisclosures(propertyId);
}

/** Public Customer-safe disclosure only — no regulatory docs / admin notes. */
export async function getPublicPoolSafetyDisclosure(propertyId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      poolsCount: true,
      hasIndoorPool: true,
      hasHeatedPool: true,
      poolSafetyProfile: true,
      safetyDisclosures: { where: { active: true } },
      activities: { where: { active: true, activityCode: 'swimming_pool' } },
    },
  });
  if (!property) return null;

  const hasPool =
    property.poolsCount > 0 ||
    property.activities.length > 0 ||
    property.hasIndoorPool ||
    property.hasHeatedPool;

  if (!hasPool && !property.poolSafetyProfile && property.safetyDisclosures.length === 0) {
    return null;
  }

  const p = property.poolSafetyProfile;
  return {
    poolAvailable: hasPool,
    poolsCount: property.poolsCount,
    hasIndoorPool: property.hasIndoorPool,
    hasHeatedPool: property.hasHeatedPool,
    depthSource: 'owner_provided' as const,
    minDepthMeters: decimalToNumber(p?.minDepthMeters ?? null),
    maxDepthMeters: decimalToNumber(p?.maxDepthMeters ?? null),
    childrenAllowed: p?.childrenAllowed ?? null,
    childrenRequireAdultSupervision: p?.childrenRequireAdultSupervision ?? null,
    seasonality: p?.seasonality ?? null,
    accessRestrictionsAr: p?.accessRestrictionsAr ?? null,
    accessRestrictionsEn: p?.accessRestrictionsEn ?? null,
    otherWarningsAr: p?.otherWarningsAr ?? null,
    otherWarningsEn: p?.otherWarningsEn ?? null,
    safetyDisclosures: property.safetyDisclosures.map((d) => ({
      category: d.category,
      descriptionAr: d.descriptionAr,
      descriptionEn: d.descriptionEn,
    })),
    /** Never claim certified/government-approved safety */
    disclaimerKey: 'owner_provided_pool_information',
  };
}

export async function adminGetPoolSafety(propertyId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      amenities: { include: { amenity: { select: { key: true } } } },
      activities: { where: { active: true } },
      poolSafetyProfile: true,
      safetyDisclosures: { where: { active: true } },
      regulatoryRequirements: {
        where: { requirementType: 'pool_regulatory_assessment' },
        include: { evidence: { where: { superseded: false } } },
      },
    },
  });
  if (!property) throw new AppError(404, 'NOT_FOUND', 'Property not found');

  const view = buildPoolSafetyPackageView(property);
  const req = property.regulatoryRequirements[0];
  return {
    ...view,
    safetyDisclosures: property.safetyDisclosures.map((d) => ({
      id: d.id,
      category: d.category,
      descriptionAr: d.descriptionAr,
      descriptionEn: d.descriptionEn,
    })),
    poolRegulatoryRequirement: req
      ? {
          id: req.id,
          applicability: req.applicability,
          complianceStatus: req.complianceStatus,
          reassessmentRequired: req.reassessmentRequired,
          reviewReason: req.reviewReason,
          evidenceCount: req.evidence.length,
        }
      : null,
    layers: {
      poolSafetyDisclosure: view.profile?.profileComplete ? 'complete' : 'incomplete',
      poolRegulatory: req?.complianceStatus ?? 'not_seeded',
      platformVerification: property.verificationStatus,
    },
  };
}

/** Read-only pool/safety preflight — no mutations, no private evidence content. */
export async function runPoolSafetyPreflightReport() {
  const properties = await prisma.property.findMany({
    select: {
      id: true,
      slug: true,
      status: true,
      poolsCount: true,
      poolSafetyAttestedAt: true,
      verificationStatus: true,
      amenities: { include: { amenity: { select: { key: true } } } },
      activities: { where: { active: true } },
      poolSafetyProfile: true,
      regulatoryRequirements: {
        where: { requirementType: 'pool_regulatory_assessment' },
        include: {
          evidence: { where: { superseded: false }, select: { expiresAt: true } },
        },
      },
    },
  });

  let declaringPools = 0;
  let publishedPool = 0;
  let mismatches = 0;
  let missingAttestation = 0;
  let unresolvedAssessment = 0;
  let verifiedAssessment = 0;
  let confirmationRequired = 0;
  let expiredEvidence = 0;
  let bookablePool = 0;
  const mismatchSamples: Array<{ id: string; slug: string; categories: string[] }> = [];

  const { evaluatePropertyBookability } = await import('./property-bookability.service.js');
  const now = new Date();

  for (const p of properties) {
    const amenityKeys = p.amenities.map((a) => a.amenity.key);
    const hasSwim = p.activities.some((a) => a.activityCode === 'swimming_pool');
    const offers =
      p.poolsCount > 0 || hasSwim || amenityKeysIndicateSwimmingPool(amenityKeys);
    if (!offers) continue;
    declaringPools += 1;
    if (p.status === 'published') publishedPool += 1;

    const consistency = detectPoolConsistency({
      poolsCount: p.poolsCount,
      amenityKeys,
      hasSwimmingPoolActivity: hasSwim,
      waterFeatureKind: p.poolSafetyProfile?.waterFeatureKind ?? null,
      profileComplete: p.poolSafetyProfile?.profileComplete ?? false,
      attested: Boolean(p.poolSafetyAttestedAt),
    });
    if (!consistency.includes('ok')) {
      mismatches += 1;
      if (mismatchSamples.length < 25) {
        mismatchSamples.push({ id: p.id, slug: p.slug, categories: consistency });
      }
    }
    if (consistency.includes('attestation_missing')) missingAttestation += 1;

    const req = p.regulatoryRequirements[0];
    if (!req || req.applicability === 'unassessed') unresolvedAssessment += 1;
    else if (req.applicability === 'regulatory_confirmation_required') confirmationRequired += 1;
    else if (
      req.applicability === 'applicable' &&
      req.complianceStatus === 'verified'
    ) {
      verifiedAssessment += 1;
    } else if (req.applicability !== 'not_applicable_confirmed') {
      unresolvedAssessment += 1;
    }

    if (
      req?.evidence.some((e) => e.expiresAt && e.expiresAt.getTime() <= now.getTime())
    ) {
      expiredEvidence += 1;
    }

    if (p.status === 'published') {
      const book = await evaluatePropertyBookability(p.id, 'new_booking');
      if (book.canBook) bookablePool += 1;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    mutation: false,
    note: 'Read-only pool/safety preflight. No private evidence content. Local/dev.',
    counts: {
      totalPropertiesDeclaringPools: declaringPools,
      publishedPoolProperties: publishedPool,
      poolActivityProfileMismatches: mismatches,
      missingOwnerPoolAttestation: missingAttestation,
      unresolvedPoolRegulatoryAssessments: unresolvedAssessment,
      verifiedPoolRegulatoryAssessments: verifiedAssessment,
      confirmationRequiredAssessments: confirmationRequired,
      expiredPoolEvidence: expiredEvidence,
      currentlyBookablePoolProperties: bookablePool,
    },
    samples: { mismatches: mismatchSamples },
  };
}
