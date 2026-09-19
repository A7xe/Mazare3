/**
 * Phase 3C.4D.3 — Property authority / operator party services.
 * Distinct from KYC (PartnerVerificationStatus) and platform_verified.
 */
import {
  prisma,
  PropertyAuthorityReviewStatus,
  type OperatorEntityKind,
  type PropertyAuthorityBasis,
  type DeclaredPropertyOwnerRelation,
  type AccountHolderOperatorRelation,
  type PartnerDocumentType,
  OwnerDocumentReviewStatus,
} from '@mazare3/db';
import {
  AUTHORITY_ATTESTATION_CORPUS_VERSION,
  AUTHORITY_ATTESTATION_KEY,
  requiredAuthorityDocumentTypesForBasis,
  type UpsertOperatorPartyInput,
  type PatchPropertyAuthorityInput,
  type AdminPropertyAuthorityDecisionInput,
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

function mapOperatorParty(row: {
  id: string;
  ownerProfileId: string;
  entityKind: OperatorEntityKind;
  legalName: string;
  registrationNumber: string | null;
  registrationAuthority: string | null;
  country: string;
  contactEmail: string | null;
  contactPhone: string | null;
  isDefaultContractingOperator: boolean;
}) {
  return {
    id: row.id,
    ownerProfileId: row.ownerProfileId,
    entityKind: row.entityKind,
    legalName: row.legalName,
    registrationNumber: row.registrationNumber,
    registrationAuthority: row.registrationAuthority,
    country: row.country,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    isDefaultContractingOperator: row.isDefaultContractingOperator,
  };
}

export async function listOperatorParties(userId: string, role: import('@mazare3/shared').UserRole) {
  const scope = await resolveOwnerScope(userId, role);
  if (scope.isAdmin || !scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Owners only');
  }
  const rows = await prisma.operatorParty.findMany({
    where: { ownerProfileId: scope.ownerProfileId },
    orderBy: [{ isDefaultContractingOperator: 'desc' }, { createdAt: 'asc' }],
  });
  return rows.map(mapOperatorParty);
}

export async function upsertOperatorParty(
  userId: string,
  role: import('@mazare3/shared').UserRole,
  input: UpsertOperatorPartyInput,
  req?: AuthenticatedRequest,
) {
  const scope = await resolveOwnerScope(userId, role);
  if (scope.isAdmin || !scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Owners only');
  }
  const ownerProfileId = scope.ownerProfileId;

  if (input.entityKind !== 'individual') {
    if (!input.legalName?.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Legal name is required for business entities');
    }
  }

  if (input.isDefaultContractingOperator) {
    await prisma.operatorParty.updateMany({
      where: { ownerProfileId, isDefaultContractingOperator: true },
      data: { isDefaultContractingOperator: false },
    });
  }

  let row;
  let materialChangeForPayout = false;
  if (input.id) {
    const existing = await prisma.operatorParty.findFirst({
      where: { id: input.id, ownerProfileId },
    });
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Operator party not found');
    }
    const nextLegal = input.legalName.trim();
    const nextDefault =
      input.isDefaultContractingOperator ?? existing.isDefaultContractingOperator;
    materialChangeForPayout =
      existing.legalName.trim() !== nextLegal ||
      Boolean(existing.isDefaultContractingOperator) !== Boolean(nextDefault) ||
      existing.entityKind !== input.entityKind;
    row = await prisma.operatorParty.update({
      where: { id: existing.id },
      data: {
        entityKind: input.entityKind,
        legalName: nextLegal,
        registrationNumber: input.registrationNumber?.trim() || null,
        registrationAuthority: input.registrationAuthority?.trim() || null,
        country: (input.country ?? 'JO').toUpperCase(),
        contactEmail: input.contactEmail?.trim() || null,
        contactPhone: input.contactPhone?.trim() || null,
        isDefaultContractingOperator: nextDefault,
      },
    });
    await maybeReassessPropertiesForOperatorChange(ownerProfileId, row.id, userId, req);
  } else {
    row = await prisma.operatorParty.create({
      data: {
        ownerProfileId,
        entityKind: input.entityKind,
        legalName: input.legalName.trim(),
        registrationNumber: input.registrationNumber?.trim() || null,
        registrationAuthority: input.registrationAuthority?.trim() || null,
        country: (input.country ?? 'JO').toUpperCase(),
        contactEmail: input.contactEmail?.trim() || null,
        contactPhone: input.contactPhone?.trim() || null,
        isDefaultContractingOperator: input.isDefaultContractingOperator ?? false,
      },
    });
    if (input.isDefaultContractingOperator) materialChangeForPayout = true;
  }

  if (materialChangeForPayout) {
    const { markPayoutBeneficiaryReassessmentRequired } = await import(
      './payout-beneficiary.service.js'
    );
    await markPayoutBeneficiaryReassessmentRequired({
      ownerProfileId,
      actorUserId: userId,
      reasonCategory: 'operator_party_changed',
      reason: 'Contracting OperatorParty changed — payout beneficiary requires re-review',
      req,
    });
  }

  await createAuditLog({
    actorUserId: userId,
    action: input.id ? 'owner.operator_party_updated' : 'owner.operator_party_created',
    entityType: 'operator_party',
    entityId: row.id,
    metadata: { entityKind: row.entityKind },
    req,
  });

  return mapOperatorParty(row);
}

