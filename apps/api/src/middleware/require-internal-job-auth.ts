import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import { getAppEnv } from '../config/app-env.js';

/**
 * Phase 3C.4E.2C — server-to-server auth for Production job HTTP entrypoints.
 * Secret via Authorization: Bearer <INTERNAL_JOB_SECRET> or X-Mazare3-Job-Secret.
 * Never accept secret from query string. Never log the secret value.
 */
export function getInternalJobSecret(): string | null {
  const raw = process.env.INTERNAL_JOB_SECRET?.trim();
  return raw && raw.length >= 16 ? raw : null;
}

export function isInternalJobSecretConfigured(): boolean {
  return getInternalJobSecret() != null;
}

function extractPresentedSecret(req: Request): string | null {
  const header = req.get('x-mazare3-job-secret')?.trim();
  if (header) return header;
  const auth = req.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    return token || null;
  }
  return null;
}

function secretsEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) {
    // Constant-time-ish reject without leaking length via early return alone:
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export function requireInternalJobAuth(req: Request, _res: Response, next: NextFunction): void {
  const expected = getInternalJobSecret();
  if (!expected) {
    if (getAppEnv() === 'production') {
      next(new AppError(503, 'JOB_AUTH_NOT_CONFIGURED', 'Job authentication is not configured'));
      return;
    }
    // Non-production without secret: refuse mutating ops routes (force explicit local secret).
    next(new AppError(503, 'JOB_AUTH_NOT_CONFIGURED', 'Set INTERNAL_JOB_SECRET to invoke ops job routes'));
    return;
  }

  const presented = extractPresentedSecret(req);
  if (!presented || !secretsEqual(presented, expected)) {
    next(new AppError(401, 'UNAUTHORIZED', 'Invalid or missing job credentials'));
    return;
  }
  next();
}
