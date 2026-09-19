/**
 * Phase 3C.4D.7A — Payout beneficiary identity matching helpers.
 * Decrypt is Admin-review scoped only. Never log full IBAN.
 */
import {
  prisma,
  OwnerPayoutReviewStatus,
  PayoutBeneficiaryRelationship,
  PayoutBeneficiaryNameMatchHint,
  type Prisma,
} from '@mazare3/db';
import {
  compareBeneficiaryToOperatorName,
  isStructurallyValidIban,
  PAYOUT_THIRD_PARTY_BENEFICIARY_COUNSEL_CONFIRMATION_REQUIRED,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import {
  decryptPartnerField,
  encryptPartnerField,
  fingerprintIban,
  last4Of,
} from '../lib/partner-crypto.js';
import { createAuditLog } from './audit.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { evaluateOwnerPayoutProfileReadiness } from '../lib/owner-payout-readiness.js';

async function recordReviewEvent(params: {
  payoutProfileId: string;
  ownerProfileId: string;
  actorUserId?: string | null;
  previousStatus: string | null;
  newStatus: string;
  reasonCategory?: string | null;
  reason?: string | null;
  ibanLast4?: string | null;
  beneficiaryRelationship?: string | null;
  nameMatchHint?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.ownerPayoutBeneficiaryReviewEvent.create({
    data: {
      payoutProfileId: params.payoutProfileId,
      ownerProfileId: params.ownerProfileId,
      actorUserId: params.actorUserId ?? null,
      previousStatus: params.previousStatus,
      newStatus: params.newStatus,
      reasonCategory: params.reasonCategory ?? null,
      reason: params.reason ?? null,
      ibanLast4: params.ibanLast4 ?? null,
      beneficiaryRelationship: params.beneficiaryRelationship ?? null,
      nameMatchHint: params.nameMatchHint ?? null,
      metadata: params.metadata ?? undefined,
    },
  });
}

export async function resolveDefaultContractingOperator(ownerProfileId: string) {
  return prisma.operatorParty.findFirst({
    where: { ownerProfileId, isDefaultContractingOperator: true },
    select: {
      id: true,
      legalName: true,
      entityKind: true,
      isDefaultContractingOperator: true,
    },
  });
}

export async function markPayoutBeneficiaryReassessmentRequired(params: {
  ownerProfileId: string;
  actorUserId?: string | null;
  reasonCategory: string;
  reason: string;
  req?: AuthenticatedRequest;
}) {
  const profile = await prisma.ownerPayoutProfile.findUnique({
    where: { ownerProfileId: params.ownerProfileId },
  });
  if (!profile) return null;
  if (profile.reviewStatus === OwnerPayoutReviewStatus.reassessment_required) {
    return profile;
  }
  const previous = profile.reviewStatus;
  const updated = await prisma.ownerPayoutProfile.update({
    where: { id: profile.id },
    data: {
      reviewStatus: OwnerPayoutReviewStatus.reassessment_required,
      reviewReason: params.reason,
      reviewReasonCategory: params.reasonCategory,
      reviewedAt: null,
      reviewedByUserId: null,
    },
  });
  await recordReviewEvent({
    payoutProfileId: profile.id,
    ownerProfileId: params.ownerProfileId,
    actorUserId: params.actorUserId,
    previousStatus: previous,
    newStatus: OwnerPayoutReviewStatus.reassessment_required,
    reasonCategory: params.reasonCategory,
    reason: params.reason,
    ibanLast4: profile.ibanLast4,
    beneficiaryRelationship: profile.beneficiaryRelationship,
    nameMatchHint: profile.nameMatchHint,
  });
  await createAuditLog({
    actorUserId: params.actorUserId ?? undefined,
    action: 'owner.payout_beneficiary_reassessment_required',
    entityType: 'owner_payout_profile',
    entityId: profile.id,
    metadata: {
      ownerProfileId: params.ownerProfileId,
      reasonCategory: params.reasonCategory,
      ibanLast4: profile.ibanLast4,
    },
    req: params.req,
  });
  return updated;
}

export type SavePayoutBeneficiaryInput = {
  beneficiaryName: string;
  bankName: string;
  iban: string;
  optionalNotes?: string;
  beneficiaryRelationship: PayoutBeneficiaryRelationship;
  payoutCountry?: string;
};

export async function saveOwnerPayoutBeneficiaryProfile(params: {
  userId: string;
  ownerProfileId: string;
  input: SavePayoutBeneficiaryInput;
  req?: AuthenticatedRequest;
}) {
  const iban = params.input.iban.replace(/\s+/g, '').toUpperCase();
  if (!isStructurallyValidIban(iban)) {
    throw new AppError(
      400,
      'IBAN_FORMAT_INVALID',
      'IBAN format/checksum is not structurally valid. This does not verify account ownership.',
    );
  }

  const operator = await resolveDefaultContractingOperator(params.ownerProfileId);
  if (!operator) {
    throw new AppError(
      400,
      'CONTRACTING_OPERATOR_REQUIRED',
      'Contracting OperatorParty must exist before payout beneficiary setup',
    );
  }

  const nameMatchHint = compareBeneficiaryToOperatorName(
    params.input.beneficiaryName.trim(),
    operator.legalName,
  ) as PayoutBeneficiaryNameMatchHint;

  const beneficiaryNameCipher = encryptPartnerField(params.input.beneficiaryName.trim());
  const bankNameCipher = encryptPartnerField(params.input.bankName.trim());
  const ibanCipher = encryptPartnerField(iban);
  const optionalNotesCipher = params.input.optionalNotes?.trim()
    ? encryptPartnerField(params.input.optionalNotes.trim())
    : null;

  const existing = await prisma.ownerPayoutProfile.findUnique({
    where: { ownerProfileId: params.ownerProfileId },
  });

  const data = {
    beneficiaryNameCipher,
    bankNameCipher,
    ibanCipher,
    ibanLast4: last4Of(iban),
    ibanFingerprint: fingerprintIban(iban),
    optionalNotesCipher,
    contractingOperatorPartyId: operator.id,
    beneficiaryRelationship: params.input.beneficiaryRelationship,
    payoutCountry: (params.input.payoutCountry ?? 'JO').toUpperCase(),
    nameMatchHint,
    reviewStatus: OwnerPayoutReviewStatus.pending,
    reviewReason: null as string | null,
    reviewReasonCategory: null as string | null,
    reviewedAt: null as Date | null,
    reviewedByUserId: null as string | null,
  };

  const row = existing
    ? await prisma.ownerPayoutProfile.update({ where: { id: existing.id }, data })
    : await prisma.ownerPayoutProfile.create({
        data: { ownerProfileId: params.ownerProfileId, ...data },
      });

  await recordReviewEvent({
    payoutProfileId: row.id,
    ownerProfileId: params.ownerProfileId,
    actorUserId: params.userId,
    previousStatus: existing?.reviewStatus ?? null,
    newStatus: OwnerPayoutReviewStatus.pending,
    ibanLast4: row.ibanLast4,
    beneficiaryRelationship: row.beneficiaryRelationship,
    nameMatchHint: row.nameMatchHint,
    metadata: {
      event: existing ? 'material_beneficiary_update' : 'beneficiary_created',
      counselThirdPartyFlag: PAYOUT_THIRD_PARTY_BENEFICIARY_COUNSEL_CONFIRMATION_REQUIRED,
    },
  });

  await createAuditLog({
    actorUserId: params.userId,
    action: 'owner.payout_profile_saved',
    entityType: 'owner_payout_profile',
    entityId: params.ownerProfileId,
    metadata: {
      ibanLast4: last4Of(iban),
      beneficiaryRelationship: params.input.beneficiaryRelationship,
      nameMatchHint,
    },
    req: params.req,
  });

  return row;
}

/** Admin-only decrypted beneficiary fields for review comparison (never public). */
export async function getAdminPayoutBeneficiaryReviewBundle(ownerProfileId: string) {
  const profile = await prisma.ownerPayoutProfile.findUnique({
    where: { ownerProfileId },
    include: {
      contractingOperator: {
        select: {
          id: true,
          legalName: true,
          entityKind: true,
          isDefaultContractingOperator: true,
        },
      },
    },
  });
  const owner = await prisma.ownerProfile.findUnique({
    where: { id: ownerProfileId },
    select: {
      id: true,
      displayName: true,
      user: { select: { id: true, name: true, email: true } },
      verificationProfile: {
        select: {
          verificationStatus: true,
          legalName: true,
          accountHolderRelation: true,
        },
      },
    },
  });
  if (!owner) throw new AppError(404, 'NOT_FOUND', 'Partner not found');

  const operator =
    profile?.contractingOperator ??
    (await resolveDefaultContractingOperator(ownerProfileId));

  let beneficiaryName: string | null = null;
  let bankName: string | null = null;
  let ibanFull: string | null = null;
  if (profile) {
    try {
      beneficiaryName = decryptPartnerField(profile.beneficiaryNameCipher);
      bankName = decryptPartnerField(profile.bankNameCipher);
      ibanFull = decryptPartnerField(profile.ibanCipher);
    } catch {
      beneficiaryName = null;
      bankName = null;
      ibanFull = null;
    }
  }

  const readiness = evaluateOwnerPayoutProfileReadiness(profile);

  return {
    accountHolder: {
      userId: owner.user.id,
      name: owner.user.name,
      email: owner.user.email,
      displayName: owner.displayName,
      accountHolderRelation: owner.verificationProfile?.accountHolderRelation ?? null,
    },
    contractingOperator: operator
      ? {
          id: operator.id,
          legalName: operator.legalName,
          entityKind: operator.entityKind,
          isDefaultContractingOperator: operator.isDefaultContractingOperator,
        }
      : null,
    kycStatus: owner.verificationProfile?.verificationStatus ?? null,
    kycLegalName: owner.verificationProfile?.legalName ?? null,
    payout: profile
      ? {
          complete: true,
          beneficiaryName,
          bankName,
          ibanMasked: `••••${profile.ibanLast4}`,
          /** Full IBAN only for authorised admin review — never log */
          ibanFull,
          ibanLast4: profile.ibanLast4,
          beneficiaryRelationship: profile.beneficiaryRelationship,
          payoutCountry: profile.payoutCountry,
          nameMatchHint: profile.nameMatchHint,
          reviewStatus: profile.reviewStatus,
          reviewReason: profile.reviewReason,
          reviewReasonCategory: profile.reviewReasonCategory,
          reviewedAt: profile.reviewedAt?.toISOString() ?? null,
          updatedAt: profile.updatedAt.toISOString(),
          readiness: readiness.result,
          blockers: readiness.blockers,
          counselThirdPartyFlag: PAYOUT_THIRD_PARTY_BENEFICIARY_COUNSEL_CONFIRMATION_REQUIRED,
        }
      : {
          complete: false,
          readiness: 'NOT_CONFIGURED' as const,
          blockers: ['PAYOUT_PROFILE_MISSING'],
        },
  };
}

export async function applyAdminPayoutBeneficiaryDecision(params: {
  ownerProfileId: string;
  actorUserId: string;
  status: 'reviewed' | 'rejected' | 'action_required' | 'reassessment_required';
  reason?: string | null;
  reasonCategory?: string | null;
  req?: AuthenticatedRequest;
}) {
  if (
    (params.status === 'rejected' || params.status === 'action_required') &&
    !(params.reason ?? '').trim()
  ) {
    throw new AppError(400, 'REASON_REQUIRED', 'A reason is required for this payout decision');
  }
  const payout = await prisma.ownerPayoutProfile.findUnique({
    where: { ownerProfileId: params.ownerProfileId },
  });
  if (!payout) throw new AppError(404, 'NOT_FOUND', 'Payout profile not found');

  const statusMap: Record<string, OwnerPayoutReviewStatus> = {
    reviewed: OwnerPayoutReviewStatus.reviewed,
    rejected: OwnerPayoutReviewStatus.rejected,
    action_required: OwnerPayoutReviewStatus.action_required,
    reassessment_required: OwnerPayoutReviewStatus.reassessment_required,
  };
  const next = statusMap[params.status]!;
  const previous = payout.reviewStatus;

  const updated = await prisma.ownerPayoutProfile.update({
    where: { id: payout.id },
    data: {
      reviewStatus: next,
      reviewReason: params.reason?.trim() || null,
      reviewReasonCategory: params.reasonCategory?.trim() || null,
      reviewedByUserId: params.actorUserId,
      reviewedAt: new Date(),
    },
  });

  await recordReviewEvent({
    payoutProfileId: payout.id,
    ownerProfileId: params.ownerProfileId,
    actorUserId: params.actorUserId,
    previousStatus: previous,
    newStatus: next,
    reasonCategory: params.reasonCategory,
    reason: params.reason,
    ibanLast4: payout.ibanLast4,
    beneficiaryRelationship: payout.beneficiaryRelationship,
    nameMatchHint: payout.nameMatchHint,
  });

  await createAuditLog({
    actorUserId: params.actorUserId,
    action: 'admin.partner_payout_reviewed',
    entityType: 'owner_payout_profile',
    entityId: payout.id,
    metadata: {
      ownerProfileId: params.ownerProfileId,
      status: params.status,
      reasonCategory: params.reasonCategory ?? null,
      ibanLast4: payout.ibanLast4,
      beneficiaryRelationship: payout.beneficiaryRelationship,
    },
    req: params.req,
  });

  return updated;
}

/** Read-only preflight — no Personal Data / no full IBAN. */
export async function runPayoutBeneficiaryPreflightReport() {
  const profiles = await prisma.ownerPayoutProfile.findMany({
    select: {
      id: true,
      reviewStatus: true,
      beneficiaryRelationship: true,
      nameMatchHint: true,
      ibanLast4: true,
      ibanCipher: true,
      beneficiaryNameCipher: true,
      contractingOperatorPartyId: true,
      ownerProfileId: true,
      contractingOperator: { select: { entityKind: true, legalName: true } },
    },
  });

  let approved = 0;
  let underReview = 0;
  let actionRequired = 0;
  let rejected = 0;
  let reassessment = 0;
  let missingRelationship = 0;
  let missingBeneficiaryName = 0;
  let invalidIbanFormat = 0;
  let thirdParty = 0;
  let matchLikely = 0;
  let reviewRequiredMatch = 0;
  let clearMismatch = 0;
  let individualOperators = 0;
  let legalEntityOperators = 0;

  for (const p of profiles) {
    if (p.reviewStatus === OwnerPayoutReviewStatus.reviewed) approved += 1;
    else if (p.reviewStatus === OwnerPayoutReviewStatus.pending) underReview += 1;
    else if (p.reviewStatus === OwnerPayoutReviewStatus.action_required) actionRequired += 1;
    else if (p.reviewStatus === OwnerPayoutReviewStatus.rejected) rejected += 1;
    else if (p.reviewStatus === OwnerPayoutReviewStatus.reassessment_required) reassessment += 1;

    if (!p.beneficiaryRelationship) missingRelationship += 1;
    if (
      p.beneficiaryRelationship === PayoutBeneficiaryRelationship.authorised_third_party ||
      p.beneficiaryRelationship === PayoutBeneficiaryRelationship.other_review_required
    ) {
      thirdParty += 1;
    }
    if (p.nameMatchHint === PayoutBeneficiaryNameMatchHint.match_likely) matchLikely += 1;
    if (p.nameMatchHint === PayoutBeneficiaryNameMatchHint.review_required) reviewRequiredMatch += 1;
    if (p.nameMatchHint === PayoutBeneficiaryNameMatchHint.clear_mismatch) clearMismatch += 1;

    const kind = p.contractingOperator?.entityKind;
    if (kind === 'individual') individualOperators += 1;
    if (kind === 'legal_entity' || kind === 'sole_establishment') legalEntityOperators += 1;

    try {
      const name = decryptPartnerField(p.beneficiaryNameCipher);
      if (!name.trim()) missingBeneficiaryName += 1;
    } catch {
      missingBeneficiaryName += 1;
    }
    try {
      const iban = decryptPartnerField(p.ibanCipher);
      if (!isStructurallyValidIban(iban)) invalidIbanFormat += 1;
    } catch {
      invalidIbanFormat += 1;
    }
  }

  const readyOwners = profiles.filter((p) => evaluateOwnerPayoutProfileReadiness(p).ready);
  const readyOwnerIds = new Set(readyOwners.map((p) => p.ownerProfileId));

  const pendingSettlements = await prisma.ownerSettlement.findMany({
    where: { status: { in: ['draft', 'ready'] } },
    select: { id: true, ownerId: true, status: true },
  });
  const blockedPendingSettlements = pendingSettlements.filter((s) => !readyOwnerIds.has(s.ownerId))
    .length;

  return {
    generatedAt: new Date().toISOString(),
    mutation: false,
    note: 'Read-only. No full IBAN. No Personal Data dump. Legacy reviewed rows are not fabricated as OperatorParty-matched.',
    counsel: {
      PAYOUT_THIRD_PARTY_BENEFICIARY_COUNSEL_CONFIRMATION_REQUIRED,
    },
    counts: {
      totalPayoutProfiles: profiles.length,
      reviewedApprovedStatus: approved,
      underReviewPending: underReview,
      actionRequired,
      rejected,
      reassessmentRequired: reassessment,
      missingBeneficiaryRelationship: missingRelationship,
      missingBeneficiaryName,
      invalidIbanFormat,
      thirdPartyRelationshipCandidates: thirdParty,
      nameMatchLikely: matchLikely,
      nameMatchReviewRequired: reviewRequiredMatch,
      nameMatchClearMismatch: clearMismatch,
      individualOperatorLinked: individualOperators,
      legalEntityOrSoleEstablishmentLinked: legalEntityOperators,
      pendingSettlementsWhoseReleaseWouldBeBlocked: blockedPendingSettlements,
      payoutReadyProfiles: readyOwners.length,
    },
  };
}
