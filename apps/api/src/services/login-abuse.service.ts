import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@mazare3/db';
import { AppError } from '../lib/errors.js';
import { isAppEnvProduction } from '../config/app-env.js';
import {
  LOGIN_ABUSE_COOLDOWN_MS,
  LOGIN_ABUSE_EXTENDED_COOLDOWN_MS,
  LOGIN_ABUSE_EXTENDED_THRESHOLD,
  LOGIN_ABUSE_FAIL_THRESHOLD,
  LOGIN_ABUSE_MAX_COOLDOWN_MS,
  LOGIN_ABUSE_MAX_THRESHOLD,
  LOGIN_ABUSE_STATE_TTL_MS,
  cooldownMsForFailCount,
} from '../config/login-abuse-config.js';

const GENERIC_RATE_LIMIT_MESSAGE = 'Too many attempts. Please try again shortly.';

/** Same canonicalization as Login / Signup. */
export function normalizeLoginEmail(email: string): string {
  return email.toLowerCase().trim();
}

function getAbuseHmacSecret(): string {
  const secret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET or SESSION_SECRET (min 32 chars) is required for login abuse keys');
  }
  return secret;
}

/** Privacy-preserving limiter key — never store raw email. */
export function hashLoginIdentifier(normalizedEmail: string): string {
  return createHmac('sha256', getAbuseHmacSecret())
    .update(`login-abuse:v1:${normalizedEmail}`, 'utf8')
    .digest('hex');
}

export function isLoginAbuseProtectionDisabled(): boolean {
  if (isAppEnvProduction()) return false;
  return process.env.DISABLE_LOGIN_ABUSE_PROTECTION === 'true';
}

function retryAfterSec(until: Date, now = new Date()): number {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000));
}

function throwThrottled(cooldownUntil: Date): never {
  const sec = retryAfterSec(cooldownUntil);
  throw new AppError(429, 'AUTH_RATE_LIMITED', GENERIC_RATE_LIMIT_MESSAGE, {
    retryAfterSec: sec,
  });
}

/**
 * Lazy cleanup of expired identifier rows (bounded storage).
 * Best-effort; safe to call frequently.
 */
export async function purgeExpiredLoginAbuseStates(limit = 100): Promise<number> {
  const now = new Date();
  const expired = await prisma.loginAbuseState.findMany({
    where: { expiresAt: { lt: now } },
    select: { identifierKey: true },
    take: limit,
  });
  if (expired.length === 0) return 0;
  const result = await prisma.loginAbuseState.deleteMany({
    where: { identifierKey: { in: expired.map((r) => r.identifierKey) } },
  });
  return result.count;
}

/**
 * Reject login when identifier is in temporary cooldown.
 * Uses the same path for known and unknown emails (HMAC of normalized input).
 */
export async function assertLoginIdentifierNotThrottled(rawEmail: string): Promise<void> {
  if (isLoginAbuseProtectionDisabled()) return;

  const normalized = normalizeLoginEmail(rawEmail);
  if (!normalized) return;

  const identifierKey = hashLoginIdentifier(normalized);
  const now = new Date();
  const row = await prisma.loginAbuseState.findUnique({ where: { identifierKey } });
  if (!row) return;

  if (row.expiresAt.getTime() <= now.getTime()) {
    await prisma.loginAbuseState.deleteMany({ where: { identifierKey } });
    return;
  }

  if (row.cooldownUntil && row.cooldownUntil.getTime() > now.getTime()) {
    console.info('[auth] identifier login throttle triggered', {
      code: 'AUTH_IDENTIFIER_THROTTLED',
      identifierKeyPrefix: identifierKey.slice(0, 8),
    });
    throwThrottled(row.cooldownUntil);
  }

  // Cooldown expired — clear so a legitimate login can proceed with a clean slate.
  if (row.cooldownUntil && row.cooldownUntil.getTime() <= now.getTime()) {
    await prisma.loginAbuseState.deleteMany({ where: { identifierKey } });
  }
}

type AbuseRow = {
  failCount: number;
  cooldownUntil: Date | null;
};

/**
 * Atomically record a failed login for the normalized identifier.
 * Progressive temporary cooldown at fail counts 5 / 10 / 15.
 */
