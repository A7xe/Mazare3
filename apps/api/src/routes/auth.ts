import { Router } from 'express';
import {
  forgotPasswordSchema,
  googleIdTokenSchema,
  identityLinkCompleteSchema,
  identityPhoneLinkStartSchema,
  identityPhoneLinkVerifySchema,
  loginSchema,
  phoneOtpCompleteSchema,
  phoneOtpStartSchema,
  phoneOtpVerifySchema,
  resetPasswordSchema,
  signupSchema,
} from '@mazare3/shared';
import { asyncHandler } from '../middleware/error-handler.js';
import {
  authRateLimiter,
  forgotPasswordRateLimiter,
  phoneOtpSendIdRateLimiter,
  phoneOtpSendIpRateLimiter,
  phoneOtpVerifyIdRateLimiter,
  phoneOtpVerifyIpRateLimiter,
  resetPasswordRateLimiter,
} from '../middleware/rate-limit.js';
import { requireAuth, attachUser, type AuthenticatedRequest } from '../middleware/auth.js';
import { COOKIE_NAME, getCookieOptions, signSession } from '../lib/jwt.js';
import {
  clearIdentityLinkCookie,
  IDENTITY_LINK_COOKIE_NAME,
  setIdentityLinkCookie,
} from '../lib/identity-link-intent.js';
import { prisma } from '@mazare3/db';
import { loginUser, signupCustomer, getUserById } from '../services/auth.service.js';
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from '../services/password-reset.service.js';
import {
  completePhoneProfile,
  startPhoneLinkOtp,
  startPhoneOtp,
  verifyPhoneLinkOtp,
  verifyPhoneOtp,
} from '../services/phone-auth.service.js';
import {
  authenticateWithGoogleIdToken,
  handleGoogleOAuthCallback,
  startGoogleLinkOAuth,
  startGoogleOAuth,
} from '../services/google/google-oauth-flow.js';
import { completeIdentityLink } from '../services/identity-link.service.js';
import { createAuditLog } from '../services/audit.service.js';
import { AppError } from '../lib/errors.js';
import { isGoogleAuthConfigured } from '../config/google-auth-config.js';
import { getAuthCapabilities } from '../services/auth-capabilities.service.js';
import { getAuthIdentitiesStatus } from '../services/auth-identities.service.js';

export const authRouter = Router();

/**
 * AUTH-5 credential/abuse IP limiter — applied only to mutation and
 * credential-sensitive routes. Read bootstrap endpoints (/capabilities, /me,
 * /identities) must NOT share this budget (normal UI refreshes would 429).
 */

/** UA-6 — public provider availability (no secrets). */
authRouter.get(
  '/capabilities',
  asyncHandler(async (_req, res) => {
    res.json({ data: getAuthCapabilities() });
  }),
);

/** UA-6 — authenticated connected-identity status. */
authRouter.get(
  '/identities',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getAuthIdentitiesStatus(req.session!.userId);
    res.json({ data });
  }),
);

authRouter.post(
  '/signup',
  authRateLimiter,
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
  authRateLimiter,
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
  '/phone/start',
  phoneOtpSendIpRateLimiter,
  phoneOtpSendIdRateLimiter,
  asyncHandler(async (req, res) => {
    const body = phoneOtpStartSchema.parse(req.body);
    const data = await startPhoneOtp(body);
    res.json({ data });
  }),
);

authRouter.post(
  '/phone/verify',
  phoneOtpVerifyIpRateLimiter,
  phoneOtpVerifyIdRateLimiter,
  asyncHandler(async (req, res) => {
    const body = phoneOtpVerifySchema.parse(req.body);
    const result = await verifyPhoneOtp(body);

    if (result.outcome === 'authenticated') {
      const token = signSession(result.session);
      res.cookie(COOKIE_NAME, token, getCookieOptions());
      await createAuditLog({
        actorUserId: result.session.userId,
        action: 'auth.phone_login',
        entityType: 'user',
        entityId: result.session.userId,
        req,
      });
      res.json({ data: { outcome: 'authenticated', user: result.user } });
      return;
    }

    if (result.outcome === 'existing_account_link_required') {
      setIdentityLinkCookie(res, result.linkToken);
      res.status(409).json({
        error: 'This phone is associated with an existing account. Sign in to link it later.',
        code: 'EXISTING_ACCOUNT_LINK_REQUIRED',
        data: {
          expiresInSeconds: result.expiresInSeconds,
        },
      });
      return;
    }

    res.json({
      data: {
        outcome: 'profile_required',
        continueToken: result.continueToken,
        expiresInSeconds: result.expiresInSeconds,
      },
    });
  }),
);

