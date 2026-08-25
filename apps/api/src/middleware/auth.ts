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

/** Attach a session when a valid cookie is present; continue as anonymous otherwise. */
export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!token) {
    return next();
  }
  try {
    req.session = verifySession(token);
  } catch {
    /* public contact may proceed without a session */
  }
  next();
}

export async function optionalAttachUser(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) {
  if (!req.session) {
    return next();
  }
  const user = await getUserById(req.session.userId);
  if (user) {
    req.user = user;
  }
  next();
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
    const liveRole = req.user?.role ?? req.session.role;
    if (!roles.includes(liveRole as UserRole)) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission for this action'));
    }
    next();
  };
}

export const requireAdmin = [requireAuth, attachUser, requireRole('admin')] as const;
export const requireCustomer = [requireAuth, attachUser, requireRole('customer', 'owner', 'admin')] as const;

/** Customer-only (for owner application). Uses live DB role when attachUser ran. */
export const requireCustomerOnly = [requireAuth, attachUser, requireRole('customer')] as const;

export async function requireApprovedOwner(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) {
  if (!req.session) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
  }
  const user = req.user ?? (await getUserById(req.session.userId));
  if (!user || user.status !== 'active') {
    return next(new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account is not active'));
  }
  if (user.role === 'admin') {
    return next();
  }
  const profile = await prisma.ownerProfile.findUnique({
    where: { userId: req.session.userId },
    select: { status: true },
  });
  if (!profile) {
    return next(new AppError(403, 'OWNER_NOT_APPROVED', 'Owner profile not approved'));
  }
  if (profile.status === OwnerStatus.suspended) {
    if (req.method === 'GET') {
      return next();
    }
    return next(new AppError(403, 'OWNER_SUSPENDED', 'Owner account is suspended'));
  }
  if (profile.status !== OwnerStatus.approved) {
    return next(new AppError(403, 'OWNER_NOT_APPROVED', 'Owner profile not approved'));
  }
  if (user.role !== 'owner') {
    return next(new AppError(403, 'FORBIDDEN', 'Owner access only'));
  }
  next();
}

export const requireApprovedOwnerChain = [
  requireAuth,
  attachUser,
  requireApprovedOwner,
] as const;
