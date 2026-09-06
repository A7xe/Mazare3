import { prisma } from '@mazare3/db';
import type {
  ClientRateLimitInfo,
  IncrementResponse,
  Options,
  Store,
} from 'express-rate-limit';
import { AppError } from '../lib/errors.js';
import { newRateLimitBucketId, rateLimitKeyLogPrefix } from '../lib/auth-ip-key.js';

export type AuthRateLimitNamespace =
  | 'auth-general'
  | 'auth-forgot-password'
  | 'auth-reset-password'
  | 'auth-phone-otp-send-ip'
  | 'auth-phone-otp-send-id'
  | 'auth-phone-otp-verify-ip'
  | 'auth-phone-otp-verify-id';

type BucketRow = {
  hits: number;
  resetAt: Date;
};

/**
 * AUTH-5 — Postgres-backed express-rate-limit Store.
 * Shared across API instances. One Store instance per limiter namespace
 * (express-rate-limit forbids sharing a single Store object across limiters).
 *
 * Window semantics: fixed window matching express-rate-limit defaults
 * (resetAt = first hit in window + windowMs; expired windows restart at 1).
 *
 * DB failure policy: fail-closed with 503 AUTH_RATE_LIMIT_UNAVAILABLE.
 * Auth depends on the same Postgres as identifier abuse; silent fail-open
 * would falsely claim distributed IP protection during outages.
 */
export class PostgresRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;
  private windowMs = 15 * 60 * 1000;
  private purgeCounter = 0;

  constructor(readonly namespace: AuthRateLimitNamespace) {
    this.prefix = `${namespace}:`;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    try {
      const row = await prisma.rateLimitBucket.findUnique({
        where: {
          namespace_keyHash: { namespace: this.namespace, keyHash: key },
        },
        select: { hits: true, resetAt: true },
      });
      if (!row) return undefined;
      if (row.resetAt.getTime() <= Date.now()) {
        return { totalHits: 0, resetTime: row.resetAt };
      }
      return { totalHits: row.hits, resetTime: row.resetAt };
    } catch (err) {
      this.onStoreFailure('get', err);
    }
  }

  async increment(key: string): Promise<IncrementResponse> {
    try {
      const now = new Date();
      const freshResetAt = new Date(now.getTime() + this.windowMs);
      const id = newRateLimitBucketId();

      const rows = await prisma.$queryRaw<BucketRow[]>`
        INSERT INTO "RateLimitBucket" (
          "id", "namespace", "keyHash", "hits", "resetAt", "createdAt", "updatedAt"
        ) VALUES (
          ${id}, ${this.namespace}, ${key}, 1, ${freshResetAt}, ${now}, ${now}
        )
        ON CONFLICT ("namespace", "keyHash") DO UPDATE SET
          "hits" = CASE
            WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
            ELSE "RateLimitBucket"."hits" + 1
          END,
          "resetAt" = CASE
            WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${freshResetAt}
            ELSE "RateLimitBucket"."resetAt"
          END,
          "updatedAt" = ${now}
        RETURNING "hits", "resetAt"
      `;

      const row = rows[0];
      if (!row) {
        throw new Error('RateLimitBucket upsert returned no row');
      }

      this.maybePurgeExpired();
      return { totalHits: row.hits, resetTime: row.resetAt };
    } catch (err) {
      if (err instanceof AppError) throw err;
      this.onStoreFailure('increment', err);
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      const now = new Date();
      await prisma.$executeRaw`
        UPDATE "RateLimitBucket"
        SET "hits" = GREATEST("hits" - 1, 0), "updatedAt" = ${now}
        WHERE "namespace" = ${this.namespace}
          AND "keyHash" = ${key}
          AND "resetAt" > ${now}
          AND "hits" > 0
      `;
    } catch (err) {
      // Decrement is best-effort (used on skipped responses); do not fail the request.
      console.error('[auth] rate-limit store decrement failed', {
        code: 'AUTH_RATE_LIMIT_STORE_ERROR',
        op: 'decrement',
        namespace: this.namespace,
        keyPrefix: rateLimitKeyLogPrefix(key),
        errorName: err instanceof Error ? err.name : 'unknown',
      });
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await prisma.rateLimitBucket.deleteMany({
        where: { namespace: this.namespace, keyHash: key },
      });
    } catch (err) {
      this.onStoreFailure('resetKey', err);
    }
  }

  private maybePurgeExpired(): void {
    this.purgeCounter += 1;
    if (this.purgeCounter % 25 !== 0) return;
    const cutoff = new Date();
    void prisma.rateLimitBucket
      .findMany({
        where: { resetAt: { lt: cutoff } },
        select: { id: true },
        take: 50,
      })
      .then(async (expired) => {
        if (expired.length === 0) return;
        await prisma.rateLimitBucket.deleteMany({
          where: { id: { in: expired.map((r) => r.id) } },
        });
      })
      .catch(() => undefined);
  }

  private onStoreFailure(op: string, err: unknown): never {
    console.error('[auth] rate-limit store unavailable', {
      code: 'AUTH_RATE_LIMIT_STORE_UNAVAILABLE',
      op,
      namespace: this.namespace,
      errorName: err instanceof Error ? err.name : 'unknown',
    });
    throw new AppError(
      503,
      'AUTH_RATE_LIMIT_UNAVAILABLE',
      'Service temporarily unavailable. Please try again shortly.',
    );
  }
}

export function createAuthPostgresRateLimitStore(
  namespace: AuthRateLimitNamespace,
): PostgresRateLimitStore {
  return new PostgresRateLimitStore(namespace);
}

/** Test helper — purge a namespace (internal QA only). */
export async function clearRateLimitNamespaceForQa(
  namespace: AuthRateLimitNamespace,
): Promise<number> {
  const result = await prisma.rateLimitBucket.deleteMany({ where: { namespace } });
  return result.count;
}

/** Test helper — read hits for a keyHash. */
export async function getRateLimitBucketHitsForQa(
  namespace: AuthRateLimitNamespace,
  keyHash: string,
): Promise<number | null> {
  const row = await prisma.rateLimitBucket.findUnique({
    where: { namespace_keyHash: { namespace, keyHash } },
    select: { hits: true, resetAt: true },
  });
  if (!row) return null;
  if (row.resetAt.getTime() <= Date.now()) return 0;
  return row.hits;
}
