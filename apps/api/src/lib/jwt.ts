import jwt from 'jsonwebtoken';
import type { UserRole } from '@mazare3/shared';
import { getSessionCookieOptions } from './cookie-options.js';

const COOKIE_NAME = 'mazare3_session';

export interface SessionPayload {
  userId: string;
  /** May be null for future phone-first / passwordless accounts. Anchored by userId. */
  email: string | null;
  role: UserRole;
  /** passwordChangedAt getTime() at issue time; 0 if never set. Used to revoke older sessions. */
  pwdAt?: number;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET or SESSION_SECRET (min 32 chars) is required');
  }
  return secret;
}

export function signSession(payload: SessionPayload): string {
  const expiresIn = process.env.JWT_EXPIRES_IN ?? '7d';
  return jwt.sign(payload, getSecret(), { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, getSecret()) as SessionPayload;
}

export { COOKIE_NAME };

export function getCookieOptions() {
  return getSessionCookieOptions();
}
