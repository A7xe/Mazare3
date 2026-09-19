/**
 * Phase 3C.4D.7A — Central Owner payout-beneficiary readiness.
 * Blocks actual payout RELEASE only — not publication, Booking, earnings recognition.
 */
import {
  OwnerPayoutReviewStatus,
  PayoutBeneficiaryRelationship,
  prisma,
  type OwnerPayoutProfile,
} from '@mazare3/db';
import {
  PAYOUT_THIRD_PARTY_BENEFICIARY_COUNSEL_CONFIRMATION_REQUIRED,
} from '@mazare3/shared';
import { AppError } from './errors.js';

/** Derived payout-release readiness (persisted reviewStatus is separate). */
export type OwnerPayoutReadinessResult =
  | 'READY'
  | 'NOT_CONFIGURED'
  | 'UNDER_REVIEW'
  | 'ACTION_REQUIRED'
  | 'REJECTED'
  | 'REASSESSMENT_REQUIRED';

/** Legacy view/API concept — kept for Owner UI compatibility. */
export type OwnerPayoutReadiness =
  | 'not_configured'
  | 'pending_review'
  | 'ready'
  | 'needs_attention';

export type OwnerPayoutReadinessEvaluation = {
  result: OwnerPayoutReadinessResult;
  ready: boolean;
  /** Owner-safe blocker codes (no Personal Data). */
  blockers: string[];
  reviewStatus: OwnerPayoutReviewStatus | null;
  beneficiaryRelationship: PayoutBeneficiaryRelationship | null;
  nameMatchHint: string | null;
  legacyCompatibility: OwnerPayoutReadiness;
};

function toLegacyReadiness(result: OwnerPayoutReadinessResult): OwnerPayoutReadiness {
  if (result === 'READY') return 'ready';
  if (result === 'NOT_CONFIGURED') return 'not_configured';
  if (result === 'ACTION_REQUIRED' || result === 'REJECTED' || result === 'REASSESSMENT_REQUIRED') {
    return 'needs_attention';
  }
  return 'pending_review';
}

export function evaluateOwnerPayoutProfileReadiness(
  profile: Pick<
    OwnerPayoutProfile,
    'reviewStatus' | 'beneficiaryRelationship' | 'nameMatchHint'
  > | null | undefined,
): OwnerPayoutReadinessEvaluation {
  if (!profile) {
    return {
      result: 'NOT_CONFIGURED',
      ready: false,
      blockers: ['PAYOUT_PROFILE_MISSING'],
      reviewStatus: null,
      beneficiaryRelationship: null,
      nameMatchHint: null,
      legacyCompatibility: 'not_configured',
    };
  }

  const blockers: string[] = [];
  const rel = profile.beneficiaryRelationship;
  const status = profile.reviewStatus;

  if (status === OwnerPayoutReviewStatus.rejected) {
    return {
      result: 'REJECTED',
      ready: false,
      blockers: ['PAYOUT_BENEFICIARY_REJECTED'],
      reviewStatus: status,
      beneficiaryRelationship: rel,
      nameMatchHint: profile.nameMatchHint,
      legacyCompatibility: 'needs_attention',
    };
  }
  if (status === OwnerPayoutReviewStatus.action_required) {
    return {
      result: 'ACTION_REQUIRED',
      ready: false,
      blockers: ['PAYOUT_ACTION_REQUIRED'],
      reviewStatus: status,
      beneficiaryRelationship: rel,
      nameMatchHint: profile.nameMatchHint,
      legacyCompatibility: 'needs_attention',
    };
  }
  if (status === OwnerPayoutReviewStatus.reassessment_required) {
    return {
      result: 'REASSESSMENT_REQUIRED',
      ready: false,
      blockers: ['PAYOUT_REASSESSMENT_REQUIRED'],
      reviewStatus: status,
      beneficiaryRelationship: rel,
      nameMatchHint: profile.nameMatchHint,
      legacyCompatibility: 'needs_attention',
    };
  }
  if (status === OwnerPayoutReviewStatus.pending) {
    return {
      result: 'UNDER_REVIEW',
      ready: false,
      blockers: ['PAYOUT_UNDER_REVIEW'],
      reviewStatus: status,
      beneficiaryRelationship: rel,
      nameMatchHint: profile.nameMatchHint,
      legacyCompatibility: 'pending_review',
    };
  }

  // OwnerPayoutReviewStatus.reviewed — further relationship/counsel gates may still block READY
  if (status !== OwnerPayoutReviewStatus.reviewed) {
    return {
      result: 'UNDER_REVIEW',
      ready: false,
      blockers: ['PAYOUT_UNDER_REVIEW'],
      reviewStatus: status,
      beneficiaryRelationship: rel,
      nameMatchHint: profile.nameMatchHint,
      legacyCompatibility: 'pending_review',
    };
  }

  if (
    rel === PayoutBeneficiaryRelationship.authorised_third_party ||
    rel === PayoutBeneficiaryRelationship.other_review_required
  ) {
    if (PAYOUT_THIRD_PARTY_BENEFICIARY_COUNSEL_CONFIRMATION_REQUIRED) {
      blockers.push('PAYOUT_THIRD_PARTY_BENEFICIARY_COUNSEL_CONFIRMATION_REQUIRED');
    }
  }

  if (blockers.length > 0) {
    return {
      result: 'UNDER_REVIEW',
      ready: false,
      blockers,
      reviewStatus: status,
      beneficiaryRelationship: rel,
      nameMatchHint: profile.nameMatchHint,
      legacyCompatibility: 'pending_review',
    };
  }

  return {
    result: 'READY',
    ready: true,
    blockers: [],
    reviewStatus: status,
    beneficiaryRelationship: rel,
    nameMatchHint: profile.nameMatchHint,
    legacyCompatibility: 'ready',
  };
}

