/**
 * Phase 3C.4D.4A — Property activity profile + regulatory requirements/evidence + readiness.
 * Does NOT gate paid Booking or publication (3C.4D.4B).
 * Owner cannot set verified / not_applicable_confirmed.
 */
import {
  prisma,
  RegulatoryApplicability,
  RegulatoryComplianceStatus,
  type PropertyActivityCode,
  type RegulatoryRequirementType,
} from '@mazare3/db';
import {
  requirementTypesSuggestedByActivities,
  isRequirementSatisfiedForReadiness,
  REGULATORY_DOCUMENT_EXPIRY_WARNING_DAYS_DEFAULT,
  type PutPropertyActivitiesInput,
  type AdminRegulatoryDecisionInput,
  PROPERTY_ACTIVITY_CODES,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { resolveOwnerScope } from './owner-access.js';
import {
  writePartnerDocumentFile,
  readPartnerDocumentFile,
} from './partner-documents/private-storage.js';
import { assertPriorConsentActive } from './legal/data-processing-consent.service.js';
import { REGULATORY_DOCUMENT_EXPIRY_WARNING_DAYS } from '../config/regulatory-config.js';

export type PropertyRegulatoryReadinessState =
  | 'not_started'
  | 'incomplete'
  | 'under_review'
  | 'action_required'
  | 'ready'
  | 'expired_or_blocked';

function mapActivity(row: {
  id: string;
  activityCode: PropertyActivityCode;
  otherDescription: string | null;
  active: boolean;
}) {
  return {
    id: row.id,
    activityCode: row.activityCode,
    otherDescription: row.otherDescription,
    active: row.active,
  };
}

async function loadOwnedProperty(propertyId: string, ownerProfileId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, ownerId: ownerProfileId },
  });
  if (!property) throw new AppError(404, 'NOT_FOUND', 'Property not found');
  return property;
}

async function recordRegulatoryDecision(params: {
  requirementId: string;
  propertyId: string;
  previousApplicability: RegulatoryApplicability;
  newApplicability: RegulatoryApplicability;
  previousComplianceStatus: RegulatoryComplianceStatus;
  newComplianceStatus: RegulatoryComplianceStatus;
  actorUserId: string;
  reasonCategory?: string | null;
  reasonText?: string | null;
  evidenceIds?: string[];
  req?: AuthenticatedRequest;
}) {
  await prisma.regulatoryDecisionEvent.create({
    data: {
      requirementId: params.requirementId,
      propertyId: params.propertyId,
      previousApplicability: params.previousApplicability,
      newApplicability: params.newApplicability,
      previousComplianceStatus: params.previousComplianceStatus,
      newComplianceStatus: params.newComplianceStatus,
      actorUserId: params.actorUserId,
      reasonCategory: params.reasonCategory ?? null,
      reasonText: params.reasonText ?? null,
      evidenceIds: params.evidenceIds ?? undefined,
    },
  });
  await createAuditLog({
    actorUserId: params.actorUserId,
    action: 'property.regulatory_decision',
    entityType: 'property_regulatory_requirement',
    entityId: params.requirementId,
    metadata: {
      propertyId: params.propertyId,
      previousApplicability: params.previousApplicability,
      newApplicability: params.newApplicability,
      previousComplianceStatus: params.previousComplianceStatus,
      newComplianceStatus: params.newComplianceStatus,
      reasonCategory: params.reasonCategory ?? null,
    },
    req: params.req,
  });
}

/** Ensure assessment rows exist for activity-driven types — never auto-applicable/verified. */
export async function ensureRegulatoryAssessmentsForProperty(
  propertyId: string,
  actorUserId?: string,
  req?: AuthenticatedRequest,
) {
  const activities = await prisma.propertyActivity.findMany({
    where: { propertyId, active: true },
  });
  const codes = activities.map((a) => a.activityCode) as (typeof PROPERTY_ACTIVITY_CODES)[number][];
  const types = requirementTypesSuggestedByActivities(codes);

  for (const requirementType of types) {
    const existing = await prisma.propertyRegulatoryRequirement.findUnique({
      where: { propertyId_requirementType: { propertyId, requirementType } },
    });
    if (existing) continue;
    const created = await prisma.propertyRegulatoryRequirement.create({
      data: {
        propertyId,
        requirementType,
        applicability: RegulatoryApplicability.unassessed,
        complianceStatus: RegulatoryComplianceStatus.not_assessed,
      },
    });
    if (actorUserId) {
      await recordRegulatoryDecision({
        requirementId: created.id,
        propertyId,
        previousApplicability: RegulatoryApplicability.unassessed,
        newApplicability: RegulatoryApplicability.unassessed,
        previousComplianceStatus: RegulatoryComplianceStatus.not_assessed,
        newComplianceStatus: RegulatoryComplianceStatus.not_assessed,
        actorUserId,
        reasonCategory: 'assessment_seeded',
        reasonText: `Assessment created for ${requirementType} (not a licence conclusion)`,
        req,
      });
    }
  }
}

