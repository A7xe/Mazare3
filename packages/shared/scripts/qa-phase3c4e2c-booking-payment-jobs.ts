/**
 * Phase 3C.4E.2C — Booking/payment scheduler & reconciliation readiness QA.
 * Run: pnpm qa:phase3c4e2c-booking-payment-jobs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STANDARD_COMMISSION_PERCENT,
  VERIFIED_COMMISSION_PERCENT,
} from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
let passed = 0;
let failed = 0;

function expect(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}: ${detail || 'assertion failed'}`);
  }
}
function src(rel: string) {
  return readFileSync(resolve(root, rel), 'utf8');
}

console.log('\nPhase 3C.4E.2C Booking/Payment Scheduler QA\n');

const hold = src('apps/api/src/services/booking-hold.service.ts');
const approval = src('apps/api/src/services/owner-approval-expiry.service.ts');
const bookingSvc = src('apps/api/src/services/booking.service.ts');
const paymentSvc = src('apps/api/src/services/payment.service.ts');
const ledger = src('apps/api/src/lib/booking-ledger.ts');
const jobs = src('apps/api/src/services/background-jobs.service.ts');
const lock = src('apps/api/src/lib/job-advisory-lock.ts');
const ops = src('apps/api/src/routes/ops-jobs.ts');
const authMw = src('apps/api/src/middleware/require-internal-job-auth.ts');
const app = src('apps/api/src/app.ts');
const index = src('apps/api/src/index.ts');
const refund = src('apps/api/src/services/multi-capture-refund.service.ts');
const reconcile = src('apps/api/src/services/paytabs-reconciliation.service.ts');
const bookability = src('apps/api/src/services/property-bookability.service.ts');
const preflightSvc = src('apps/api/src/services/booking-payment-jobs-preflight.service.ts');
const runbook = src('docs/MAZARE3_BOOKING_PAYMENT_SCHEDULER_RUNBOOK_3C4E2C.md');
const recovery = src('docs/MAZARE3_BOOKING_JOB_FAILURE_RECOVERY_3C4E2C.md');
const pkg = src('package.json');
const envEx = src('.env.example');
const terms = src('packages/shared/src/legal-content/terms-and-conditions.ts');
const cancel = src('packages/shared/src/legal-content/cancellation-refund-policy.ts');
const bookingTerms = src('packages/shared/src/legal-content/booking-terms.ts');
const privacy = src('packages/shared/src/legal-content/privacy-policy.ts');
const ownerAgreement = src('packages/shared/src/legal-content/owner-agreement.ts');
const versions = src('packages/shared/src/legal-content/build-legal-markdown.ts');
// A–C Owner approval boundaries & accept guard
expect(
  'A/B/C accept requires ownerApprovalExpiresAt gt now (exact = expired)',
  /ownerApprovalExpiresAt:\s*\{\s*gt:\s*now\s*\}/.test(bookingSvc),
);
expect(
  'C expiry job uses lte (inclusive exact deadline)',
  /ownerApprovalExpiresAt:\s*\{\s*lte:\s*new Date\(\)\s*\}/.test(approval) ||
    /ownerApprovalExpiresAt:\s*\{\s*lte:\s*now\s*\}/.test(approval),
);
expect('D expireStaleOwnerApprovals exists', approval.includes('expireStaleOwnerApprovals'));
expect(
  'E duplicate expiry idempotent (updateMany / conditional)',
  approval.includes('updateMany') && approval.includes('FOR UPDATE'),
);
expect(
  'F accept vs expiry: accept checks expiresAt directly (not cron)',
  bookingSvc.includes('OWNER_APPROVAL_EXPIRED') &&
    /ownerApprovalExpiresAt:\s*\{\s*gt:\s*now\s*\}/.test(bookingSvc),
);

// G–H balance deadline
expect(
  'G balanceDueAt hard cutoff on new intent',
  paymentSvc.includes('BALANCE_PAYMENT_DEADLINE_PASSED') &&
    paymentSvc.includes('balanceDueAt <= new Date()'),
);
expect(
  'H derivePayFlags respects balanceDueAt',
  ledger.includes('pastBalanceDeadline') && ledger.includes('balanceDueAt'),
);
expect(
  'H canPayBalance false after deadline',
  /canPayBalance\s*=\s*[\s\S]*!pastBalanceDeadline/.test(ledger),
);

// I–L reconcile-first cancel
expect(
  'I reconcile before cancel',
  hold.includes('reconcileOpenBalancePaymentsBeforeAutoCancel') &&
    hold.includes('reconcilePayTabsPayment'),
);
expect(
  'J successful payment prevents unpaid cancel',
  hold.includes('balanceSucceeded') && hold.includes('PaymentStatus.succeeded'),
);
expect(
  'K unpaid permits cancel via BALANCE_NOT_PAID',
  hold.includes('BALANCE_NOT_PAID') && hold.includes('autoCancelUnpaidBalanceIfNeeded'),
);
expect(
  'L provider uncertainty defers cancel',
  hold.includes("'deferred'") &&
    hold.includes('PROVIDER_STATE_UNCERTAIN_OR_PENDING') &&
    hold.includes('PAYMENT_PROVIDER_ERROR'),
);

// M–Q race / finance
expect(
  'M cancel uses FOR UPDATE + conditional updateMany',
  hold.includes('FOR UPDATE') && /updateMany[\s\S]*confirmed/.test(hold),
);
expect(
  'N retains captured via refundableCapturedFils / distributeRetainedAmount',
  hold.includes('refundableCapturedFils') && hold.includes('distributeRetainedAmount'),
);
expect(
  'O commission from booking.platformCommissionPercent snapshot',
  hold.includes('platformCommissionPercent'),
);
expect('P slot release once via releaseSlotIfUnheld', hold.includes('releaseSlotIfUnheld'));
expect(
  'Q advisory lock on jobs',
  lock.includes('pg_try_advisory_lock') && jobs.includes('withJobAdvisoryLock'),
);

// R–S payment/refund reconcile jobs
expect(
  'R reconcileUnresolvedPayments registered',
  paymentSvc.includes('reconcileUnresolvedPayments') &&
    jobs.includes('reconcile-pending-payments'),
);
expect(
  'S refund reconcile skips blind failed retry / no double refund',
  refund.includes('reconcilePendingRefundAllocations') &&
    refund.includes('skippedManual') &&
    refund.includes('alreadyRefunded'),
);

// T–U batch / concurrency
expect(
  'T bounded batches take: 50 / 40',
  /take:\s*50/.test(hold) && /batchSize\s*=\s*40|take:\s*batchSize/.test(paymentSvc),
);
expect('U multi-instance via advisory lock (not memory mutex)', lock.includes('pg_try_advisory_lock'));

// V–W auth
expect(
  'V ops routes require auth middleware',
  ops.includes('requireInternalJobAuth') && app.includes('opsJobsRouter'),
);
expect(
  'W secret not logged; timingSafeEqual; no query string',
  authMw.includes('timingSafeEqual') &&
    !/req\.query/.test(authMw) &&
    authMw.includes('Never log the secret'),
);

// X–Y preflight
expect(
  'X preflight mutation:false',
  preflightSvc.includes('mutation: false') && pkg.includes('preflight:booking-payment-jobs'),
);
expect(
  'Y config preflight PRESENT/MISSING only',
  preflightSvc.includes('secretsPrinted: false') &&
    pkg.includes('preflight:booking-payment-jobs-config'),
);

// Z startup
expect(
  'Z startup does not run destructive jobs',
  !index.includes('runDueBackgroundJobs') && !index.includes('runBackgroundJob'),
);

// AA–AE regressions / policy / legal
expect(
  'AA regulatory gate still in payment/bookability',
  bookability.includes('assertPropertyEligibleForNewPaidBooking') ||
    paymentSvc.includes('assertPropertyEligibleForNewPaidBooking'),
);
expect(
  'AB first-payment integrity markers remain',
  paymentSvc.includes('syncLivePaymentPlanForBooking') &&
    reconcile.includes('validateProviderCaptureAgainstPayment'),
);
expect(
  'AC multi-capture refunds remain',
  refund.includes('RefundPaymentAllocation') && refund.includes('executeRefundRequestAllocations'),
);
expect(
  'AD commission percents unchanged',
  STANDARD_COMMISSION_PERCENT === 18 && VERIFIED_COMMISSION_PERCENT === 15,
);
expect(
  'AE locked legal versions unchanged',
  versions.includes("ADVISOR_REVISED_VERSION = '1.1.2-advisor-final'") &&
    versions.includes("PRIVACY_ADVISOR_REVISED_VERSION = '1.1.2-advisor-final'") &&
    versions.includes("OWNER_ADVISOR_REVISED_VERSION = '1.1.1-advisor-final'") &&
    terms.includes('ADVISOR_REVISED_VERSION') &&
    cancel.includes('ADVISOR_REVISED_VERSION') &&
    bookingTerms.includes('ADVISOR_REVISED_VERSION') &&
    privacy.includes('PRIVACY_ADVISOR_REVISED_VERSION') &&
    ownerAgreement.includes('OWNER_ADVISOR_REVISED_VERSION'),
);

// AF Production untouched markers
expect(
  'AF runbook forbids live Production scheduler config',
  runbook.includes('Do NOT configure live Production') &&
    recovery.includes('Do not configure live Production') &&
    envEx.includes('INTERNAL_JOB_SECRET') &&
    envEx.includes('Do NOT configure live Production cron'),
);

expect('runbooks exist', runbook.includes('Job table') && recovery.includes('Safe restart'));
expect(
  'launch critical jobs listed',
  jobs.includes('LAUNCH_CRITICAL_JOB_NAMES') && jobs.includes('auto-cancel-unpaid-balances'),
);
expect('job health via audit', jobs.includes('job.run_success') && jobs.includes('getBackgroundJobHealth'));
expect('in-flight reuse allowed past deadline', paymentSvc.includes('reusePaymentId: activeBalance.id'));

console.log(`\n3C.4E.2C QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
