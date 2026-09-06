/**
 * UA-1 — password AuthIdentity backfill (LOCAL ONLY).
 *
 * Usage:
 *   node scripts/ua1-password-identity-backfill.mjs --preflight
 *   node scripts/ua1-password-identity-backfill.mjs --apply
 *
 * Preflight detects normalized-email collisions before any writes.
 * Apply is idempotent (unique provider+providerSubject).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

loadEnv();

/** Same as apps/api login-abuse.service normalizeLoginEmail */
export function normalizeLoginEmail(email) {
  return String(email).toLowerCase().trim();
}

export function assertLocalSafeForBackfill() {
  const appEnv = (process.env.APP_ENV ?? '').trim().toLowerCase();
  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  if (nodeEnv === 'production') {
    throw new Error('REFUSED: NODE_ENV=production');
  }
  if (!appEnv || (appEnv !== 'local' && appEnv !== 'test')) {
    throw new Error(
      `REFUSED: APP_ENV must be local|test for UA-1 backfill (got ${appEnv || '(empty)'})`,
    );
  }
  const db = process.env.DATABASE_URL ?? '';
  if (!db) throw new Error('REFUSED: DATABASE_URL missing');
  const lower = db.toLowerCase();
  if (
    (lower.includes('prod') || lower.includes('production') || lower.includes('staging')) &&
    !/localhost|127\.0\.0\.1/.test(lower)
  ) {
    throw new Error('REFUSED: DATABASE_URL appears production/staging-like');
  }
  return { appEnv, nodeEnv };
}

/**
 * @returns {{ ok: true } | { ok: false, collisionGroupCount: number, collidingUserCount: number }}
 */
export function findNormalizedEmailCollisions(rows) {
  /** @type {Map<string, string[]>} */
  const byNorm = new Map();
  for (const row of rows) {
    if (!row.email) continue;
    const norm = normalizeLoginEmail(row.email);
    const list = byNorm.get(norm) ?? [];
    list.push(row.id);
    byNorm.set(norm, list);
  }
  let collisionGroupCount = 0;
  let collidingUserCount = 0;
  for (const ids of byNorm.values()) {
    const unique = [...new Set(ids)];
    if (unique.length > 1) {
      collisionGroupCount++;
      collidingUserCount += unique.length;
    }
  }
  if (collisionGroupCount > 0) {
    return { ok: false, collisionGroupCount, collidingUserCount };
  }
  return { ok: true };
}

async function main() {
  const APPLY = process.argv.includes('--apply');
  const PREFLIGHT = process.argv.includes('--preflight') || !APPLY;

  assertLocalSafeForBackfill();

  const { PrismaClient, AuthIdentityProvider } = await import(
    '../packages/db/generated/client/index.js'
  );
  const prisma = new PrismaClient({ log: ['error'] });

  try {
    const users = await prisma.user.findMany({
      where: { email: { not: null }, passwordHash: { not: null } },
      select: { id: true, email: true, passwordHash: true, role: true, status: true },
    });

    const collision = findNormalizedEmailCollisions(users);
    if (!collision.ok) {
      console.log(
        JSON.stringify(
          {
            status: 'NORMALIZED_EMAIL_COLLISION_BLOCKED',
            collisionGroupCount: collision.collisionGroupCount,
            collidingUserCount: collision.collidingUserCount,
            note: 'No Users merged. Backfill not executed.',
          },
          null,
          2,
        ),
      );
      process.exitCode = 2;
      return;
    }

    if (PREFLIGHT && !APPLY) {
      console.log(
        JSON.stringify(
          {
            status: 'PREFLIGHT_PASS',
            eligiblePasswordUsers: users.length,
            note: 'No collisions. Re-run with --apply to backfill.',
          },
          null,
          2,
        ),
      );
      return;
    }

    let created = 0;
    let alreadyPresent = 0;
    let skippedNoEmail = 0;

    for (const u of users) {
      if (!u.email) {
        skippedNoEmail++;
        continue;
      }
      const subject = normalizeLoginEmail(u.email);
      const existing = await prisma.authIdentity.findUnique({
        where: {
          provider_providerSubject: {
            provider: AuthIdentityProvider.password,
            providerSubject: subject,
          },
        },
        select: { userId: true },
      });
      if (existing) {
        alreadyPresent++;
        continue;
      }
      await prisma.authIdentity.create({
        data: {
          userId: u.id,
          provider: AuthIdentityProvider.password,
          providerSubject: subject,
          verifiedAt: null,
        },
      });
      created++;
    }

    const passwordIdentities = await prisma.authIdentity.count({
      where: { provider: AuthIdentityProvider.password },
    });
    const phoneIdentities = await prisma.authIdentity.count({
      where: { provider: AuthIdentityProvider.phone },
    });
    const googleIdentities = await prisma.authIdentity.count({
      where: { provider: AuthIdentityProvider.google },
    });
    const userCount = await prisma.user.count();

    console.log(
      JSON.stringify(
        {
          status: 'APPLY_OK',
          eligiblePasswordUsers: users.length,
          identitiesCreated: created,
          alreadyPresent,
          skippedNoEmail,
          totals: {
            users: userCount,
            passwordIdentities,
            phoneIdentities,
            googleIdentities,
          },
          verifiedAtPolicy: 'legacy password identities keep verifiedAt=null',
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
