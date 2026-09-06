/**
 * UA-3 / UA-4 — Google OIDC Web start/callback + link mode + ID-token entry.
 */
import type { Request, Response } from 'express';
import { sanitizeReturnUrl } from '@mazare3/shared';
import {
  getFrontendOrigin,
  GOOGLE_OAUTH_COOKIE_NAME,
  isGoogleAuthConfigured,
} from '../../config/google-auth-config.js';
import { AppError } from '../../lib/errors.js';
import { COOKIE_NAME, getCookieOptions, signSession } from '../../lib/jwt.js';
import {
  clearIdentityLinkCookie,
  IDENTITY_LINK_COOKIE_NAME,
  setIdentityLinkCookie,
} from '../../lib/identity-link-intent.js';
import {
  clearGoogleOAuthCookie,
  setGoogleOAuthCookie,
  signGoogleOAuthTransaction,
  timingSafeEqualString,
  verifyGoogleOAuthTransaction,
} from '../../lib/google-oauth-transaction.js';
import { createAuditLog } from '../audit.service.js';
import {
  assertUserMayLinkIdentities,
  linkProviderToAuthenticatedUser,
} from '../identity-link.service.js';
import { resolveGoogleIdentity, type GoogleAuthResult } from './google-auth.service.js';
import {
  buildGoogleAuthorizationRequest,
  exchangeGoogleAuthorizationCode,
  verifyGoogleIdToken,
  type VerifiedGoogleIdentity,
} from './google-oidc-client.js';

function sanitizeGoogleReturnUrl(raw: string | null | undefined): string | null {
  const safe = sanitizeReturnUrl(raw);
  if (!safe) return null;
  if (safe === '/auth' || safe.startsWith('/auth/') || safe.startsWith('/auth?')) {
    return null;
  }
  return safe;
}

export function assertGoogleAuthAvailable(): void {
  if (!isGoogleAuthConfigured()) {
    throw new AppError(503, 'GOOGLE_AUTH_UNAVAILABLE', 'Google sign-in is not available');
  }
}

export async function startGoogleOAuth(req: Request, res: Response): Promise<void> {
  assertGoogleAuthAvailable();
  const returnUrl = sanitizeGoogleReturnUrl(
    typeof req.query.returnUrl === 'string' ? req.query.returnUrl : null,
  );

  const started = await buildGoogleAuthorizationRequest();
  const tx = signGoogleOAuthTransaction({
    state: started.state,
    nonce: started.nonce,
    codeVerifier: started.codeVerifier,
    returnUrl,
    mode: 'authenticate',
    linkUserId: null,
  });
  setGoogleOAuthCookie(res, tx);
  res.redirect(302, started.authorizationUrl);
}

/** UA-4 — authenticated proactive Google link (OAuth mode=link). */
export async function startGoogleLinkOAuth(
  req: Request,
  res: Response,
  authenticatedUserId: string,
): Promise<void> {
  assertGoogleAuthAvailable();
  await assertUserMayLinkIdentities(authenticatedUserId);
  const returnUrl = sanitizeGoogleReturnUrl(
    typeof req.query.returnUrl === 'string' ? req.query.returnUrl : null,
  );

  const started = await buildGoogleAuthorizationRequest();
  const tx = signGoogleOAuthTransaction({
    state: started.state,
    nonce: started.nonce,
    codeVerifier: started.codeVerifier,
    returnUrl,
    mode: 'link',
    linkUserId: authenticatedUserId,
  });
  setGoogleOAuthCookie(res, tx);
  res.redirect(302, started.authorizationUrl);
}

function frontendRedirect(pathWithQuery: string): string {
  const origin = getFrontendOrigin();
  const path = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
  return `${origin}${path}`;
}

function authErrorRedirect(code: string, returnUrl?: string | null): string {
  const q = new URLSearchParams({ authError: code });
  if (returnUrl) q.set('returnUrl', returnUrl);
  return frontendRedirect(`/auth?${q.toString()}`);
}

function successRedirect(returnUrl: string | null): string {
  return frontendRedirect(returnUrl ?? '/');
}

async function applyGoogleAuthResult(
  req: Request,
  res: Response,
  result: GoogleAuthResult,
  returnUrl: string | null,
): Promise<void> {
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
    res.redirect(302, successRedirect(returnUrl));
    return;
  }

  if (result.outcome === 'provider_not_allowed_for_privileged_account') {
    res.redirect(302, authErrorRedirect('PROVIDER_NOT_ALLOWED_FOR_PRIVILEGED_ACCOUNT', returnUrl));
    return;
  }

  // UA-4 — pending IdentityLinkIntent in HttpOnly cookie (also keep opaque token for mobile).
  setIdentityLinkCookie(res, result.linkToken);
  res.redirect(302, authErrorRedirect('EXISTING_ACCOUNT_LINK_REQUIRED', returnUrl));
}