export async function patchAccountHolderRelation(
  userId: string,
  role: import('@mazare3/shared').UserRole,
  accountHolderRelation: AccountHolderOperatorRelation,
  req?: AuthenticatedRequest,
) {
  const scope = await resolveOwnerScope(userId, role);
  if (scope.isAdmin || !scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Owners only');
  }
  const profile = await prisma.ownerVerificationProfile.upsert({
    where: { ownerProfileId: scope.ownerProfileId },
    create: {
      ownerProfileId: scope.ownerProfileId,
      accountHolderRelation,
    },
    update: { accountHolderRelation },
  });
  await createAuditLog({
    actorUserId: userId,
    action: 'owner.account_holder_relation_set',
    entityType: 'owner_profile',
    entityId: scope.ownerProfileId,
    metadata: { accountHolderRelation },
    req,
  });
  return { accountHolderRelation: profile.accountHolderRelation };
}

async function loadOwnedProperty(propertyId: string, ownerProfileId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, ownerId: ownerProfileId },
  });
  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }
  return property;
}

async function assertPartyOwned(partyId: string, ownerProfileId: string) {
  const party = await prisma.operatorParty.findFirst({
    where: { id: partyId, ownerProfileId },
  });
  if (!party) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Operator party not found for this Owner');
  }
  return party;
}

function materialAuthorityChanged(
  before: {
    contractingOperatorPartyId: string | null;
    declaredPropertyOwnerPartyId: string | null;
    declaredPropertyOwnerRelation: DeclaredPropertyOwnerRelation | null;
    authorityBasis: PropertyAuthorityBasis | null;
  },
  after: typeof before,
): boolean {
  return (
    before.contractingOperatorPartyId !== after.contractingOperatorPartyId ||
    before.declaredPropertyOwnerPartyId !== after.declaredPropertyOwnerPartyId ||
    before.declaredPropertyOwnerRelation !== after.declaredPropertyOwnerRelation ||
    before.authorityBasis !== after.authorityBasis
  );
}

async function recordAuthorityStatusChange(params: {
  propertyId: string;
  previousStatus: PropertyAuthorityReviewStatus;
  newStatus: PropertyAuthorityReviewStatus;
  actorUserId: string;
  reasonCategory?: string | null;
  reasonText?: string | null;
  evidenceDocumentIds?: string[];
  req?: AuthenticatedRequest;
}) {
  await prisma.propertyAuthorityReviewEvent.create({
    data: {
      propertyId: params.propertyId,
      previousStatus: params.previousStatus,
      newStatus: params.newStatus,
      actorUserId: params.actorUserId,
      reasonCategory: params.reasonCategory ?? null,
      reasonText: params.reasonText ?? null,
      evidenceDocumentIds: params.evidenceDocumentIds ?? undefined,
    },
  });
  await createAuditLog({
    actorUserId: params.actorUserId,
    action: 'property.authority_review_status_changed',
    entityType: 'property',
    entityId: params.propertyId,
    metadata: {
      previousStatus: params.previousStatus,
      newStatus: params.newStatus,
      reasonCategory: params.reasonCategory ?? null,
    },
    req: params.req,
  });
}

