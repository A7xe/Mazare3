import { PartnerVerificationStatus } from '@mazare3/db';
import { AppError } from './errors.js';

const EDITABLE: PartnerVerificationStatus[] = [
  PartnerVerificationStatus.draft,
  PartnerVerificationStatus.changes_requested,
];

const OWNER_SUBMIT_FROM: PartnerVerificationStatus[] = [
  PartnerVerificationStatus.draft,
  PartnerVerificationStatus.changes_requested,
];

export function canOwnerEditOnboarding(status: PartnerVerificationStatus): boolean {
  return EDITABLE.includes(status);
}

export function canOwnerSubmitOnboarding(status: PartnerVerificationStatus): boolean {
  return OWNER_SUBMIT_FROM.includes(status);
}

export function assertOwnerCanEdit(status: PartnerVerificationStatus): void {
  if (!canOwnerEditOnboarding(status)) {
    throw new AppError(
      409,
      'ONBOARDING_READ_ONLY',
      'This application is read-only until the platform requests changes',
    );
  }
}

export function nextStatusOnSubmit(current: PartnerVerificationStatus): PartnerVerificationStatus {
  if (!canOwnerSubmitOnboarding(current)) {
    throw new AppError(
      409,
      'CANNOT_SUBMIT',
      'This application cannot be submitted in its current status',
    );
  }
  return PartnerVerificationStatus.submitted;
}

export function nextStatusOnAdminReviewStart(
  current: PartnerVerificationStatus,
): PartnerVerificationStatus {
  if (current === PartnerVerificationStatus.submitted) {
    return PartnerVerificationStatus.under_review;
  }
  return current;
}

export function isOperationallyApproved(status: PartnerVerificationStatus): boolean {
  return (
    status === PartnerVerificationStatus.approved ||
    status === PartnerVerificationStatus.legacy_approved
  );
}

export function restoreTargetStatus(
  previous: PartnerVerificationStatus | null,
): PartnerVerificationStatus {
  if (previous === PartnerVerificationStatus.legacy_approved) {
    return PartnerVerificationStatus.legacy_approved;
  }
  return PartnerVerificationStatus.approved;
}
