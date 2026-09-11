import { OwnerPayoutReviewStatus, prisma } from '@mazare3/db';
import { AppError } from './errors.js';

/** Derived view/API concept — not a persisted enum. */
export type OwnerPayoutReadiness =
  | 'not_configured'
  | 'pending_review'
  | 'ready'
  | 'needs_attention';

export function deriveOwnerPayoutReadiness(
  profile: { reviewStatus: OwnerPayoutReviewStatus } | null | undefined,
): OwnerPayoutReadiness {
  if (!profile) return 'not_configured';
  if (profile.reviewStatus === OwnerPayoutReviewStatus.reviewed) return 'ready';
  if (profile.reviewStatus === OwnerPayoutReviewStatus.rejected) return 'needs_attention';
  return 'pending_review';
}

export function isOwnerPayoutReady(
  profile: { reviewStatus: OwnerPayoutReviewStatus } | null | undefined,
): boolean {
  return deriveOwnerPayoutReadiness(profile) === 'ready';
}

/** Narrow financial boundary: real money movement requires a reviewed destination. */
export async function assertOwnerHasReviewedPayoutDestination(
  ownerProfileId: string,
): Promise<void> {
  const profile = await prisma.ownerPayoutProfile.findUnique({
    where: { ownerProfileId },
    select: { reviewStatus: true },
  });
  if (!isOwnerPayoutReady(profile)) {
    throw new AppError(
      409,
      'PAYOUT_DESTINATION_REQUIRED',
      'Owner payout destination is incomplete or not reviewed',
      { payoutReadiness: deriveOwnerPayoutReadiness(profile) },
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