export async function putPropertyActivities(
  userId: string,
  role: import('@mazare3/shared').UserRole,
  propertyId: string,
  input: PutPropertyActivitiesInput,
  req?: AuthenticatedRequest,
) {
  const scope = await resolveOwnerScope(userId, role);
  if (scope.isAdmin || !scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Owners only');
  }
  await loadOwnedProperty(propertyId, scope.ownerProfileId);

  const prev = await prisma.propertyActivity.findMany({
    where: { propertyId, active: true },
  });
  const prevCodes = new Set(prev.map((p) => p.activityCode));

  await prisma.$transaction(async (tx) => {
    await tx.propertyActivity.updateMany({
      where: { propertyId },
      data: { active: false },
    });
    for (const a of input.activities) {
      if (a.activityCode === 'other' && a.active !== false && !a.otherDescription?.trim()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'otherDescription required for activity other');
      }
      await tx.propertyActivity.upsert({
        where: {
          propertyId_activityCode: { propertyId, activityCode: a.activityCode },
        },
        create: {
          propertyId,
          activityCode: a.activityCode,
          otherDescription:
            a.activityCode === 'other' ? a.otherDescription?.trim() || null : null,
          active: a.active ?? true,
        },
        update: {
          otherDescription:
            a.activityCode === 'other' ? a.otherDescription?.trim() || null : null,
          active: a.active ?? true,
        },
      });
    }
  });

  const next = await prisma.propertyActivity.findMany({
    where: { propertyId, active: true },
  });
  const nextCodes = new Set(next.map((n) => n.activityCode));
  const material =
    [...nextCodes].some((c) => !prevCodes.has(c)) ||
    [...prevCodes].some((c) => !nextCodes.has(c));

  await ensureRegulatoryAssessmentsForProperty(propertyId, userId, req);

  if (material) {
    await markRegulatoryReassessmentRequired(propertyId, userId, 'activity_profile_changed', req);
  }

  // Mirror overnight/events flags when activities change (non-destructive)
  const hasOvernight = nextCodes.has('overnight_accommodation');
  const hasEvents = nextCodes.has('events');
  const hasPool = nextCodes.has('swimming_pool');
  const current = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
    select: { poolsCount: true },
  });
  await prisma.property.update({
    where: { id: propertyId },
    data: {
      allowsOvernight: hasOvernight,
      allowsEvents: hasEvents,
      poolsCount: hasPool ? Math.max(current.poolsCount, 1) : current.poolsCount,
    },
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'owner.property_activities_updated',
    entityType: 'property',
    entityId: propertyId,
    metadata: { activities: [...nextCodes], reassessment: material },
    req,
  });

  return getPropertyRegulatoryPackage(userId, role, propertyId);
}

export async function markRegulatoryReassessmentRequired(
  propertyId: string,
  actorUserId: string,
  reasonCategory: string,
  req?: AuthenticatedRequest,
) {
  const rows = await prisma.propertyRegulatoryRequirement.findMany({
    where: { propertyId },
  });
  for (const row of rows) {
    if (
      row.applicability === RegulatoryApplicability.not_applicable_confirmed ||
      row.complianceStatus === RegulatoryComplianceStatus.verified
    ) {
      const prevApp = row.applicability;
      const prevStatus = row.complianceStatus;
      await prisma.propertyRegulatoryRequirement.update({
        where: { id: row.id },
        data: {
          reassessmentRequired: true,
          complianceStatus:
            prevStatus === RegulatoryComplianceStatus.verified
              ? RegulatoryComplianceStatus.under_review
              : prevStatus,
          applicability:
            prevApp === RegulatoryApplicability.not_applicable_confirmed
              ? RegulatoryApplicability.unassessed
              : prevApp,
          verifiedAt: null,
        },
      });
      await recordRegulatoryDecision({
        requirementId: row.id,
        propertyId,
        previousApplicability: prevApp,
        newApplicability:
          prevApp === RegulatoryApplicability.not_applicable_confirmed
            ? RegulatoryApplicability.unassessed
            : prevApp,
        previousComplianceStatus: prevStatus,
        newComplianceStatus:
          prevStatus === RegulatoryComplianceStatus.verified
            ? RegulatoryComplianceStatus.under_review
            : prevStatus,
        actorUserId,
        reasonCategory,
        reasonText: 'Material change requires regulatory reassessment',
        req,
      });
    } else {
      await prisma.propertyRegulatoryRequirement.update({
        where: { id: row.id },
        data: { reassessmentRequired: true },
      });
    }
  }
}

