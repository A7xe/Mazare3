/**
 * Admin Property status transition policy (PR-4).
 * Owner submit-review transitions are separate and not listed here.
 */

export const PROPERTY_STATUSES = [
  'draft',
  'pending_review',
  'changes_requested',
  'approved',
  'published',
  'unpublished',
  'suspended',
  'rejected',
] as const;

export type PropertyStatusValue = (typeof PROPERTY_STATUSES)[number];

/** Allowed admin PATCH targets from each current status. */
const ADMIN_TRANSITIONS: Record<PropertyStatusValue, readonly PropertyStatusValue[]> = {
  draft: [],
  pending_review: ['changes_requested', 'approved', 'rejected'],
  /** Owner resubmits via submit-review; admin may refresh active change reason only. */
  changes_requested: ['changes_requested'],
  approved: ['published', 'changes_requested'],
  published: ['unpublished', 'suspended', 'changes_requested'],
  unpublished: ['published', 'changes_requested'],
  /** No stored previous status — conservative restore to unpublished. */
  suspended: ['unpublished'],
  rejected: [],
};

export function getAllowedAdminPropertyTransitions(
  from: PropertyStatusValue | string,
): PropertyStatusValue[] {
  if (!isPropertyStatus(from)) return [];
  return [...ADMIN_TRANSITIONS[from]];
}

export function isPropertyStatus(value: string): value is PropertyStatusValue {
  return (PROPERTY_STATUSES as readonly string[]).includes(value);
}

/** True when admin may set `to` from `from` (includes changes_requested reason refresh). */
export function isAdminPropertyStatusTransitionAllowed(
  from: PropertyStatusValue | string,
  to: PropertyStatusValue | string,
): boolean {
  if (!isPropertyStatus(from) || !isPropertyStatus(to)) return false;
  return ADMIN_TRANSITIONS[from].includes(to);
}

/** Metadata-only refresh: changes_requested → changes_requested with new reason. */
export function isAdminPropertyChangeReasonRefresh(
  from: PropertyStatusValue | string,
  to: PropertyStatusValue | string,
): boolean {
  return from === 'changes_requested' && to === 'changes_requested';
}

export class InvalidPropertyStatusTransitionError extends Error {
  readonly code = 'INVALID_PROPERTY_STATUS_TRANSITION' as const;

  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Cannot transition property from ${from} to ${to}`);
    this.name = 'InvalidPropertyStatusTransitionError';
  }
}

export function assertAdminPropertyStatusTransition(
  from: PropertyStatusValue | string,
  to: PropertyStatusValue | string,
): void {
  if (!isAdminPropertyStatusTransitionAllowed(from, to)) {
    throw new InvalidPropertyStatusTransitionError(from, to);
  }
}

/** Statuses that require an owner-safe reason when target is changes_requested. */
export function adminTransitionRequiresChangeReason(to: PropertyStatusValue | string): boolean {
  return to === 'changes_requested';
}
