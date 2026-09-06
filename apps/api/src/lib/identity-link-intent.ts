/**
 * UA-4 — Unified IdentityLinkIntent (signed; not a session).
 * Web: HttpOnly cookie. Mobile: same token in API body.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { CookieOptions, Response } from 'express';
import { getSessionCookieOptions } from './cookie-options.js';
import { AppError } from './errors.js';

export const IDENTITY_LINK_INTENT_TYP = 'identity_link';
export const IDENTITY_LINK_COOKIE_NAME = 'mazare3_identity_link';
export const IDENTITY_LINK_TTL_MS = 10 * 60 * 1000;

export type IdentityLinkProvider = 'phone' | 'google';

export type IdentityLinkIntent = {
  typ: typeof IDENTITY_LINK_INTENT_TYP;
  /** Unique id for replay detection / logging (not a secret). */
  jti: string;
  provider: IdentityLinkProvider;
  providerSubject: string;
  intendedUserId: string;
  /** Optional verified Google email (never used as identity key). */
  verifiedEmail?: string | null;
  returnUrl?: string | null;
  /** Provider proof timestamp (ms). */
  verifiedAt: number;
};

function getSecret(): string {
  const secret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET or SESSION_SECRET (min 32 chars) is required');
  }
  return secret;
}

export function signIdentityLinkIntent(
  payload: Omit<IdentityLinkIntent, 'typ' | 'jti'> & { jti?: string },
): { token: string; expiresInSeconds: number; jti: string } {
  const expiresInSec = Math.max(60, Math.floor(IDENTITY_LINK_TTL_MS / 1000));
  const jti = payload.jti ?? randomBytes(16).toString('base64url');
  const token = jwt.sign(
    {
      typ: IDENTITY_LINK_INTENT_TYP,
      jti,
      provider: payload.provider,
      providerSubject: payload.providerSubject,
      intendedUserId: payload.intendedUserId,
      verifiedEmail: payload.verifiedEmail ?? null,
      returnUrl: payload.returnUrl ?? null,
      verifiedAt: payload.verifiedAt,
    },
    getSecret(),
    { expiresIn: expiresInSec, audience: IDENTITY_LINK_INTENT_TYP },
  );
  return { token, expiresInSeconds: expiresInSec, jti };
}

export function verifyIdentityLinkIntent(raw: string): IdentityLinkIntent {
  try {
    const decoded = jwt.verify(raw, getSecret(), {
      audience: IDENTITY_LINK_INTENT_TYP,
    }) as IdentityLinkIntent;
    if (
      decoded.typ !== IDENTITY_LINK_INTENT_TYP ||
      !decoded.jti ||
      !decoded.provider ||
      !decoded.providerSubject ||
      !decoded.intendedUserId ||
      !decoded.verifiedAt
    ) {
      throw new AppError(400, 'INVALID_LINK_INTENT', 'This linking step has expired. Please try again.');
    }
    if (decoded.provider !== 'phone' && decoded.provider !== 'google') {
      throw new AppError(400, 'INVALID_LINK_INTENT', 'This linking step has expired. Please try again.');
    }
    return decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(400, 'IDENTITY_LINK_INTENT_EXPIRED', 'This linking step has expired. Please try again.');
    }
    throw new AppError(400, 'INVALID_LINK_INTENT', 'This linking step has expired. Please try again.');
  }
}

export function getIdentityLinkCookieOptions(): CookieOptions {
  const session = getSessionCookieOptions();
  return {
    httpOnly: true,
    secure: session.secure,
    sameSite: 'lax',
    maxAge: IDENTITY_LINK_TTL_MS,
    path: '/api/v1/auth',
    ...(session.domain ? { domain: session.domain } : {}),
  };
}

export function setIdentityLinkCookie(res: Response, token: string): void {
  res.cookie(IDENTITY_LINK_COOKIE_NAME, token, getIdentityLinkCookieOptions());
}

export function clearIdentityLinkCookie(res: Response): void {
  const opts = getIdentityLinkCookieOptions();
  const { maxAge: _m, ...clearOpts } = opts;
  res.clearCookie(IDENTITY_LINK_COOKIE_NAME, clearOpts);
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

/** In-process consumed jti set for local/test single-use (best-effort; uniqueness is authoritative). */
const consumedJtis = new Set<string>();

export function markIdentityLinkIntentConsumed(jti: string): void {
  consumedJtis.add(jti);
  // Bound memory
  if (consumedJtis.size > 5000) {
    const first = consumedJtis.values().next().value;
    if (first) consumedJtis.delete(first);
  }
}

export function isIdentityLinkIntentConsumed(jti: string): boolean {
  return consumedJtis.has(jti);
}

/** Test helper */
export function clearConsumedIdentityLinkIntentsForQa(): void {
  consumedJtis.clear();
}