authRouter.post(
  '/phone/complete',
  phoneOtpVerifyIpRateLimiter,
  phoneOtpVerifyIdRateLimiter,
  asyncHandler(async (req, res) => {
    const body = phoneOtpCompleteSchema.parse(req.body);
    const result = await completePhoneProfile(body);
    const token = signSession(result.session);
    res.cookie(COOKIE_NAME, token, getCookieOptions());
    await createAuditLog({
      actorUserId: result.session.userId,
      action: 'auth.phone_signup',
      entityType: 'user',
      entityId: result.session.userId,
      req,
    });
    res.status(201).json({ data: { outcome: 'authenticated', user: result.user } });
  }),
);

/** UA-3 — Google OIDC Web start (redirect). Disabled without config. */
authRouter.get(
  '/google/start',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    if (!isGoogleAuthConfigured()) {
      throw new AppError(503, 'GOOGLE_AUTH_UNAVAILABLE', 'Google sign-in is not available');
    }
    await startGoogleOAuth(req, res);
  }),
);

/** UA-3 — Google OIDC Web callback. */
authRouter.get(
  '/google/callback',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    await handleGoogleOAuthCallback(req, res);
  }),
);

/**
 * UA-3 — Future Flutter Google ID-token path.
 * Same account resolver as Web callback. No Flutter client yet.
 */
authRouter.post(
  '/google/id-token',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    if (!isGoogleAuthConfigured()) {
      throw new AppError(503, 'GOOGLE_AUTH_UNAVAILABLE', 'Google sign-in is not available');
    }
    const body = googleIdTokenSchema.parse(req.body);
    const result = await authenticateWithGoogleIdToken(body);

    if (result.outcome === 'authenticated') {
      const token = signSession(result.session);
      res.cookie(COOKIE_NAME, token, getCookieOptions());
      await createAuditLog({
        actorUserId: result.session.userId,
        action: 'auth.google_login',
        entityType: 'user',
        entityId: result.session.userId,
        req,
      });
      res.json({ data: { outcome: 'authenticated', user: result.user } });
      return;
    }

    if (result.outcome === 'provider_not_allowed_for_privileged_account') {
      res.status(403).json({
        error: 'Google sign-in is not available for this account type',
        code: 'PROVIDER_NOT_ALLOWED_FOR_PRIVILEGED_ACCOUNT',
      });
      return;
    }

    setIdentityLinkCookie(res, result.linkToken);
    res.status(409).json({
      error: 'An account with this email already exists. Sign in to link Google later.',
      code: 'EXISTING_ACCOUNT_LINK_REQUIRED',
      data: {
        expiresInSeconds: result.expiresInSeconds,
      },
    });
  }),
);

/** UA-4 — complete pending IdentityLinkIntent (authenticated session required). */
authRouter.post(
  '/identities/link/complete',
  authRateLimiter,
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = identityLinkCompleteSchema.parse(req.body ?? {});
    const cookieToken =
      typeof req.cookies?.[IDENTITY_LINK_COOKIE_NAME] === 'string'
        ? (req.cookies[IDENTITY_LINK_COOKIE_NAME] as string)
        : null;
    const linkToken = body.linkToken ?? cookieToken;
    if (!linkToken) {
      throw new AppError(400, 'INVALID_LINK_INTENT', 'This linking step has expired. Please try again.');
    }

    const result = await completeIdentityLink({
      authenticatedUserId: req.session!.userId,
      linkIntentToken: linkToken,
    });

    clearIdentityLinkCookie(res);
    await createAuditLog({
      actorUserId: req.session!.userId,
      action: 'auth.identity_link_success',
      entityType: 'user',
      entityId: req.session!.userId,
      req,
      metadata: { provider: result.provider, outcome: result.outcome },
    });

    res.json({
      data: {
        outcome: result.outcome,
        provider: result.provider,
        user: result.user,
        returnUrl: result.returnUrl,
      },
    });
  }),
);