export function deriveOwnerPayoutReadiness(
  profile: { reviewStatus: OwnerPayoutReviewStatus; beneficiaryRelationship?: PayoutBeneficiaryRelationship | null; nameMatchHint?: string | null } | null | undefined,
): OwnerPayoutReadiness {
  return evaluateOwnerPayoutProfileReadiness(
    profile
      ? {
          reviewStatus: profile.reviewStatus,
          beneficiaryRelationship: profile.beneficiaryRelationship ?? null,
          nameMatchHint: (profile.nameMatchHint as never) ?? null,
        }
      : null,
  ).legacyCompatibility;
}

export function isOwnerPayoutReady(
  profile: {
    reviewStatus: OwnerPayoutReviewStatus;
    beneficiaryRelationship?: PayoutBeneficiaryRelationship | null;
    nameMatchHint?: string | null;
  } | null | undefined,
): boolean {
  return evaluateOwnerPayoutProfileReadiness(
    profile
      ? {
          reviewStatus: profile.reviewStatus,
          beneficiaryRelationship: profile.beneficiaryRelationship ?? null,
          nameMatchHint: (profile.nameMatchHint as never) ?? null,
        }
      : null,
  ).ready;
}

export async function evaluateOwnerPayoutReadiness(
  ownerProfileId: string,
): Promise<OwnerPayoutReadinessEvaluation> {
  const profile = await prisma.ownerPayoutProfile.findUnique({
    where: { ownerProfileId },
    select: {
      reviewStatus: true,
      beneficiaryRelationship: true,
      nameMatchHint: true,
    },
  });
  return evaluateOwnerPayoutProfileReadiness(profile);
}

/** Narrow financial boundary: real money movement requires READY payout beneficiary. */
export async function assertOwnerHasReviewedPayoutDestination(
  ownerProfileId: string,
): Promise<void> {
  const evaluation = await evaluateOwnerPayoutReadiness(ownerProfileId);
  if (!evaluation.ready) {
    throw new AppError(
      409,
      'PAYOUT_DESTINATION_REQUIRED',
      'Owner payout destination is incomplete or not ready for release',
      {
        payoutReadiness: evaluation.result,
        payoutReadinessLegacy: evaluation.legacyCompatibility,
        blockers: evaluation.blockers,
      },
    );
  }
}

/** Change-request / field keys that belong to post-approval payout, not Partner KYC. */
export function isPayoutRelatedFieldKey(fieldKey: string): boolean {
  const key = fieldKey.trim().toLowerCase();
  if (key === 'document:payout_proof') return true;
  if (key === 'payout' || key === 'payout_profile' || key === 'transfer') return true;
  if (key.includes('iban') || key.includes('payout')) return true;
  return false;
}

export { toLegacyReadiness };