async function maybeReassessPropertiesForOperatorChange(
  ownerProfileId: string,
  operatorPartyId: string,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  const props = await prisma.property.findMany({
    where: {
      ownerId: ownerProfileId,
      OR: [
        { contractingOperatorPartyId: operatorPartyId },
        { declaredPropertyOwnerPartyId: operatorPartyId },
      ],
      authorityReviewStatus: PropertyAuthorityReviewStatus.approved,
    },
    select: { id: true, authorityReviewStatus: true },
  });
  for (const p of props) {
    await prisma.property.update({
      where: { id: p.id },
      data: {
        authorityReviewStatus: PropertyAuthorityReviewStatus.reassessment_required,
        authorityReviewReason: 'Material operator party change after authority approval',
        authorityReviewedAt: null,
        authorityReviewedByUserId: null,
      },
    });
    await recordAuthorityStatusChange({
      propertyId: p.id,
      previousStatus: PropertyAuthorityReviewStatus.approved,
      newStatus: PropertyAuthorityReviewStatus.reassessment_required,
      actorUserId,
      reasonCategory: 'operator_party_changed',
      reasonText: 'Contracting or declared-owner party updated after approval',
      req,
    });
  }
}

export async function getPropertyAuthorityPackage(
  userId: string,
  role: import('@mazare3/shared').UserRole,
  propertyId: string,
) {
  const scope = await resolveOwnerScope(userId, role);
  if (scope.isAdmin || !scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Owners only');
  }
  return buildAuthorityPackageView(propertyId, scope.ownerProfileId);
}

async function buildAuthorityPackageView(propertyId: string, ownerProfileId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, ownerId: ownerProfileId },
    include: {
      contractingOperator: true,
      declaredPropertyOwner: true,
      authorityReviewEvents: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }

  const evidence = await prisma.ownerDocument.findMany({
    where: {
      ownerProfileId,
      OR: [{ propertyId }, { propertyId: null }],
      documentType: {
        in: [
          'property_ownership',
          'management_authorization',
          'representation_authority',
          'lease_or_sublease_authority',
          'other',
        ],
      },
      reviewStatus: { not: OwnerDocumentReviewStatus.superseded },
    },
    orderBy: { uploadedAt: 'desc' },
  });

  const verification = await prisma.ownerVerificationProfile.findUnique({
    where: { ownerProfileId },
    select: { accountHolderRelation: true, entityType: true, verificationStatus: true },
  });

  const missing = listMissingAuthorityPackageFields({
    contractingOperatorPartyId: property.contractingOperatorPartyId,
    declaredPropertyOwnerRelation: property.declaredPropertyOwnerRelation,
    declaredPropertyOwnerPartyId: property.declaredPropertyOwnerPartyId,
    authorityBasis: property.authorityBasis,
    authorityAttestedAt: property.authorityAttestedAt,
    evidenceTypes: evidence.map((e) => e.documentType),
  });

  return {
    propertyId: property.id,
    accountHolderRelation: verification?.accountHolderRelation ?? null,
    partnerKycStatus: verification?.verificationStatus ?? null,
    partnerEntityType: verification?.entityType ?? null,
    contractingOperator: property.contractingOperator
      ? mapOperatorParty(property.contractingOperator)
      : null,
    declaredPropertyOwnerRelation: property.declaredPropertyOwnerRelation,
    declaredPropertyOwner: property.declaredPropertyOwner
      ? mapOperatorParty(property.declaredPropertyOwner)
      : null,
    authorityBasis: property.authorityBasis,
    authorityReviewStatus: property.authorityReviewStatus,
    authorityReviewReason: property.authorityReviewReason,
    authorityReviewedAt: property.authorityReviewedAt?.toISOString() ?? null,
    authorityAttestedAt: property.authorityAttestedAt?.toISOString() ?? null,
    authorityAttestationVersion: property.authorityAttestationVersion,
    /** Explicit: not platform verification / not 15% */
    platformVerificationStatus: property.verificationStatus,
    evidence: evidence.map((d) => ({
      id: d.id,
      documentType: d.documentType,
      originalFileName: d.originalFileName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      reviewStatus: d.reviewStatus,
      propertyScoped: d.propertyId != null,
      uploadedAt: d.uploadedAt.toISOString(),
    })),
    reviewEvents: property.authorityReviewEvents.map((e) => ({
      id: e.id,
      previousStatus: e.previousStatus,
      newStatus: e.newStatus,
      reasonCategory: e.reasonCategory,
      reasonText: e.reasonText,
      createdAt: e.createdAt.toISOString(),
    })),
    missingForSubmit: missing,
    canSubmitAuthorityPackage: missing.length === 0,
  };
}