/** Hook for location / operator / authority material changes */
export async function onPropertyRegulatoryReassessmentTrigger(
  propertyId: string,
  actorUserId: string,
  reasonCategory: string,
  req?: AuthenticatedRequest,
) {
  await markRegulatoryReassessmentRequired(propertyId, actorUserId, reasonCategory, req);
}

export async function reconcileExpiredRegulatoryRequirements(now = new Date()) {
  const applicableVerified = await prisma.propertyRegulatoryRequirement.findMany({
    where: {
      applicability: RegulatoryApplicability.applicable,
      complianceStatus: RegulatoryComplianceStatus.verified,
      OR: [
        { expiresAt: { lte: now } },
        {
          evidence: {
            some: { superseded: false, expiresAt: { lte: now } },
          },
        },
      ],
    },
    include: { evidence: { where: { superseded: false } } },
  });

  let updated = 0;
  for (const row of applicableVerified) {
    const reqExpired = row.expiresAt != null && row.expiresAt.getTime() <= now.getTime();
    const evidenceExpired = row.evidence.some(
      (e) => e.expiresAt != null && e.expiresAt.getTime() <= now.getTime(),
    );
    if (!reqExpired && !evidenceExpired) continue;
    if (row.complianceStatus === RegulatoryComplianceStatus.expired) continue;

    await prisma.propertyRegulatoryRequirement.update({
      where: { id: row.id },
      data: { complianceStatus: RegulatoryComplianceStatus.expired },
    });
    await prisma.regulatoryDecisionEvent.create({
      data: {
        requirementId: row.id,
        propertyId: row.propertyId,
        previousApplicability: row.applicability,
        newApplicability: row.applicability,
        previousComplianceStatus: row.complianceStatus,
        newComplianceStatus: RegulatoryComplianceStatus.expired,
        actorUserId: 'system',
        reasonCategory: 'evidence_or_requirement_expired',
        reasonText: 'Idempotent expiry reconciliation',
      },
    });
    updated += 1;
  }
  return { updated };
}

/**
 * SSOT readiness evaluation — fail-closed.
 * Zero requirement rows after activity assessment attempt ⇒ not_started / incomplete (never ready).
 */