export async function handleGoogleOAuthCallback(req: Request, res: Response): Promise<void> {
  try {
    assertGoogleAuthAvailable();

    const rawCookie = req.cookies?.[GOOGLE_OAUTH_COOKIE_NAME];
    if (!rawCookie || typeof rawCookie !== 'string') {
      clearGoogleOAuthCookie(res);
      res.redirect(302, authErrorRedirect('INVALID_OAUTH_STATE'));
      return;
    }

    let tx;
    try {
      tx = verifyGoogleOAuthTransaction(rawCookie);
    } catch {
      clearGoogleOAuthCookie(res);
      res.redirect(302, authErrorRedirect('INVALID_OAUTH_STATE'));
      return;
    }

    clearGoogleOAuthCookie(res);

    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!state || !timingSafeEqualString(state, tx.state)) {
      res.redirect(302, authErrorRedirect('INVALID_OAUTH_STATE'));
      return;
    }

    if (typeof req.query.error === 'string' && req.query.error) {
      console.warn('[api] google: provider authorization error', {
        provider: 'google',
        category: 'authorization_denied',
      });
      res.redirect(302, authErrorRedirect('GOOGLE_AUTH_FAILED'));
      return;
    }

    if (typeof req.query.code !== 'string' || !req.query.code) {
      res.redirect(302, authErrorRedirect('GOOGLE_AUTH_FAILED'));
      return;
    }

    const { loadGoogleAuthConfig } = await import('../../config/google-auth-config.js');
    const cfg = loadGoogleAuthConfig();
    if (!cfg) {
      res.redirect(302, authErrorRedirect('GOOGLE_AUTH_UNAVAILABLE'));
      return;
    }
    const callbackUrl = new URL(cfg.redirectUri);
    callbackUrl.search = new URL(req.originalUrl, 'http://localhost').search;

    const identity = await exchangeGoogleAuthorizationCode({
      callbackUrl,
      codeVerifier: tx.codeVerifier,
      expectedState: tx.state,
      expectedNonce: tx.nonce,
    });

    // UA-4 — link mode must NOT run anonymous create/login resolution.
    if (tx.mode === 'link') {
      if (!tx.linkUserId) {
        res.redirect(302, authErrorRedirect('INVALID_OAUTH_STATE'));
        return;
      }
      // Prefer bound userId from OAuth tx; session cookie may also be present.
      const sessionUserId =
        (req as { session?: { userId?: string } }).session?.userId ?? tx.linkUserId;
      if (sessionUserId !== tx.linkUserId) {
        res.redirect(302, authErrorRedirect('IDENTITY_LINK_ACCOUNT_MISMATCH'));
        return;
      }
      try {
        const linked = await linkProviderToAuthenticatedUser({
          authenticatedUserId: tx.linkUserId,
          provider: 'google',
          providerSubject: identity.sub,
          verifiedEmail: identity.email,
          emailVerified: identity.emailVerified,
        });
        await createAuditLog({
          actorUserId: tx.linkUserId,
          action: 'auth.identity_link_success',
          entityType: 'user',
          entityId: tx.linkUserId,
          req,
          metadata: { provider: 'google', outcome: linked.outcome },
        });
        res.redirect(302, successRedirect(tx.returnUrl));
      } catch (err) {
        const code = err instanceof AppError ? err.code : 'GOOGLE_AUTH_FAILED';
        res.redirect(302, authErrorRedirect(code));
      }
      return;
    }

    const result = await resolveGoogleIdentity(identity);
    await applyGoogleAuthResult(req, res, result, tx.returnUrl);
  } catch (err) {
    clearGoogleOAuthCookie(res);
    const code = err instanceof AppError ? err.code : 'GOOGLE_AUTH_FAILED';
    console.warn('[api] google: callback failed', {
      provider: 'google',
      category: 'callback',
      code,
    });
    res.redirect(302, authErrorRedirect(code));
  }
}

export async function authenticateWithGoogleIdToken(input: {
  idToken: string;
  locale?: 'ar' | 'en';
}): Promise<GoogleAuthResult> {
  assertGoogleAuthAvailable();
  const identity = await verifyGoogleIdToken(input.idToken);
  return resolveGoogleIdentity(identity, { locale: input.locale });
}

export async function resolveVerifiedGoogleIdentityForQa(
  identity: VerifiedGoogleIdentity,
  opts?: { locale?: 'ar' | 'en' },
): Promise<GoogleAuthResult> {
  return resolveGoogleIdentity(identity, opts);
}

export { IDENTITY_LINK_COOKIE_NAME, clearIdentityLinkCookie, setIdentityLinkCookie };