export function listMissingAuthorityPackageFields(input: {
  contractingOperatorPartyId: string | null;
  declaredPropertyOwnerRelation: DeclaredPropertyOwnerRelation | null;
  declaredPropertyOwnerPartyId: string | null;
  authorityBasis: PropertyAuthorityBasis | null;
  authorityAttestedAt: Date | null;
  evidenceTypes: PartnerDocumentType[];
}): string[] {
  const missing: string[] = [];
  if (!input.contractingOperatorPartyId) missing.push('contracting_operator');
  if (!input.declaredPropertyOwnerRelation) missing.push('declared_property_owner_relation');
  if (
    input.declaredPropertyOwnerRelation &&
    input.declaredPropertyOwnerRelation !== 'same_as_contracting_operator' &&
    !input.declaredPropertyOwnerPartyId
  ) {
    missing.push('declared_property_owner_party');
  }
  if (!input.authorityBasis) missing.push('authority_basis');
  if (!input.authorityAttestedAt) missing.push('authority_attestation');
  if (input.authorityBasis) {
    const needed = requiredAuthorityDocumentTypesForBasis(input.authorityBasis);
    const has = needed.some((t) => input.evidenceTypes.includes(t));
    if (!has) missing.push('authority_evidence');
  }
  return missing;
}

export async function patchPropertyAuthority(
  userId: string,
  role: import('@mazare3/shared').UserRole,
  propertyId: string,
  input: PatchPropertyAuthorityInput,
  req?: AuthenticatedRequest,
) {
  const scope = await resolveOwnerScope(userId, role);
  if (scope.isAdmin || !scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Owners only');
  }
  const property = await loadOwnedProperty(propertyId, scope.ownerProfileId);

  if (input.contractingOperatorPartyId) {
    await assertPartyOwned(input.contractingOperatorPartyId, scope.ownerProfileId);
  }
  if (input.declaredPropertyOwnerPartyId) {
    await assertPartyOwned(input.declaredPropertyOwnerPartyId, scope.ownerProfileId);
  }

  const next = {
    contractingOperatorPartyId:
      input.contractingOperatorPartyId !== undefined
        ? input.contractingOperatorPartyId
        : property.contractingOperatorPartyId,
    declaredPropertyOwnerPartyId:
      input.declaredPropertyOwnerPartyId !== undefined
        ? input.declaredPropertyOwnerPartyId
        : property.declaredPropertyOwnerPartyId,
    declaredPropertyOwnerRelation:
      input.declaredPropertyOwnerRelation !== undefined
        ? input.declaredPropertyOwnerRelation
        : property.declaredPropertyOwnerRelation,
    authorityBasis:
      input.authorityBasis !== undefined ? input.authorityBasis : property.authorityBasis,
  };

  if (next.declaredPropertyOwnerRelation === 'same_as_contracting_operator') {
    next.declaredPropertyOwnerPartyId = null;
  }

  const material =
    property.authorityReviewStatus === PropertyAuthorityReviewStatus.approved &&
    materialAuthorityChanged(
      {
        contractingOperatorPartyId: property.contractingOperatorPartyId,
        declaredPropertyOwnerPartyId: property.declaredPropertyOwnerPartyId,
        declaredPropertyOwnerRelation: property.declaredPropertyOwnerRelation,
        authorityBasis: property.authorityBasis,
      },
      next,
    );

  const updated = await prisma.property.update({
    where: { id: propertyId },
    data: {
      contractingOperatorPartyId: next.contractingOperatorPartyId,
      declaredPropertyOwnerPartyId: next.declaredPropertyOwnerPartyId,
      declaredPropertyOwnerRelation: next.declaredPropertyOwnerRelation,
      authorityBasis: next.authorityBasis,
      ...(material
        ? {
            authorityReviewStatus: PropertyAuthorityReviewStatus.reassessment_required,
            authorityReviewReason: 'Material authority fields changed after approval',
            authorityReviewedAt: null,
            authorityReviewedByUserId: null,
          }
        : {}),
    },
  });

  if (material) {
    await recordAuthorityStatusChange({
      propertyId,
      previousStatus: PropertyAuthorityReviewStatus.approved,
      newStatus: PropertyAuthorityReviewStatus.reassessment_required,
      actorUserId: userId,
      reasonCategory: 'authority_fields_changed',
      reasonText: 'Operator, declared owner, or authority basis changed after approval',
      req,
    });
    try {
      const { onPropertyRegulatoryReassessmentTrigger } = await import(
        './property-regulatory.service.js'
      );
      await onPropertyRegulatoryReassessmentTrigger(
        propertyId,
        userId,
        'authority_fields_changed',
        req,
      );
    } catch (err) {
      console.error('[3c4d4a] regulatory reassessment on authority change', err);
    }
  }

  await createAuditLog({
    actorUserId: userId,
    action: 'owner.property_authority_updated',
    entityType: 'property',
    entityId: propertyId,
    metadata: { authorityBasis: updated.authorityBasis, reassessment: material },
    req,
  });

  return buildAuthorityPackageView(propertyId, scope.ownerProfileId);
}