export async function evaluatePropertyRegulatoryReadiness(propertyId: string) {
  await reconcileExpiredRegulatoryRequirements().catch(() => undefined);

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      activities: { where: { active: true } },
      regulatoryRequirements: {
        include: { evidence: { where: { superseded: false } } },
      },
    },
  });
  if (!property) throw new AppError(404, 'NOT_FOUND', 'Property not found');

  const activities = property.activities.map(mapActivity);
  const blockingReasons: string[] = [];
  const now = new Date();
  const warningMs = REGULATORY_DOCUMENT_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000;

  // No activities declared → regulatory assessment not started
  if (activities.length === 0) {
    return {
      propertyId,
      readiness: 'not_started' as PropertyRegulatoryReadinessState,
      blockingReasons: ['activity_profile_missing'],
      activities,
      requirements: [] as ReturnType<typeof mapRequirementView>[],
      warningDays: REGULATORY_DOCUMENT_EXPIRY_WARNING_DAYS,
    };
  }

  // Ensure seeds exist (idempotent) without actor
  await ensureRegulatoryAssessmentsForProperty(propertyId);

  const requirements = await prisma.propertyRegulatoryRequirement.findMany({
    where: { propertyId },
    include: { evidence: { where: { superseded: false }, orderBy: { uploadedAt: 'desc' } } },
  });

  if (requirements.length === 0) {
    return {
      propertyId,
      readiness: 'incomplete' as PropertyRegulatoryReadinessState,
      blockingReasons: ['regulatory_assessment_missing'],
      activities,
      requirements: [],
      warningDays: REGULATORY_DOCUMENT_EXPIRY_WARNING_DAYS,
    };
  }

  let anyUnderReview = false;
  let anyActionRequired = false;
  let anyExpired = false;
  let anyIncomplete = false;

  const requirementViews = requirements.map((r) => {
    const satisfied = isRequirementSatisfiedForReadiness({
      applicability: r.applicability,
      complianceStatus: r.complianceStatus,
      expiresAt: r.expiresAt,
      now,
    });

    // Evidence expiry can block even if requirement expiresAt null
    const evidenceExpired = r.evidence.some(
      (e) => e.expiresAt != null && e.expiresAt.getTime() <= now.getTime(),
    );
    const evidenceExpiringSoon = r.evidence.some((e) => {
      if (!e.expiresAt) return false;
      const t = e.expiresAt.getTime();
      return t > now.getTime() && t <= now.getTime() + warningMs;
    });

    if (r.applicability === RegulatoryApplicability.unassessed) {
      anyIncomplete = true;
      blockingReasons.push(`${r.requirementType}:unassessed`);
    } else if (
      r.applicability === RegulatoryApplicability.regulatory_confirmation_required
    ) {
      anyIncomplete = true;
      blockingReasons.push(`${r.requirementType}:regulatory_confirmation_required`);
    } else if (r.applicability === RegulatoryApplicability.applicable) {
      if (r.complianceStatus === RegulatoryComplianceStatus.under_review || r.reassessmentRequired) {
        anyUnderReview = true;
        blockingReasons.push(`${r.requirementType}:under_review`);
      } else if (r.complianceStatus === RegulatoryComplianceStatus.action_required) {
        anyActionRequired = true;
        blockingReasons.push(`${r.requirementType}:action_required`);
      } else if (
        r.complianceStatus === RegulatoryComplianceStatus.rejected ||
        r.complianceStatus === RegulatoryComplianceStatus.not_assessed
      ) {
        anyIncomplete = true;
        blockingReasons.push(`${r.requirementType}:${r.complianceStatus}`);
      } else if (
        r.complianceStatus === RegulatoryComplianceStatus.expired ||
        evidenceExpired ||
        (r.expiresAt != null && r.expiresAt.getTime() <= now.getTime())
      ) {
        anyExpired = true;
        blockingReasons.push(`${r.requirementType}:expired`);
      } else if (!satisfied) {
        anyIncomplete = true;
        blockingReasons.push(`${r.requirementType}:not_satisfied`);
      }
    }

    return mapRequirementView(r, { evidenceExpired, evidenceExpiringSoon, satisfied });
  });

  let readiness: PropertyRegulatoryReadinessState;
  if (anyExpired) readiness = 'expired_or_blocked';
  else if (anyActionRequired) readiness = 'action_required';
  else if (anyUnderReview) readiness = 'under_review';
  else if (anyIncomplete || blockingReasons.length > 0) readiness = 'incomplete';
  else readiness = 'ready';

  // Fail-closed: never READY if any requirement fails satisfaction
  if (readiness === 'ready') {
    const allOk = requirementViews.every((r) => r.satisfiedForReadiness);
    if (!allOk) {
      readiness = 'incomplete';
      blockingReasons.push('readiness_fail_closed');
    }
  }

  return {
    propertyId,
    readiness,
    blockingReasons: [...new Set(blockingReasons)],
    activities,
    requirements: requirementViews,
    warningDays:
      REGULATORY_DOCUMENT_EXPIRY_WARNING_DAYS || REGULATORY_DOCUMENT_EXPIRY_WARNING_DAYS_DEFAULT,
  };
}

