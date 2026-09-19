import type { NextFunction, Response } from 'express';
import { prisma } from '@mazare3/db';
import {
  hasPrivacyBreachCapability,
  type PrivacyBreachCapabilityCode,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import type { AuthenticatedRequest } from './auth.js';

export type PrivacyBreachAuthContext = {
  userId: string;
  superAdmin: boolean;
  capabilities: string[];
};

export async function loadPrivacyBreachAuthContext(
  userId: string,
): Promise<PrivacyBreachAuthContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      status: true,
      superAdmin: true,
      capabilityGrants: { select: { capability: true } },
    },
  });
  if (!user || user.status !== 'active') {
    throw new AppError(401, 'UNAUTHORIZED', 'User not found or inactive');
  }
  return {
    userId: user.id,
    superAdmin: user.superAdmin === true,
    capabilities: user.capabilityGrants.map((g) => g.capability),
  };
}

/**
 * Ordinary admin is NOT enough. Requires superAdmin or explicit privacy_breach_* grant.
 */
export function requirePrivacyBreachCapability(
  ...needed: PrivacyBreachCapabilityCode[]
) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.session?.userId) {
        return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
      }
      const ctx = await loadPrivacyBreachAuthContext(req.session.userId);
      if (!hasPrivacyBreachCapability(ctx.capabilities, needed, { superAdmin: ctx.superAdmin })) {
        return next(
          new AppError(
            403,
            'PRIVACY_BREACH_FORBIDDEN',
            'Ordinary admin cannot access personal-data breach records without privacy_breach capability or superAdmin',
          ),
        );
      }
      (req as AuthenticatedRequest & { privacyBreachAuth?: PrivacyBreachAuthContext }).privacyBreachAuth =
        ctx;
      next();
    } catch (err) {
      next(err);
    }
  };
}