export async function recordLoginIdentifierFailure(rawEmail: string): Promise<void> {
  if (isLoginAbuseProtectionDisabled()) return;

  const normalized = normalizeLoginEmail(rawEmail);
  if (!normalized) return;

  const identifierKey = hashLoginIdentifier(normalized);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOGIN_ABUSE_STATE_TTL_MS);

  const softMs = LOGIN_ABUSE_COOLDOWN_MS;
  const extMs = LOGIN_ABUSE_EXTENDED_COOLDOWN_MS;
  const maxMs = LOGIN_ABUSE_MAX_COOLDOWN_MS;
  const softAt = LOGIN_ABUSE_FAIL_THRESHOLD;
  const extAt = LOGIN_ABUSE_EXTENDED_THRESHOLD;
  const maxAt = LOGIN_ABUSE_MAX_THRESHOLD;

  const rows = await prisma.$queryRaw<AbuseRow[]>`
    INSERT INTO "LoginAbuseState" (
      "identifierKey", "failCount", "windowStartedAt", "cooldownUntil", "expiresAt", "createdAt", "updatedAt"
    ) VALUES (
      ${identifierKey}, 1, ${now}, NULL, ${expiresAt}, ${now}, ${now}
    )
    ON CONFLICT ("identifierKey") DO UPDATE SET
      "failCount" = CASE
        WHEN "LoginAbuseState"."expiresAt" <= ${now} THEN 1
        WHEN "LoginAbuseState"."cooldownUntil" IS NOT NULL
          AND "LoginAbuseState"."cooldownUntil" > ${now}
          THEN "LoginAbuseState"."failCount"
        ELSE "LoginAbuseState"."failCount" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "LoginAbuseState"."expiresAt" <= ${now} THEN ${now}
        ELSE "LoginAbuseState"."windowStartedAt"
      END,
      "cooldownUntil" = CASE
        WHEN "LoginAbuseState"."cooldownUntil" IS NOT NULL
          AND "LoginAbuseState"."cooldownUntil" > ${now}
          THEN "LoginAbuseState"."cooldownUntil"
        WHEN (
          CASE
            WHEN "LoginAbuseState"."expiresAt" <= ${now} THEN 1
            ELSE "LoginAbuseState"."failCount" + 1
          END
        ) >= ${maxAt} THEN ${now} + (${maxMs} * INTERVAL '1 millisecond')
        WHEN (
          CASE
            WHEN "LoginAbuseState"."expiresAt" <= ${now} THEN 1
            ELSE "LoginAbuseState"."failCount" + 1
          END
        ) >= ${extAt} THEN ${now} + (${extMs} * INTERVAL '1 millisecond')
        WHEN (
          CASE
            WHEN "LoginAbuseState"."expiresAt" <= ${now} THEN 1
            ELSE "LoginAbuseState"."failCount" + 1
          END
        ) >= ${softAt} THEN ${now} + (${softMs} * INTERVAL '1 millisecond')
        ELSE NULL
      END,
      "expiresAt" = ${expiresAt},
      "updatedAt" = ${now}
    RETURNING "failCount", "cooldownUntil"
  `;

  const row = rows[0];
  if (row?.cooldownUntil) {
    const tierMs = cooldownMsForFailCount(row.failCount);
    if (tierMs) {
      console.info('[auth] identifier login cooldown armed', {
        code: 'AUTH_IDENTIFIER_COOLDOWN',
        identifierKeyPrefix: identifierKey.slice(0, 8),
        tierMs,
      });
    }
  }

  void purgeExpiredLoginAbuseStates(25).catch(() => undefined);
}

/** Clear identifier failure state after successful authentication or password reset. */
export async function clearLoginIdentifierAbuse(rawEmail: string): Promise<void> {
  const normalized = normalizeLoginEmail(rawEmail);
  if (!normalized) return;
  const identifierKey = hashLoginIdentifier(normalized);
  await prisma.loginAbuseState.deleteMany({ where: { identifierKey } });
}

/** Test helper — compare two independently computed keys for the same email. */
export function loginIdentifierKeysMatch(emailA: string, emailB: string): boolean {
  const a = Buffer.from(hashLoginIdentifier(normalizeLoginEmail(emailA)), 'utf8');
  const b = Buffer.from(hashLoginIdentifier(normalizeLoginEmail(emailB)), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
