import { prisma, Prisma } from '@mazare3/db';

/**
 * Process-wide (Postgres) advisory lock for background jobs.
 * Protects multi-instance Production overlap — not an in-memory mutex.
 *
 * Uses fixed int keys per job name (stable across deploys).
 */
const JOB_LOCK_KEYS: Record<string, number> = {
  'expire-owner-approval-requests': 340_101,
  'expire-unpaid-booking-holds': 340_102,
  'auto-cancel-unpaid-balances': 340_103,
  'reconcile-pending-payments': 340_104,
  'reconcile-pending-refunds': 340_105,
  'expire-reschedule-requests': 340_106,
  'generate-due-settlement-cycles': 340_107,
  'maintain-availability-horizon': 340_108,
  'reconcile-regulatory-document-expiry': 340_109,
};

export function jobAdvisoryLockKey(jobName: string): number {
  return JOB_LOCK_KEYS[jobName] ?? 340_000 + (hashString(jobName) % 90_000);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export async function tryAcquireJobAdvisoryLock(jobName: string): Promise<boolean> {
  const key = jobAdvisoryLockKey(jobName);
  const rows = await prisma.$queryRaw<Array<{ ok: boolean }>>(
    Prisma.sql`SELECT pg_try_advisory_lock(${key}) AS ok`,
  );
  return Boolean(rows[0]?.ok);
}

export async function releaseJobAdvisoryLock(jobName: string): Promise<void> {
  const key = jobAdvisoryLockKey(jobName);
  await prisma.$queryRaw(Prisma.sql`SELECT pg_advisory_unlock(${key})`);
}

export async function withJobAdvisoryLock<T>(
  jobName: string,
  fn: () => Promise<T>,
): Promise<{ acquired: boolean; result?: T }> {
  const acquired = await tryAcquireJobAdvisoryLock(jobName);
  if (!acquired) return { acquired: false };
  try {
    const result = await fn();
    return { acquired: true, result };
  } finally {
    try {
      await releaseJobAdvisoryLock(jobName);
    } catch (err) {
      console.error(`[jobs] advisory unlock failed job=${jobName}`, err);
    }
  }
}
