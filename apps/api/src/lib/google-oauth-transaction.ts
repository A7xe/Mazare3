import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { CookieOptions, Response } from 'express';
import {
  GOOGLE_OAUTH_COOKIE_NAME,
  GOOGLE_OAUTH_TX_TTL_MS,
} from '../config/google-auth-config.js';
import { getSessionCookieOptions } from './cookie-options.js';
import { AppError } from './errors.js';

export const GOOGLE_OAUTH_TX_TYP = 'google_oauth_tx';

export type GoogleOAuthMode = 'authenticate' | 'link';

export type GoogleOAuthTransaction = {
  typ: typeof GOOGLE_OAUTH_TX_TYP;
  state: string;
  nonce: string;
  codeVerifier: string;
  returnUrl: string | null;
  /** UA-4: authenticate (default) vs explicit link to an existing User. */
  mode: GoogleOAuthMode;
  /** Required when mode=link — bound authenticated User id. */
  linkUserId: string | null;
};

function getSecret(): string {
  const secret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET or SESSION_SECRET (min 32 chars) is required');
  }
  return secret;
}

export function generateOAuthState(): string {
  return randomBytes(32).toString('base64url');
}

export function generateOAuthNonce(): string {
  return randomBytes(32).toString('base64url');
}

export function generatePkceVerifier(): string {
  return randomBytes(32).toString('base64url');
}

/** PKCE S256 challenge (base64url SHA-256 of verifier). */
export function pkceS256Challenge(verifier: string): string {
  return createHash('sha256').update(verifier, 'utf8').digest('base64url');
}

export function signGoogleOAuthTransaction(
  payload: Omit<GoogleOAuthTransaction, 'typ'> & { mode?: GoogleOAuthMode; linkUserId?: string | null },
): string {
  const expiresInSec = Math.max(60, Math.floor(GOOGLE_OAUTH_TX_TTL_MS / 1000));
  const mode: GoogleOAuthMode = payload.mode ?? 'authenticate';
  const linkUserId = mode === 'link' ? (payload.linkUserId ?? null) : null;
  if (mode === 'link' && !linkUserId) {
    throw new Error('Google OAuth link mode requires linkUserId');
  }
  return jwt.sign(
    {
      typ: GOOGLE_OAUTH_TX_TYP,
      state: payload.state,
      nonce: payload.nonce,
      codeVerifier: payload.codeVerifier,
      returnUrl: payload.returnUrl,
      mode,
      linkUserId,
    },
    getSecret(),
    { expiresIn: expiresInSec, audience: GOOGLE_OAUTH_TX_TYP },
  );
}

export function verifyGoogleOAuthTransaction(raw: string): GoogleOAuthTransaction {
  try {
    const decoded = jwt.verify(raw, getSecret(), {
      audience: GOOGLE_OAUTH_TX_TYP,
    }) as GoogleOAuthTransaction & { mode?: GoogleOAuthMode; linkUserId?: string | null };
    if (
      decoded.typ !== GOOGLE_OAUTH_TX_TYP ||
      !decoded.state ||
      !decoded.nonce ||
      !decoded.codeVerifier
    ) {
      throw new AppError(400, 'INVALID_OAUTH_STATE', 'Google sign-in expired. Please try again.');
    }
    const mode: GoogleOAuthMode =
      decoded.mode === 'link' || decoded.mode === 'authenticate' ? decoded.mode : 'authenticate';
    const linkUserId = mode === 'link' ? (decoded.linkUserId ?? null) : null;
    if (mode === 'link' && !linkUserId) {
      throw new AppError(400, 'INVALID_OAUTH_STATE', 'Google sign-in expired. Please try again.');
    }
    return {
      typ: GOOGLE_OAUTH_TX_TYP,
      state: decoded.state,
      nonce: decoded.nonce,
      codeVerifier: decoded.codeVerifier,
      returnUrl: decoded.returnUrl ?? null,
      mode,
      linkUserId,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(400, 'INVALID_OAUTH_STATE', 'Google sign-in expired. Please try again.');
  }
}

export function getGoogleOAuthCookieOptions(): CookieOptions {
  const session = getSessionCookieOptions();
  return {
    httpOnly: true,
    secure: session.secure,
    // Lax is correct for top-level OAuth redirect GET callbacks.
    sameSite: 'lax',
    maxAge: GOOGLE_OAUTH_TX_TTL_MS,
    path: '/api/v1/auth/google',
    ...(session.domain ? { domain: session.domain } : {}),
  };
}

export function setGoogleOAuthCookie(res: Response, token: string): void {
  res.cookie(GOOGLE_OAUTH_COOKIE_NAME, token, getGoogleOAuthCookieOptions());
}

export function clearGoogleOAuthCookie(res: Response): void {
  const opts = getGoogleOAuthCookieOptions();
  const { maxAge: _m, ...clearOpts } = opts;
  res.clearCookie(GOOGLE_OAUTH_COOKIE_NAME, clearOpts);
}

export function timingSafeEqualString(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