export async function recordPropertyAuthorityAttestation(
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
      attestationKey: AUTHORITY_ATTESTATION_KEY,
      attestationCorpusVersion: AUTHORITY_ATTESTATION_CORPUS_VERSION,
      sourceSurface: sourceSurface ?? 'owner.property_authority',
    },
  });

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      authorityAttestedAt: new Date(),
      authorityAttestationVersion: AUTHORITY_ATTESTATION_CORPUS_VERSION,
      authorityAttestedByUserId: userId,
    },
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'owner.property_authority_attested',
    entityType: 'property',
    entityId: propertyId,
    metadata: {
      attestationKey: AUTHORITY_ATTESTATION_KEY,
      attestationCorpusVersion: AUTHORITY_ATTESTATION_CORPUS_VERSION,
    },
    req,
  });

  return buildAuthorityPackageView(propertyId, scope.ownerProfileId);
}

export async function uploadPropertyAuthorityEvidence(params: {
  userId: string;
  role: import('@mazare3/shared').UserRole;
  propertyId: string;
  documentType: PartnerDocumentType;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
  req?: AuthenticatedRequest;
}) {
  const scope = await resolveOwnerScope(params.userId, params.role);
  if (scope.isAdmin || !scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Owners only');
  }
  await loadOwnedProperty(params.propertyId, scope.ownerProfileId);

  const allowed: PartnerDocumentType[] = [
    'property_ownership',
    'management_authorization',
    'representation_authority',
    'lease_or_sublease_authority',
    'other',
  ];
  if (!allowed.includes(params.documentType)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid authority document type');
  }

  await assertPriorConsentActive(
    params.userId,
    'owner_identity_and_authority_verification',
  );

  const storageKey = await writePartnerDocumentFile({
    ownerProfileId: scope.ownerProfileId,
    mime: params.mimeType,
    buffer: params.buffer,
  });

  const previous = await prisma.ownerDocument.findMany({
    where: {
      ownerProfileId: scope.ownerProfileId,
      propertyId: params.propertyId,
      documentType: params.documentType,
      reviewStatus: { not: OwnerDocumentReviewStatus.superseded },
    },
  });

  const doc = await prisma.ownerDocument.create({
    data: {
      ownerProfileId: scope.ownerProfileId,
      propertyId: params.propertyId,
      documentType: params.documentType,
      originalFileName: params.originalFileName,
      storageKey,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
      reviewStatus: OwnerDocumentReviewStatus.uploaded,
    },
  });

  for (const prev of previous) {
    await prisma.ownerDocument.update({
      where: { id: prev.id },
      data: {
        reviewStatus: OwnerDocumentReviewStatus.superseded,
        supersededById: doc.id,
      },
    });
  }

  const property = await prisma.property.findUniqueOrThrow({ where: { id: params.propertyId } });
  if (property.authorityReviewStatus === PropertyAuthorityReviewStatus.approved) {
    await prisma.property.update({
      where: { id: params.propertyId },
      data: {
        authorityReviewStatus: PropertyAuthorityReviewStatus.reassessment_required,
        authorityReviewReason: 'Critical authority evidence replaced after approval',
        authorityReviewedAt: null,
        authorityReviewedByUserId: null,
      },
    });
    await recordAuthorityStatusChange({
      propertyId: params.propertyId,
      previousStatus: PropertyAuthorityReviewStatus.approved,
      newStatus: PropertyAuthorityReviewStatus.reassessment_required,
      actorUserId: params.userId,
      reasonCategory: 'authority_evidence_replaced',
      evidenceDocumentIds: [doc.id],
      req: params.req,
    });
  }

  await createAuditLog({
    actorUserId: params.userId,
    action: 'owner.property_authority_evidence_uploaded',
    entityType: 'owner_document',
    entityId: doc.id,
    metadata: {
      propertyId: params.propertyId,
      documentType: params.documentType,
      // no storageKey / URLs in logs
    },
    req: params.req,
  });

  return buildAuthorityPackageView(params.propertyId, scope.ownerProfileId);
}

