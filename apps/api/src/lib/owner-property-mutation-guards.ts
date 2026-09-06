import { PropertyStatus } from '@mazare3/db';
import { AppError } from './errors.js';

/** Core listing fields (title, location, media-via-PATCH, etc.) — draft / changes_requested only. */
const OWNER_LISTING_EDITABLE_STATUSES: PropertyStatus[] = [
  PropertyStatus.draft,
  PropertyStatus.changes_requested,
];

/**
 * Reject owner mutations that would change what Admin is reviewing.
 * Used for media + availability while status is pending_review.
 * Does not freeze published / approved operational management.
 */
export function assertOwnerNotPendingReview(status: PropertyStatus) {
  if (status === PropertyStatus.pending_review) {
    throw new AppError(
      403,
      'PROPERTY_NOT_EDITABLE',
      'Property cannot be edited while it is pending review',
    );
  }
}

/** Canonical core listing edit gate (draft | changes_requested). */
export function assertOwnerCanEditListingStatus(status: PropertyStatus) {
  if (!OWNER_LISTING_EDITABLE_STATUSES.includes(status)) {
    throw new AppError(
      403,
      'PROPERTY_NOT_EDITABLE',
      'Property cannot be edited in its current status',
    );
  }
}

export function isOwnerListingEditableStatus(status: PropertyStatus): boolean {
  return OWNER_LISTING_EDITABLE_STATUSES.includes(status);
}
