import type { Request, Response, NextFunction } from 'express';
import { prisma, OwnerStatus } from '@mazare3/db';
import type { UserRole } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { COOKIE_NAME, verifySession, type SessionPayload } from '../lib/jwt.js';
import { getUserById } from '../services/auth.service.js';

export interface AuthenticatedRequest extends Request {
  session?: SessionPayload;
  user?: Awaited<ReturnType<typeof getUserById>>;
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!token) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
  }

  try {
    req.session = verifySession(token);
    next();
  } catch {
    return next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired session'));
  }
}

export async function attachUser(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  if (!req.session) {
    return next();
  }
  const user = await getUserById(req.session.userId);
  if (!user) {
    return next(new AppError(401, 'UNAUTHORIZED', 'User not found or inactive'));
  }
  req.user = user;
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.session) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    }
    if (!roles.includes(req.session.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission for this action'));
    }
    next();
  };
}

export const requireAdmin = [requireAuth, requireRole('admin')] as const;
export const requireCustomer = [requireAuth, requireRole('customer', 'owner', 'admin')] as const;

/** Customer-only (for owner application). */
export const requireCustomerOnly = [requireAuth, requireRole('customer')] as const;

export async function requireApprovedOwner(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) {
  if (!req.session) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
  }
  if (req.session.role === 'admin') {
    return next();
  }
  if (req.session.role !== 'owner') {
    return next(new AppError(403, 'FORBIDDEN', 'Owner access only'));
  }
  const profile = await prisma.ownerProfile.findUnique({
    where: { userId: req.session.userId },
    select: { status: true },
  });
  if (!profile) {
    return next(new AppError(403, 'OWNER_NOT_APPROVED', 'Owner profile not approved'));
  }
  if (profile.status === OwnerStatus.suspended) {
    return next(new AppError(403, 'OWNER_SUSPENDED', 'Owner account is suspended'));
  }
  if (profile.status !== OwnerStatus.approved) {
    return next(new AppError(403, 'OWNER_NOT_APPROVED', 'Owner profile not approved'));
  }
  next();
}

export const requireApprovedOwnerChain = [
  requireAuth,
  attachUser,
  requireApprovedOwner,
] as const;