function mapRequirementView(
  r: {
    id: string;
    requirementType: RegulatoryRequirementType;
    applicability: RegulatoryApplicability;
    complianceStatus: RegulatoryComplianceStatus;
    issuingAuthority: string | null;
    referenceNumber: string | null;
    issueDate: Date | null;
    validFrom: Date | null;
    expiresAt: Date | null;
    reviewReason: string | null;
    reviewedAt: Date | null;
    verifiedAt: Date | null;
    reassessmentRequired: boolean;
    evidence: Array<{
      id: string;
      originalFileName: string;
      mimeType: string;
      sizeBytes: number;
      label: string | null;
      documentNumber: string | null;
      issuerName: string | null;
      issueDate: Date | null;
      expiresAt: Date | null;
      uploadedAt: Date;
    }>;
  },
  flags: { evidenceExpired: boolean; evidenceExpiringSoon: boolean; satisfied: boolean },
) {
  return {
    id: r.id,
    requirementType: r.requirementType,
    applicability: r.applicability,
    complianceStatus: r.complianceStatus,
    issuingAuthority: r.issuingAuthority,
    referenceNumber: r.referenceNumber,
    issueDate: r.issueDate?.toISOString() ?? null,
    validFrom: r.validFrom?.toISOString() ?? null,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    reviewReason: r.reviewReason,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    verifiedAt: r.verifiedAt?.toISOString() ?? null,
    reassessmentRequired: r.reassessmentRequired,
    evidenceExpired: flags.evidenceExpired,
    evidenceExpiringSoon: flags.evidenceExpiringSoon,
    satisfiedForReadiness: flags.satisfied && !flags.evidenceExpired,
    evidence: r.evidence.map((e) => ({
      id: e.id,
      originalFileName: e.originalFileName,
      mimeType: e.mimeType,
      sizeBytes: e.sizeBytes,
      label: e.label,
      documentNumber: e.documentNumber,
      issuerName: e.issuerName,
      issueDate: e.issueDate?.toISOString() ?? null,
      expiresAt: e.expiresAt?.toISOString() ?? null,
      uploadedAt: e.uploadedAt.toISOString(),
    })),
  };
}

export async function getPropertyRegulatoryPackage(
  userId: string,
  role: import('@mazare3/shared').UserRole,
  propertyId: string,
) {
  const scope = await resolveOwnerScope(userId, role);
  if (scope.isAdmin || !scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Owners only');
  }
  await loadOwnedProperty(propertyId, scope.ownerProfileId);
  const readiness = await evaluatePropertyRegulatoryReadiness(propertyId);
  const { evaluatePropertyBookability } = await import('./property-bookability.service.js');
  const bookability = await evaluatePropertyBookability(propertyId, 'new_booking');
  return {
    ...readiness,
    bookability: {
      canBook: bookability.canBook,
      canPublish: bookability.canPublish,
      blockers: bookability.blockers,
      layers: bookability.layers,
    },
  };
}

export async function uploadRegulatoryEvidence(params: {
  userId: string;
  role: import('@mazare3/shared').UserRole;
  propertyId: string;
  requirementId: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
  label?: string;
  documentNumber?: string;
  issuerName?: string;
  issueDate?: string | null;
  expiresAt?: string | null;
  req?: AuthenticatedRequest;
}) {
  const scope = await resolveOwnerScope(params.userId, params.role);
  if (scope.isAdmin || !scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Owners only');
  }
  await loadOwnedProperty(params.propertyId, scope.ownerProfileId);

  const requirement = await prisma.propertyRegulatoryRequirement.findFirst({
    where: { id: params.requirementId, propertyId: params.propertyId },
  });
  if (!requirement) throw new AppError(404, 'NOT_FOUND', 'Requirement not found');

  await assertPriorConsentActive(
    params.userId,
    'owner_identity_and_authority_verification',
  );

  const storageKey = await writePartnerDocumentFile({
    ownerProfileId: scope.ownerProfileId,
    mime: params.mimeType,
    buffer: params.buffer,
  });

  const previous = await prisma.regulatoryEvidence.findMany({
    where: { requirementId: requirement.id, superseded: false },
  });

  const evidence = await prisma.regulatoryEvidence.create({
    data: {
      requirementId: requirement.id,
      uploadedByUserId: params.userId,
      originalFileName: params.originalFileName,
      storageKey,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
      label: params.label?.trim() || null,
      documentNumber: params.documentNumber?.trim() || null,
      issuerName: params.issuerName?.trim() || null,
      issueDate: params.issueDate ? new Date(params.issueDate) : null,
      expiresAt: params.expiresAt ? new Date(params.expiresAt) : null,
    },
  });

  for (const prev of previous) {
    await prisma.regulatoryEvidence.update({
      where: { id: prev.id },
      data: { superseded: true, supersededById: evidence.id },
    });
  }

  // Owner upload moves to under_review — never verified
  if (
    requirement.complianceStatus !== RegulatoryComplianceStatus.under_review &&
    requirement.complianceStatus !== RegulatoryComplianceStatus.verified
  ) {
    const prevStatus = requirement.complianceStatus;
    await prisma.propertyRegulatoryRequirement.update({
      where: { id: requirement.id },
      data: {
        complianceStatus: RegulatoryComplianceStatus.under_review,
        reassessmentRequired: false,
      },
    });
    await recordRegulatoryDecision({
      requirementId: requirement.id,
      propertyId: params.propertyId,
      previousApplicability: requirement.applicability,
      newApplicability: requirement.applicability,
      previousComplianceStatus: prevStatus,
      newComplianceStatus: RegulatoryComplianceStatus.under_review,
      actorUserId: params.userId,
      reasonCategory: 'owner_evidence_uploaded',
      evidenceIds: [evidence.id],
      req: params.req,
    });
  }

  await createAuditLog({
    actorUserId: params.userId,
    action: 'owner.regulatory_evidence_uploaded',
    entityType: 'regulatory_evidence',
    entityId: evidence.id,
    metadata: { propertyId: params.propertyId, requirementId: requirement.id },
    req: params.req,
  });

  return evaluatePropertyRegulatoryReadiness(params.propertyId);
}

