/**
 * Central registry for time-based marketplace operations (Phase 10H.4 / 3C.4A.1 / 3C.4E.2C).
 *
 * Production must invoke jobs via external scheduler (CLI or authenticated ops HTTP).
 * Application startup does NOT run destructive backlog jobs.
 *
 * Recommended Production cadences (see runbook — do not configure live in this phase):
 * - expire-owner-approval-requests: every ~5 minutes
 * - expire-unpaid-booking-holds: every ~5 minutes
 * - auto-cancel-unpaid-balances: every ~5 minutes
 * - reconcile-pending-payments: every ~5–10 minutes
 * - reconcile-pending-refunds: every ~15–30 minutes
 * - expire-reschedule-requests: every ~10–15 minutes (also covered by unpaid-holds job)
 * - generate-due-settlement-cycles: once daily
 * - maintain-availability-horizon: once daily
 * - mark-visit-review-eligible: advisory (no financial finalization)
 * - complete-verified-visits: after visit end for verified check-ins only
 */
import { expireStaleUnpaidBookingHolds, reconcileUnresolvedPayments } from './payment.service.js';
import { expireStaleOwnerApprovals } from './owner-approval-expiry.service.js';
import { generateDueOwnerSettlements } from './owner-settlement.service.js';
import { generateAvailabilityForPublishedWithRules } from './availability-generation.service.js';
import { markStaleBalanceOverdue } from './booking-hold.service.js';
import { reconcileExpiredRegulatoryRequirements } from './property-regulatory.service.js';
import { expireRescheduleRequests } from './reschedule.service.js';
import { reconcilePendingRefundAllocations } from './multi-capture-refund.service.js';
import { markVisitReviewEligibleBatch } from './no-show.service.js';
import { completeVerifiedVisitsBatch } from './visit-completion.service.js';
import { withJobAdvisoryLock } from '../lib/job-advisory-lock.js';
import { createAuditLog } from './audit.service.js';
import { prisma } from '@mazare3/db';

/** Stable operational job identifiers for schedulers and diagnostics. */
export const BACKGROUND_JOB_NAMES = [
  'expire-owner-approval-requests',
  'expire-unpaid-booking-holds',
  'auto-cancel-unpaid-balances',
  'reconcile-pending-payments',
  'reconcile-pending-refunds',
  'expire-reschedule-requests',
  'generate-due-settlement-cycles',
  'maintain-availability-horizon',
  'reconcile-regulatory-document-expiry',
  'mark-visit-review-eligible',
  'complete-verified-visits',
] as const;

export type BackgroundJobName = (typeof BACKGROUND_JOB_NAMES)[number];

/** Jobs that must run for Booking/payment launch safety. */
export const LAUNCH_CRITICAL_JOB_NAMES = [
  'expire-owner-approval-requests',
  'expire-unpaid-booking-holds',
  'auto-cancel-unpaid-balances',
  'reconcile-pending-payments',
] as const satisfies readonly BackgroundJobName[];

export type BackgroundJobResult = {
  name: BackgroundJobName;
  startedAt: string;
  finishedAt: string;
  success: boolean;
  skippedLock?: boolean;
  durationMs: number;
  summary: Record<string, number | string | null | boolean>;
  error?: string;
};

export type BackgroundJobRunReport = {
  startedAt: string;
  finishedAt: string;
  jobs: BackgroundJobResult[];
  allSucceeded: boolean;
};

type JobHandler = () => Promise<Record<string, number | string | null | boolean>>;

