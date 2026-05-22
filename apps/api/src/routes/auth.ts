import { Router } from 'express';
import { loginSchema, signupSchema } from '@mazare3/shared';
import { asyncHandler } from '../middleware/error-handler.js';
import { authRateLimiter } from '../middleware/rate-limit.js';
import { requireAuth, attachUser, type AuthenticatedRequest } from '../middleware/auth.js';
import { COOKIE_NAME, getCookieOptions, signSession } from '../lib/jwt.js';
import { loginUser, signupCustomer, getUserById } from '../services/auth.service.js';
import { createAuditLog } from '../services/audit.service.js';

export const authRouter = Router();

authRouter.use(authRateLimiter);

authRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const body = signupSchema.parse(req.body);
    const session = await signupCustomer(body);
    const token = signSession(session);

    res.cookie(COOKIE_NAME, token, getCookieOptions());
    await createAuditLog({
      actorUserId: session.userId,
      action: 'auth.signup',
      entityType: 'user',
      entityId: session.userId,
      req,
    });

    const user = await getUserById(session.userId);
    res.status(201).json({ data: { user } });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const session = await loginUser(body);
    const token = signSession(session);

    res.cookie(COOKIE_NAME, token, getCookieOptions());
    await createAuditLog({
      actorUserId: session.userId,
      action: 'auth.login',
      entityType: 'user',
      entityId: session.userId,
      req,
    });

    const user = await getUserById(session.userId);
    res.json({ data: { user } });
  }),
);

authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.session?.userId;
    res.clearCookie(COOKIE_NAME, { path: '/' });

    if (userId) {
      await createAuditLog({
        actorUserId: userId,
        action: 'auth.logout',
        entityType: 'user',
        entityId: userId,
        req,
      });
    }

    res.json({ data: { success: true } });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  attachUser,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    res.json({ data: { user: req.user } });
  }),
);
