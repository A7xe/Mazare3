/**
 * Central registry for time-based marketplace operations (Phase 10H.4).
 *
 * Recommended production frequencies (configure external scheduler later — not in-repo):
 * - expire-owner-approval-requests: every 5–15 minutes
 * - expire-unpaid-booking-holds: every 5–15 minutes
 * - generate-due-settlement-cycles: once daily shortly after UTC midnight (or platform TZ)
 * - maintain-availability-horizon: once daily (extends rolling AVAILABILITY_HORIZON_DAYS window)
 *
 * Lazy inline expiry on booking/payment reads remains the safety net between ticks.
 */
import { expireStaleUnpaidBookingHolds } from './payment.service.js';
import { expireStaleOwnerApprovals } from './owner-approval-expiry.service.js';
import { generateDueOwnerSettlements } from './owner-settlement.service.js';
import { generateAvailabilityForPublishedWithRules } from './availability-generation.service.js';

/** Stable operational job identifiers for schedulers and diagnostics. */
export const BACKGROUND_JOB_NAMES = [
  'expire-owner-approval-requests',
  'expire-unpaid-booking-holds',
  'generate-due-settlement-cycles',
  'maintain-availability-horizon',
] as const;

export type BackgroundJobName = (typeof BACKGROUND_JOB_NAMES)[number];

export type BackgroundJobResult = {
  name: BackgroundJobName;
  startedAt: string;
  finishedAt: string;
  success: boolean;
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
    };
  },
  'expire-unpaid-booking-holds': async () => {
    const result = await expireStaleUnpaidBookingHolds();
    return {
      paymentsProcessed: result.paymentsProcessed,
      paymentsExpired: result.paymentsExpired,
      holdsProcessed: result.holdsProcessed,
      holdsExpired: result.holdsExpired,
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
};

export function isBackgroundJobName(value: string): value is BackgroundJobName {
  return (BACKGROUND_JOB_NAMES as readonly string[]).includes(value);
}

export function listBackgroundJobNames(): BackgroundJobName[] {
  return [...BACKGROUND_JOB_NAMES];
}

function logJobResult(result: BackgroundJobResult): void {
  const status = result.success ? 'ok' : 'failed';
  const counts = Object.entries(result.summary)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  console.log(
    `[jobs] ${result.name} ${status} ${result.startedAt}→${result.finishedAt}${counts ? ` ${counts}` : ''}${result.error ? ` error=${result.error}` : ''}`,
  );
}

export async function runBackgroundJob(name: BackgroundJobName): Promise<BackgroundJobResult> {
  const startedAt = new Date();
  const handler = JOB_HANDLERS[name];
  try {
    const summary = await handler();
    const result: BackgroundJobResult = {
      name,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      success: true,
      summary,
    };
    logJobResult(result);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[jobs] ${name} failed:`, err);
    const result: BackgroundJobResult = {
      name,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      success: false,
      summary: {},
      error: message,
    };
    logJobResult(result);
    return result;
  }
}

/** Run all operational jobs once. Failed jobs do not stop subsequent jobs. */
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