const JOB_HANDLERS: Record<BackgroundJobName, JobHandler> = {
  'expire-owner-approval-requests': async () => {
    const result = await expireStaleOwnerApprovals();
    return {
      processed: result.processed,
      expired: result.expired,
      batchSize: 50,
    };
  },
  'expire-unpaid-booking-holds': async () => {
    const result = await expireStaleUnpaidBookingHolds();
    return {
      paymentsProcessed: result.paymentsProcessed,
      paymentsExpired: result.paymentsExpired,
      holdsProcessed: result.holdsProcessed,
      holdsExpired: result.holdsExpired,
      reschedulesExpired: result.reschedulesExpired,
    };
  },
  'auto-cancel-unpaid-balances': async () => {
    const result = await markStaleBalanceOverdue();
    return {
      processed: result.processed,
      cancelled: result.marked,
      deferred: result.deferred,
      skippedAlreadyHandled: result.processed - result.marked - result.deferred,
      batchSize: 50,
    };
  },
  'reconcile-pending-payments': async () => {
    const result = await reconcileUnresolvedPayments();
    return {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      deferred: result.deferred,
      skipped: result.skipped,
      lookbackHours: 72,
      batchSize: 40,
    };
  },
  'reconcile-pending-refunds': async () => {
    const result = await reconcilePendingRefundAllocations();
    return {
      processedRequests: result.processedRequests,
      allocationsSucceeded: result.allocationsSucceeded,
      allocationsPending: result.allocationsPending,
      allocationsFailed: result.allocationsFailed,
      skippedManualFailed: result.skippedManual,
      batchSize: 25,
    };
  },
  'expire-reschedule-requests': async () => {
    const result = await expireRescheduleRequests();
    return {
      processed: result.processed,
      expired: result.expired,
      batchSize: 100,
    };
  },
  'generate-due-settlement-cycles': async () => {
    const result = await generateDueOwnerSettlements();
    return {
      cycleDays: result.cycleDays,
      asOf: result.asOf,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      ownersChecked: result.ownersChecked,
      settlementsCreated: result.settlementsCreated,
      itemsAttached: result.itemsAttached,
      skippedOwners: result.skippedOwners,
      failures: result.failures,
    };
  },
  'maintain-availability-horizon': async () => {
    const result = await generateAvailabilityForPublishedWithRules();
    return {
      properties: result.properties,
      slotsCreated: result.created,
    };
  },
  'reconcile-regulatory-document-expiry': async () => {
    const result = await reconcileExpiredRegulatoryRequirements();
    return { updated: result.updated };
  },
  'mark-visit-review-eligible': async () => {
    const result = await markVisitReviewEligibleBatch(50);
    return {
      scanned: result.scanned,
      eligible: result.eligible,
      note: 'Advisory only — does not finalize customer no-show',
    };
  },
  'complete-verified-visits': async () => {
    const result = await completeVerifiedVisitsBatch(50);
    return {
      scanned: result.scanned,
      completed: result.completed,
      skipped: result.skipped,
      note: 'Lifecycle only — no financial mutation; requires verified check-in',
    };
  },
};

export function isBackgroundJobName(value: string): value is BackgroundJobName {
  return (BACKGROUND_JOB_NAMES as readonly string[]).includes(value);
}

export function listBackgroundJobNames(): BackgroundJobName[] {
  return [...BACKGROUND_JOB_NAMES];
}

export function isLaunchCriticalJob(name: BackgroundJobName): boolean {
  return (LAUNCH_CRITICAL_JOB_NAMES as readonly string[]).includes(name);
}

function logJobResult(result: BackgroundJobResult): void {
  const status = result.skippedLock ? 'skipped_lock' : result.success ? 'ok' : 'failed';
  const counts = Object.entries(result.summary)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  console.log(
    `[jobs] ${result.name} ${status} durationMs=${result.durationMs} ${result.startedAt}→${result.finishedAt}${counts ? ` ${counts}` : ''}${result.error ? ` error=${result.error}` : ''}`,
  );
}

async function recordJobHealthAudit(result: BackgroundJobResult): Promise<void> {
  try {
    await createAuditLog({
      action: result.success
        ? 'job.run_success'
        : result.skippedLock
          ? 'job.run_skipped_lock'
          : 'job.run_failed',
      entityType: 'background_job',
      entityId: result.name,
      metadata: {
        name: result.name,
        success: result.success,
        skippedLock: result.skippedLock ?? false,
        durationMs: result.durationMs,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        launchCritical: isLaunchCriticalJob(result.name),
        summary: result.summary,
        error: result.error ?? null,
      },
    });
  } catch (err) {
    console.error(`[jobs] health audit failed name=${result.name}`, err);
  }
}

