import type { PropertyStatus } from '@mazare3/db';
import {
  assertAdminPropertyStatusTransition,
  isAdminPropertyChangeReasonRefresh,
  type PropertyStatusValue,
} from '@mazare3/shared';
import { AppError } from './errors.js';

export {
  assertAdminPropertyStatusTransition,
  getAllowedAdminPropertyTransitions,
  isAdminPropertyChangeReasonRefresh,
  isAdminPropertyStatusTransitionAllowed,
  isPropertyStatus,
} from '@mazare3/shared';

export function assertAdminPropertyStatusTransitionOrThrow(
  from: PropertyStatus,
  to: PropertyStatusValue,
): void {
  try {
    assertAdminPropertyStatusTransition(from, to);
  } catch {
    throw new AppError(
      400,
      'INVALID_PROPERTY_STATUS_TRANSITION',
      `Cannot transition property from ${from} to ${to}`,
      { from, to },
    );
  }
}
