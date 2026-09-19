import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.js';
import { AppError } from '../lib/errors.js';
import { assertCustomerTermsAcceptance } from '../services/legal/legal-reacceptance.service.js';

/**
 * Soft-gate: requires recorded Terms acceptance before contractual customer actions.
 * Does not invent acceptances — returns 403 LEGAL_ACCEPTANCE_REQUIRED when missing/reacceptance.
 */
export function requireTermsAcceptance(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) {
  const userId = req.session?.userId;
  if (!userId) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
  }
  void assertCustomerTermsAcceptance(userId)
    .then(() => next())
    .catch((err: unknown) => next(err));
}