export async function getOwnerAccessibleAuthorityDocument(
  userId: string,
  role: import('@mazare3/shared').UserRole,
  documentId: string,
) {
  const scope = await resolveOwnerScope(userId, role);
  if (scope.isAdmin || !scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Owners only');
  }
  const doc = await prisma.ownerDocument.findFirst({
    where: { id: documentId, ownerProfileId: scope.ownerProfileId },
  });
  if (!doc) {
    throw new AppError(404, 'NOT_FOUND', 'Document not found');
  }
  const buffer = await readPartnerDocumentFile(doc.storageKey);
  return { doc, buffer };
}

export async function assertAuthorityPackageCompleteForSubmit(
  propertyId: string,
  ownerProfileId: string,
): Promise<void> {
  const view = await buildAuthorityPackageView(propertyId, ownerProfileId);
  if (!view.canSubmitAuthorityPackage) {
    throw new AppError(
      400,
      'AUTHORITY_PACKAGE_INCOMPLETE',
      'Complete authority package before submitting for review',
      { missing: view.missingForSubmit },
    );
  }
}

/** Called when Property is submitted for review — moves authority into under_review if package complete. */
export async function markAuthorityUnderReviewOnPropertySubmit(
  propertyId: string,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  const property = await prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
  const prev = property.authorityReviewStatus;
  if (
    prev === PropertyAuthorityReviewStatus.approved ||
    prev === PropertyAuthorityReviewStatus.under_review
  ) {
    return;
  }
  await prisma.property.update({
    where: { id: propertyId },
    data: {
      authorityReviewStatus: PropertyAuthorityReviewStatus.under_review,
      authorityReviewReason: null,
    },
  });
  await recordAuthorityStatusChange({
    propertyId,
    previousStatus: prev,
    newStatus: PropertyAuthorityReviewStatus.under_review,
    actorUserId,
    reasonCategory: 'property_submitted_for_review',
    req,
  });
}