export async function runBackgroundJob(name: BackgroundJobName): Promise<BackgroundJobResult> {
  const startedAt = new Date();
  const handler = JOB_HANDLERS[name];

  try {
    const locked = await withJobAdvisoryLock(name, async () => handler());

    if (!locked.acquired) {
      const result: BackgroundJobResult = {
        name,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        success: true,
        skippedLock: true,
        durationMs: Date.now() - startedAt.getTime(),
        summary: { skippedLock: true, note: 'another_worker_holds_advisory_lock' },
      };
      logJobResult(result);
      await recordJobHealthAudit(result);
      return result;
    }

    const result: BackgroundJobResult = {
      name,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      success: true,
      durationMs: Date.now() - startedAt.getTime(),
      summary: locked.result ?? {},
    };
    logJobResult(result);
    await recordJobHealthAudit(result);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[jobs] ${name} failed:`, err);
    const result: BackgroundJobResult = {
      name,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      success: false,
      durationMs: Date.now() - startedAt.getTime(),
      summary: {},
      error: message,
    };
    logJobResult(result);
    await recordJobHealthAudit(result);
    return result;
  }
}

/** Run selected (or all) operational jobs once. Failed jobs do not stop subsequent jobs. */
export async function runDueBackgroundJobs(
  names: BackgroundJobName[] = listBackgroundJobNames(),
): Promise<BackgroundJobRunReport> {
  const startedAt = new Date();
  const jobs: BackgroundJobResult[] = [];
  for (const name of names) {
    jobs.push(await runBackgroundJob(name));
  }
  const report: BackgroundJobRunReport = {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    jobs,
    allSucceeded: jobs.every((j) => j.success),
  };
  console.log(
    `[jobs] run-due complete allSucceeded=${report.allSucceeded} jobs=${jobs.length} succeeded=${jobs.filter((j) => j.success).length}`,
  );
  return report;
}

/** Expected max interval (ms) between successful critical job runs for ops health. */
export const JOB_EXPECTED_MAX_INTERVAL_MS: Record<(typeof LAUNCH_CRITICAL_JOB_NAMES)[number], number> =
  {
    'expire-owner-approval-requests': 20 * 60_000,
    'expire-unpaid-booking-holds': 20 * 60_000,
    'auto-cancel-unpaid-balances': 20 * 60_000,
    'reconcile-pending-payments': 30 * 60_000,
  };

export type JobHealthSnapshot = {
  name: BackgroundJobName;
  launchCritical: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  expectedMaxIntervalMs: number | null;
  stale: boolean | null;
};

export async function getBackgroundJobHealth(
  names: BackgroundJobName[] = listBackgroundJobNames(),
): Promise<JobHealthSnapshot[]> {
  const out: JobHealthSnapshot[] = [];
  for (const name of names) {
    const lastSuccess = await prisma.auditLog.findFirst({
      where: {
        entityType: 'background_job',
        entityId: name,
        action: 'job.run_success',
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const lastFailure = await prisma.auditLog.findFirst({
      where: {
        entityType: 'background_job',
        entityId: name,
        action: 'job.run_failed',
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const expected =
      (JOB_EXPECTED_MAX_INTERVAL_MS as Record<string, number | undefined>)[name] ?? null;
    const lastSuccessAt = lastSuccess?.createdAt.toISOString() ?? null;
    let stale: boolean | null = null;
    if (expected != null) {
      if (!lastSuccess) stale = true;
      else stale = Date.now() - lastSuccess.createdAt.getTime() > expected;
    }
    out.push({
      name,
      launchCritical: isLaunchCriticalJob(name),
      lastSuccessAt,
      lastFailureAt: lastFailure?.createdAt.toISOString() ?? null,
      expectedMaxIntervalMs: expected,
      stale,
    });
  }
  return out;
}