export async function getOwnerAccessibleRegulatoryEvidence(
  userId: string,
  role: import('@mazare3/shared').UserRole,
  evidenceId: string,
) {
  const scope = await resolveOwnerScope(userId, role);
  if (scope.isAdmin || !scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Owners only');
  }
  const evidence = await prisma.regulatoryEvidence.findUnique({
    where: { id: evidenceId },
    include: { requirement: { include: { property: true } } },
  });
  if (!evidence || evidence.requirement.property.ownerId !== scope.ownerProfileId) {
    throw new AppError(404, 'NOT_FOUND', 'Evidence not found');
  }
  const buffer = await readPartnerDocumentFile(evidence.storageKey);
  return { evidence, buffer };
}

export async function adminGetPropertyRegulatory(propertyId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      owner: {
        include: {
          user: { select: { id: true, email: true, name: true } },
          verificationProfile: {
            select: { verificationStatus: true, entityType: true, accountHolderRelation: true },
          },
        },
      },
      contractingOperator: true,
    },
  });
  if (!property) throw new AppError(404, 'NOT_FOUND', 'Property not found');

  const readiness = await evaluatePropertyRegulatoryReadiness(propertyId);
  const events = await prisma.regulatoryDecisionEvent.findMany({
    where: { propertyId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const { getPropertyBookabilityAdminPackage } = await import(
    './property-bookability.service.js'
  );
  const bookability = await getPropertyBookabilityAdminPackage(propertyId);

  return {
    propertyId,
    propertyTitleAr: property.titleAr,
    propertyStatus: property.status,
    platformVerificationStatus: property.verificationStatus,
    authorityReviewStatus: property.authorityReviewStatus,
    accountHolder: {
      userId: property.owner.user.id,
      email: property.owner.user.email,
      name: property.owner.user.name,
      displayName: property.owner.displayName,
      partnerKycStatus: property.owner.verificationProfile?.verificationStatus ?? null,
      accountHolderRelation: property.owner.verificationProfile?.accountHolderRelation ?? null,
    },
    contractingOperator: property.contractingOperator
      ? {
          id: property.contractingOperator.id,
          legalName: property.contractingOperator.legalName,
          entityKind: property.contractingOperator.entityKind,
        }
      : null,
    readiness,
    bookability,
    decisionEvents: events.map((e) => ({
      id: e.id,
      requirementId: e.requirementId,
      previousApplicability: e.previousApplicability,
      newApplicability: e.newApplicability,
      previousComplianceStatus: e.previousComplianceStatus,
      newComplianceStatus: e.newComplianceStatus,
      actorUserId: e.actorUserId,
      reasonCategory: e.reasonCategory,
      reasonText: e.reasonText,
      createdAt: e.createdAt.toISOString(),
    })),
    /** Explicit separation flags for admin UI */
    layers: {
      kyc: property.owner.verificationProfile?.verificationStatus ?? null,
      authority: property.authorityReviewStatus,
      regulatoryReadiness: readiness.readiness,
      propertyContent: property.status,
      platformVerification: property.verificationStatus,
      newBookingEligible: bookability.newBooking.eligible,
      publicationEligible: bookability.publication.eligible,
    },
  };
}

export async function adminDecideRegulatoryRequirement(
  adminUserId: string,
  propertyId: string,
  requirementId: string,
  input: AdminRegulatoryDecisionInput,
  req?: AuthenticatedRequest,
) {
  const requirement = await prisma.propertyRegulatoryRequirement.findFirst({
    where: { id: requirementId, propertyId },
  });
  if (!requirement) throw new AppError(404, 'NOT_FOUND', 'Requirement not found');

  const nextApp = input.applicability ?? requirement.applicability;
  const nextStatus = input.complianceStatus ?? requirement.complianceStatus;

  if (
    (nextStatus === RegulatoryComplianceStatus.action_required ||
      nextStatus === RegulatoryComplianceStatus.rejected) &&
    !input.reasonText?.trim()
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Reason is required for this decision');
  }

  if (
    nextApp === RegulatoryApplicability.not_applicable_confirmed &&
    nextStatus === RegulatoryComplianceStatus.verified
  ) {
    // N/A confirmed — compliance status stays not_assessed or under_review cleared
  }

  const updated = await prisma.propertyRegulatoryRequirement.update({
    where: { id: requirementId },
    data: {
      applicability: nextApp,
      complianceStatus:
        nextApp === RegulatoryApplicability.not_applicable_confirmed
          ? RegulatoryComplianceStatus.not_assessed
          : nextStatus,
      issuingAuthority:
        input.issuingAuthority !== undefined
          ? input.issuingAuthority
          : requirement.issuingAuthority,
      referenceNumber:
        input.referenceNumber !== undefined
          ? input.referenceNumber
          : requirement.referenceNumber,
      issueDate:
        input.issueDate === undefined
          ? requirement.issueDate
          : input.issueDate
            ? new Date(input.issueDate)
            : null,
      validFrom:
        input.validFrom === undefined
          ? requirement.validFrom
          : input.validFrom
            ? new Date(input.validFrom)
            : null,
      expiresAt:
        input.expiresAt === undefined
          ? requirement.expiresAt
          : input.expiresAt
            ? new Date(input.expiresAt)
            : null,
      reviewReason: input.reasonText?.trim() || requirement.reviewReason,
      reviewedByUserId: adminUserId,
      reviewedAt: new Date(),
      verifiedAt:
        nextStatus === RegulatoryComplianceStatus.verified &&
        nextApp === RegulatoryApplicability.applicable
          ? new Date()
          : null,
      reassessmentRequired: false,
    },
  });

  await recordRegulatoryDecision({
    requirementId,
    propertyId,
    previousApplicability: requirement.applicability,
    newApplicability: updated.applicability,
    previousComplianceStatus: requirement.complianceStatus,
    newComplianceStatus: updated.complianceStatus,
    actorUserId: adminUserId,
    reasonCategory: input.reasonCategory ?? 'admin_decision',
    reasonText: input.reasonText ?? null,
    req,
  });

  return adminGetPropertyRegulatory(propertyId);
}

export async function adminStreamRegulatoryEvidence(evidenceId: string) {
  const evidence = await prisma.regulatoryEvidence.findUnique({ where: { id: evidenceId } });
  if (!evidence) throw new AppError(404, 'NOT_FOUND', 'Evidence not found');
  const buffer = await readPartnerDocumentFile(evidence.storageKey);
  return { evidence, buffer };
}

/** Sync activities from existing Property flags for legacy/bootstrap (optional helper). */
export async function bootstrapActivitiesFromPropertyFlags(
  propertyId: string,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  const p = await prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
  const activities: PutPropertyActivitiesInput['activities'] = [];
  if (p.allowsOvernight) {
    activities.push({ activityCode: 'overnight_accommodation', active: true });
  } else {
    activities.push({ activityCode: 'day_use', active: true });
  }
  if (p.allowsEvents) activities.push({ activityCode: 'events', active: true });
  if (p.poolsCount > 0) activities.push({ activityCode: 'swimming_pool', active: true });

  const existing = await prisma.propertyActivity.count({ where: { propertyId, active: true } });
  if (existing > 0) return evaluatePropertyRegulatoryReadiness(propertyId);

  // Direct write without owner scope — admin/system bootstrap
  for (const a of activities) {
    await prisma.propertyActivity.upsert({
      where: {
        propertyId_activityCode: { propertyId, activityCode: a.activityCode },
      },
      create: { propertyId, activityCode: a.activityCode, active: true },
      update: { active: true },
    });
  }
  await ensureRegulatoryAssessmentsForProperty(propertyId, actorUserId, req);
  return evaluatePropertyRegulatoryReadiness(propertyId);
}
