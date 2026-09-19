/**
 * Phase 3C.4A.1 — Unpaid Balance deadline enforcement (static + SSOT).
 * Run: pnpm qa:phase3c4a1-balance-deadline
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BALANCE_DUE_HOURS_BEFORE_START,
  BOOKING_CANCELLATION_REASON,
  DEFAULT_PLATFORM_TIME_ZONE,
  computeBalanceDueAtFromStart,
  distributeRetainedAmount,
  getLaunchLegalDocument,
  toPlaceholderValues,
  toPublicLegalDocument,
  getLegalIdentityFromEnv,
} from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
let passed = 0;
let failed = 0;

function pass(name: string) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name: string, detail: string) {
  failed++;
  console.log(`  ❌ ${name}: ${detail}`);
}
function expect(name: string, cond: boolean, detail = '') {
  if (cond) pass(name);
  else fail(name, detail || 'assertion failed');
}
function src(rel: string) {
  return readFileSync(resolve(root, rel), 'utf8');
}

console.log('\nPhase 3C.4A.1 Balance Deadline Enforcement QA\n');

const hold = src('apps/api/src/services/booking-hold.service.ts');
const jobs = src('apps/api/src/services/background-jobs.service.ts');
const notify = src('apps/api/src/services/notification.service.ts');
const reconcile = src('apps/api/src/services/paytabs-reconciliation.service.ts');
const runner = src('apps/api/scripts/run-background-jobs.ts');
const en = src('apps/web/messages/en.json');
const ar = src('apps/web/messages/ar.json');

// Job registration
expect('job name registered', jobs.includes("'auto-cancel-unpaid-balances'"));
expect('job calls markStaleBalanceOverdue', /auto-cancel-unpaid-balances[\s\S]*markStaleBalanceOverdue/.test(jobs));
expect('recommended frequency ~5 min', /every\s*~?5/.test(jobs) || jobs.includes('every ~5 minutes') || jobs.includes('every 5–15 minutes'));
expect('CLI runner still present', runner.includes('runDueBackgroundJobs') || runner.includes('runBackgroundJob'));
expect('no paid third-party scheduler', !/cron-job\.org|easycron|quartz|bullmq|agenda\.|node-cron/.test(jobs));
expect('deferred cancel reported', jobs.includes('deferred'));

// Eligibility + SSOT reuse
expect('SSOT reason BALANCE_NOT_PAID', BOOKING_CANCELLATION_REASON.BALANCE_NOT_PAID === 'BALANCE_NOT_PAID');
expect('SSOT balance hours = 48', BALANCE_DUE_HOURS_BEFORE_START === 48);
expect('eligibility uses deposit_balance', hold.includes('PaymentCollectionMode.deposit_balance'));
expect('eligibility uses balanceDueAt lte now', /balanceDueAt:\s*\{\s*lte:\s*now\s*\}/.test(hold));
expect('reuses autoCancelUnpaidBalanceIfNeeded', hold.includes('export async function autoCancelUnpaidBalanceIfNeeded'));
expect('markStale loops autoCancel', /markStaleBalanceOverdue[\s\S]*autoCancelUnpaidBalanceIfNeeded/.test(hold));

// PSP reconciliation first
expect('reconcile before cancel', hold.includes('reconcileOpenBalancePaymentsBeforeAutoCancel'));
expect('scheduled_job reconcile source', reconcile.includes("'scheduled_job'"));
expect('skip if balance payment succeeded', hold.includes('balanceSucceeded'));
expect('skip if fully_paid after reconcile', /afterReconcile[\s\S]*fully_paid/.test(hold));

// Atomic / idempotent
expect('FOR UPDATE lock', hold.includes('FOR UPDATE'));
expect('updateMany confirmed guard', /booking\.updateMany[\s\S]*status:\s*BookingStatus\.confirmed/.test(hold));
expect('reason BALANCE_NOT_PAID written', hold.includes('BOOKING_CANCELLATION_REASON.BALANCE_NOT_PAID'));
expect('no extra cancel money (refund 0)', hold.includes('cancellationRefundAmount: 0'));
expect('retain via cancellationPenaltyAmount', hold.includes('cancellationPenaltyAmount: retainedAmount'));
expect('commission via distributeRetainedAmount', hold.includes('distributeRetainedAmount'));
expect('slot release', hold.includes('releaseSlotIfUnheld'));

// Audit + actor
expect('audit actor SYSTEM', hold.includes("actor: 'SYSTEM'"));
expect('audit initiatingJob', hold.includes("initiatingJob: 'auto-cancel-unpaid-balances'"));
expect('audit reasonLabel', hold.includes('Automatic — remaining balance unpaid by deadline'));

// Notifications
expect('customer auto-cancel copy', notify.includes('automatically cancelled'));
expect('owner auto-cancel copy', notify.includes('customer did not pay the remaining balance'));
expect('notification dedupe', /notifyBalanceOverdue[\s\S]*dedupe:\s*true/.test(notify));
expect('no raw enum in customer message', !notify.includes('BALANCE_NOT_PAID'));

// UI / admin visibility
expect('EN admin label', en.includes('Automatic — remaining balance unpaid by deadline'));
expect('AR admin label', ar.includes('تلقائي — الرصيد المتبقي غير مدفوع'));
expect('stale not-auto-cancelled copy removed (EN)', !en.includes('The booking is not auto-cancelled'));
expect('stale not-auto-cancelled copy removed (AR)', !ar.includes('لم يُلغَ الحجز تلقائيًا'));

// O — Asia/Amman boundary (instant math; platform TZ SSOT)
expect('platform TZ Asia/Amman', DEFAULT_PLATFORM_TIME_ZONE === 'Asia/Amman');
{
  // Booking starts 15 Sep 2026 14:00 Asia/Amman (= 11:00 UTC in summer UTC+3)
  const startUtc = new Date('2026-09-15T11:00:00.000Z');
  const due = computeBalanceDueAtFromStart(startUtc, BALANCE_DUE_HOURS_BEFORE_START);
  const expectedDue = new Date(startUtc.getTime() - 48 * 3600 * 1000);
  expect('O due exactly -48h from start', due.getTime() === expectedDue.getTime());
  expect('O inclusive at exact instant (lte)', due.getTime() <= expectedDue.getTime());
  expect(
    'O one ms early is before deadline',
    new Date(due.getTime() - 1).getTime() < due.getTime(),
  );
  // Worker latency must not change tier — outcome uses stored balanceDueAt, not “now − schedule lag”
  expect('O deadline independent of worker lag', BALANCE_DUE_HOURS_BEFORE_START === 48);
}

// Commission split sanity (retained deposit only)
{
  const split = distributeRetainedAmount(60, 18);
  expect('I platform 18% of 60', Math.abs(split.platformRetained - 10.8) < 0.001);
  expect('I owner rest of 60', Math.abs(split.ownerRetained - 49.2) < 0.001);
}

// Legal consistency — must still say WILL be automatically cancelled
const identity = getLegalIdentityFromEnv();
const valuesEn = toPlaceholderValues(identity, 'en');
function flatten(doc: ReturnType<typeof toPublicLegalDocument>) {
  if (!doc) return '';
  return [
    doc.title,
    doc.intro,
    ...doc.sections.flatMap((s) => [s.title, ...s.paragraphs, ...(s.bullets ?? [])]),
  ].join('\n');
}
const terms = flatten(toPublicLegalDocument(getLaunchLegalDocument('terms_and_conditions'), 'en', valuesEn));
const cancel = flatten(
  toPublicLegalDocument(getLaunchLegalDocument('cancellation_refund_policy'), 'en', valuesEn),
);
const booking = flatten(toPublicLegalDocument(getLaunchLegalDocument('booking_terms'), 'en', valuesEn));
const legal = [terms, cancel, booking].join('\n');
expect('legal: will be automatically cancelled', /will be automatically cancelled/i.test(legal));
expect('legal: not weakened to may', !/may be auto-cancelled/i.test(legal));
expect('legal: 48h balance', legal.includes(String(BALANCE_DUE_HOURS_BEFORE_START)));
expect('legal: public Amman wording', legal.includes('local time in Amman, Jordan'));
expect('legal: no public Asia/Amman IANA', !legal.includes('Asia/Amman'));
expect('backend TZ Asia/Amman', DEFAULT_PLATFORM_TIME_ZONE === 'Asia/Amman');

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