/** UA-4 — proactive phone link OTP start (authenticated). */
authRouter.post(
  '/identities/phone/start',
  requireAuth,
  phoneOtpSendIpRateLimiter,
  phoneOtpSendIdRateLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = identityPhoneLinkStartSchema.parse(req.body);
    const data = await startPhoneLinkOtp({
      authenticatedUserId: req.session!.userId,
      phone: body.phone,
      locale: body.locale,
    });
    res.json({ data });
  }),
);

/** UA-4 — proactive phone link OTP verify (authenticated). */
authRouter.post(
  '/identities/phone/verify',
  requireAuth,
  phoneOtpVerifyIpRateLimiter,
  phoneOtpVerifyIdRateLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = identityPhoneLinkVerifySchema.parse(req.body);
    const result = await verifyPhoneLinkOtp({
      authenticatedUserId: req.session!.userId,
      challengeId: body.challengeId,
      phone: body.phone,
      code: body.code,
    });
    await createAuditLog({
      actorUserId: req.session!.userId,
      action: 'auth.identity_link_success',
      entityType: 'user',
      entityId: req.session!.userId,
      req,
      metadata: { provider: 'phone', outcome: result.outcome },
    });
    res.json({ data: { outcome: result.outcome, user: result.user } });
  }),
);

/** UA-4 — proactive Google link OAuth start (authenticated). */
authRouter.get(
  '/identities/google/start',
  authRateLimiter,
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!isGoogleAuthConfigured()) {
      throw new AppError(503, 'GOOGLE_AUTH_UNAVAILABLE', 'Google sign-in is not available');
    }
    await startGoogleLinkOAuth(req, res, req.session!.userId);
  }),
);

authRouter.post(
  '/forgot-password',
  forgotPasswordRateLimiter,
  asyncHandler(async (req, res) => {
    const body = forgotPasswordSchema.parse(req.body);
    const result = await requestPasswordReset(body);
    const payload: { message: string; devResetLink?: string } = { message: result.message };
    if (result.devResetLink) {
      payload.devResetLink = result.devResetLink;
    }
    res.json({ data: payload });
  }),
);

authRouter.post(
  '/reset-password',
  resetPasswordRateLimiter,
  asyncHandler(async (req, res) => {
    const body = resetPasswordSchema.parse(req.body);
    await resetPasswordWithToken(body);

    // Clear any browser session cookie so the user must sign in with the new password.
    const cookieOpts = getCookieOptions();
    const { maxAge: _maxAge, ...clearOpts } = cookieOpts;
    res.clearCookie(COOKIE_NAME, clearOpts);

    res.json({
      data: {
        success: true,
        message: 'Password updated. You can now sign in with your new password.',
      },
    });
  }),
);

authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.session?.userId;
    const cookieOpts = getCookieOptions();
    const { maxAge: _maxAge, ...clearOpts } = cookieOpts;
    res.clearCookie(COOKIE_NAME, clearOpts);

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

authRouter.post(
  '/refresh-session',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.session!.userId },
      select: { id: true, email: true, role: true, status: true, passwordChangedAt: true },
    });
    if (!user || user.status !== 'active') {
      res.status(401).json({ error: 'User not found', code: 'UNAUTHORIZED' });
      return;
    }
    const token = signSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      pwdAt: user.passwordChangedAt?.getTime() ?? 0,
    });
    res.cookie(COOKIE_NAME, token, getCookieOptions());
    const full = await getUserById(user.id);
    res.json({ data: { user: full } });
  }),
);