export async function adminGetPropertyAuthority(propertyId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      owner: {
        include: {
          user: { select: { id: true, email: true, name: true } },
          verificationProfile: {
            select: {
              accountHolderRelation: true,
              entityType: true,
              verificationStatus: true,
              legalName: true,
            },
          },
        },
      },
      contractingOperator: true,
      declaredPropertyOwner: true,
      authorityReviewEvents: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }

  const evidence = await prisma.ownerDocument.findMany({
    where: {
      ownerProfileId: property.ownerId,
      OR: [{ propertyId }, { propertyId: null }],
      documentType: {
        in: [
          'property_ownership',
          'management_authorization',
          'representation_authority',
          'lease_or_sublease_authority',
          'other',
        ],
      },
      reviewStatus: { not: OwnerDocumentReviewStatus.superseded },
    },
    orderBy: { uploadedAt: 'desc' },
  });

  return {
    propertyId: property.id,
    propertyTitleAr: property.titleAr,
    propertyStatus: property.status,
    platformVerificationStatus: property.verificationStatus,
    accountHolder: {
      userId: property.owner.user.id,
      email: property.owner.user.email,
      name: property.owner.user.name,
      ownerProfileId: property.ownerId,
      displayName: property.owner.displayName,
      accountHolderRelation:
        property.owner.verificationProfile?.accountHolderRelation ?? null,
      partnerKycStatus: property.owner.verificationProfile?.verificationStatus ?? null,
      partnerEntityType: property.owner.verificationProfile?.entityType ?? null,
    },
    contractingOperator: property.contractingOperator
      ? mapOperatorParty(property.contractingOperator)
      : null,
    declaredPropertyOwnerRelation: property.declaredPropertyOwnerRelation,
    declaredPropertyOwner: property.declaredPropertyOwner
      ? mapOperatorParty(property.declaredPropertyOwner)
      : null,
    /** Owner-declared — not "verified legal owner" */
    declaredPropertyOwnerLabel: 'declared_property_owner',
    authorityBasis: property.authorityBasis,
    authorityReviewStatus: property.authorityReviewStatus,
    authorityReviewReason: property.authorityReviewReason,
    authorityReviewedAt: property.authorityReviewedAt?.toISOString() ?? null,
    authorityAttestedAt: property.authorityAttestedAt?.toISOString() ?? null,
    authorityAttestationVersion: property.authorityAttestationVersion,
    evidence: evidence.map((d) => ({
      id: d.id,
      documentType: d.documentType,
      originalFileName: d.originalFileName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      reviewStatus: d.reviewStatus,
      propertyScoped: d.propertyId != null,
      uploadedAt: d.uploadedAt.toISOString(),
    })),
    reviewEvents: property.authorityReviewEvents.map((e) => ({
      id: e.id,
      previousStatus: e.previousStatus,
      newStatus: e.newStatus,
      actorUserId: e.actorUserId,
      reasonCategory: e.reasonCategory,
      reasonText: e.reasonText,
      evidenceDocumentIds: e.evidenceDocumentIds,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export async function adminDecidePropertyAuthority(
  adminUserId: string,
  propertyId: string,
  input: AdminPropertyAuthorityDecisionInput,
  req?: AuthenticatedRequest,
) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }

  const prev = property.authorityReviewStatus;
  let next: PropertyAuthorityReviewStatus;
  if (input.decision === 'approve') {
    next = PropertyAuthorityReviewStatus.approved;
  } else if (input.decision === 'request_changes') {
    next = PropertyAuthorityReviewStatus.action_required;
  } else {
    next = PropertyAuthorityReviewStatus.rejected;
  }

  if (
    (input.decision === 'request_changes' || input.decision === 'reject') &&
    !input.reasonText?.trim()
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Reason is required for this decision');
  }

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      authorityReviewStatus: next,
      authorityReviewReason: input.reasonText?.trim() || null,
      authorityReviewedAt: new Date(),
      authorityReviewedByUserId: adminUserId,
    },
  });

  await recordAuthorityStatusChange({
    propertyId,
    previousStatus: prev,
    newStatus: next,
    actorUserId: adminUserId,
    reasonCategory: input.reasonCategory ?? input.decision,
    reasonText: input.reasonText ?? null,
    req,
  });

  // Explicit: do NOT set platform_verified or change commission
  return adminGetPropertyAuthority(propertyId);
}

export async function adminStreamAuthorityDocument(documentId: string) {
  const doc = await prisma.ownerDocument.findUnique({ where: { id: documentId } });
  if (!doc) {
    throw new AppError(404, 'NOT_FOUND', 'Document not found');
  }
  const buffer = await readPartnerDocumentFile(doc.storageKey);
  return { doc, buffer };
}

/** Map PartnerEntityType coarse UX → OperatorEntityKind default */
export function defaultOperatorEntityKindFromPartner(
  entityType: 'individual' | 'business' | null | undefined,
): OperatorEntityKind {
  if (entityType === 'business') return 'legal_entity';
  return 'individual';
}

export async function ensureDefaultContractingOperatorFromOwner(params: {
  ownerProfileId: string;
  legalName: string;
  entityKind: OperatorEntityKind;
  contactPhone?: string | null;
  contactEmail?: string | null;
}) {
  const existing = await prisma.operatorParty.findFirst({
    where: { ownerProfileId: params.ownerProfileId, isDefaultContractingOperator: true },
  });
  if (existing) return mapOperatorParty(existing);
  const row = await prisma.operatorParty.create({
    data: {
      ownerProfileId: params.ownerProfileId,
      entityKind: params.entityKind,
      legalName: params.legalName,
      contactPhone: params.contactPhone ?? null,
      contactEmail: params.contactEmail ?? null,
      isDefaultContractingOperator: true,
      country: 'JO',
    },
  });
  return mapOperatorParty(row);
}
