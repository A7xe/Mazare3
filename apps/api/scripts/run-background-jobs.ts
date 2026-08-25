/**
 * One-shot local operator runner — invokes background jobs directly and exits.
 *
 * Usage:
 *   pnpm jobs:run
 *   pnpm jobs:run -- expire-owner-approval-requests
 *   JOB=expire-unpaid-booking-holds pnpm jobs:run
 */
import '../src/env.js';
import {
  isBackgroundJobName,
  listBackgroundJobNames,
  runBackgroundJob,
  runDueBackgroundJobs,
} from '../src/services/background-jobs.service.js';

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const envJob = process.env.JOB?.trim();
  const target = args[0] ?? envJob;

  if (target) {
    if (!isBackgroundJobName(target)) {
      console.error(`Unknown job: ${target}`);
      console.error(`Available: ${listBackgroundJobNames().join(', ')}`);
      process.exit(1);
    }
    const result = await runBackgroundJob(target);
    process.exit(result.success ? 0 : 1);
  }

  const report = await runDueBackgroundJobs();
  process.exit(report.allSucceeded ? 0 : 1);
}

main().catch((err) => {
  console.error('[jobs] runner crashed:', err);
  process.exit(1);
});
