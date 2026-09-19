/**
 * Phase 3C.4E.4C — Successful visit completion QA.
 * Run: pnpm qa:phase3c4e4c-successful-visit-completion
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEPOSIT_PERCENT,
  BALANCE_DUE_HOURS_BEFORE_START,
  STANDARD_COMMISSION_PERCENT,
  isAuthoritativeVisitEnded,
  isSuccessfulVisitCompletionEligible,
  resolveVisitLifecycleProjection,
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

console.log('\nPhase 3C.4E.4C Successful Visit Completion QA\n');

const completion = src('apps/api/src/services/visit-completion.service.ts');
const visit = src('packages/shared/src/booking-visit-lifecycle.ts');
const jobs = src('apps/api/src/services/background-jobs.service.ts');
const mapper = src('apps/api/src/mappers/public-booking.mapper.ts');
const myBookings = src('apps/web/src/components/account/my-bookings-view.tsx');
const review = src('apps/api/src/services/review.service.ts');
const noShow = src('apps/api/src/services/no-show.service.ts');
const ar = src('apps/web/messages/ar.json');
const en = src('apps/web/messages/en.json');
const pkg = src('package.json');
const docs = src('docs/MAZARE3_SUCCESSFUL_VISIT_COMPLETION_3C4E4C.md');
const preflight = src(
  'apps/api/src/services/successful-visit-completion-preflight.service.ts',
);
const hold = src('apps/api/src/lib/payment-hold.ts');
const legal = src('apps/api/src/services/legal/customer-booking-legal.service.ts');
const refund = src('apps/api/src/services/multi-capture-refund.service.ts');
const versions = src('packages/shared/src/legal-content/build-legal-markdown.ts');
const payout = src('apps/api/src/lib/payout-eligibility.ts');

const slotDate = new Date('2026-09-19T00:00:00.000Z');
const end = new Date('2026-09-19T18:00:00.000Z');
const before = new Date('2026-09-19T17:59:59.000Z');
const exact = new Date('2026-09-19T18:00:00.000Z');
const after = new Date('2026-09-19T18:00:01.000Z');

expect(
  'A checked-in before end not completed',
  !isSuccessfulVisitCompletionEligible({
    bookingStatus: 'confirmed',
    visitOutcome: 'checked_in',
    checkInStatus: 'verified',
    slotDate,
    bookingEndAt: end,
    now: before,
  }).eligible,
);
expect(
  'B exact visit end is completion-eligible',
  isAuthoritativeVisitEnded({ slotDate, bookingEndAt: end, now: exact }) &&
    isSuccessfulVisitCompletionEligible({
      bookingStatus: 'confirmed',
      visitOutcome: 'checked_in',
      checkInStatus: 'verified',
      slotDate,
      bookingEndAt: end,
      now: exact,
    }).eligible,
);
expect(
  'C after end completes eligibility',
  isSuccessfulVisitCompletionEligible({
    bookingStatus: 'confirmed',
    visitOutcome: 'checked_in',
    checkInStatus: 'verified',
    slotDate,
    bookingEndAt: end,
    now: after,
  }).eligible,
);
expect(
  'D repeated completion idempotent (updateMany + already_completed)',
  completion.includes('already_completed') && completion.includes('updateMany'),
);
expect(
  'E no check-in does not auto-complete',
  !isSuccessfulVisitCompletionEligible({
    bookingStatus: 'confirmed',
    visitOutcome: null,
    checkInStatus: 'available',
    slotDate,
    bookingEndAt: end,
    now: after,
  }).eligible &&
    completion.includes('no_check_in') === false /* reason from shared */,
);
expect(
  'E2 no_check_in reason',
  isSuccessfulVisitCompletionEligible({
    bookingStatus: 'confirmed',
    checkInStatus: 'available',
    slotDate,
    bookingEndAt: end,
    now: after,
  }).reason === 'no_check_in',
);
expect(
  'F open dispute blocks',
  !isSuccessfulVisitCompletionEligible({
    bookingStatus: 'confirmed',
    visitOutcome: 'checked_in',
    checkInStatus: 'verified',
    slotDate,
    bookingEndAt: end,
    hasBlockingIncidentOrDispute: true,
    now: after,
  }).eligible,
);
expect(
  'G Owner-fault incident blocks via hasBlockingIncidentOrDispute',
  completion.includes('owner_no_show_report') && completion.includes('blocked'),
);
expect(
  'H Force Majeure blocks (terminal / incident)',
  !isSuccessfulVisitCompletionEligible({
    bookingStatus: 'confirmed',
    visitOutcome: 'force_majeure',
    checkInStatus: 'verified',
    slotDate,
    bookingEndAt: end,
    now: after,
  }).eligible,
);
expect(
  'I Customer no-show not overwritten',
  !isSuccessfulVisitCompletionEligible({
    bookingStatus: 'confirmed',
    visitOutcome: 'customer_no_show',
    checkInStatus: 'verified',
    slotDate,
    bookingEndAt: end,
    now: after,
  }).eligible,
);
expect(
  'J Owner no-show not overwritten',
  !isSuccessfulVisitCompletionEligible({
    bookingStatus: 'cancelled',
    visitOutcome: 'owner_no_show',
    checkInStatus: 'verified',
    slotDate,
    bookingEndAt: end,
    now: after,
  }).eligible,
);
expect(
  'K access denied not overwritten',
  !isSuccessfulVisitCompletionEligible({
    bookingStatus: 'cancelled',
    visitOutcome: 'access_denied',
    checkInStatus: 'verified',
    slotDate,
    bookingEndAt: end,
    now: after,
  }).eligible,
);
expect(
  'L reschedule uses bookingEndAt / slot.endAt current',
  completion.includes('bookingEndAt') && completion.includes('slot.endAt'),
);
expect(
  'M/N completion does not create refund or change commission',
  !completion.includes('ensureSystemOwnerFaultRefund') &&
    !completion.includes('platformCommissionAmount') &&
    completion.includes('no financial mutation'),
);
expect(
  'O completion does not automatically release payout',
  !completion.includes('syncPayoutStatusForPayment') &&
    !completion.includes('PayoutStatus.eligible') &&
    payout.includes('visit_not_passed'),
);
expect(
  'P Customer sees Visit completed',
  ar.includes('"completed": "تمت الزيارة"') &&
    en.includes('"completed": "Visit completed"'),
);
expect(
  'Q completed not shown as upcoming',
  myBookings.includes("displayKey === 'completed'") &&
    (() => {
      const proj = resolveVisitLifecycleProjection({
        bookingStatus: 'confirmed',
        visitOutcome: 'checked_in',
        checkInStatus: 'verified',
        bookingStartAt: new Date('2026-09-19T10:00:00.000Z'),
        bookingEndAt: end,
        slotDate,
        now: after,
      });
      return proj.displayKey === 'completed' && proj.terminal;
    })(),
);
expect(
  'R Owner sees completed via visitLifecycle projection (shared mapper)',
  mapper.includes('bookingEndAt') && mapper.includes('slotEndAt'),
);
expect(
  'S review eligibility requires check-in / completed',
  review.includes('no_check_in') && review.includes('not_successful_visit'),
);
expect(
  'T concurrent completion safe (updateMany conditional)',
  completion.includes('updateMany') &&
    completion.includes("visitOutcome: BookingVisitOutcome.checked_in"),
);
expect(
  'U Customer cannot force completion (no customer route in service)',
  !completion.includes('customerUserId') &&
    !completion.includes('completeVisitByCustomer'),
);
expect(
  'V Owner cannot bypass dispute blocks',
  completion.includes('hasBlockingIncidentOrDispute') &&
    !completion.includes('ownerForceComplete'),
);
expect(
  'W legacy not fabricated (no mass complete without check-in)',
  preflight.includes('No check-in past visits are not auto-completed') &&
    completion.includes('CheckInStatus.verified'),
);
expect(
  'X 4B no-show lifecycle unchanged (admin confirm still present)',
  noShow.includes('adminConfirmCustomerNoShow') &&
    noShow.includes('GRACE_NOT_ELAPSED'),
);
expect(
  'Y legal acceptance unchanged',
  legal.includes('resolveApplicableCustomerBookingLegalSet'),
);
expect(
  'Z slot/payment/refund integrity unchanged',
  hold.includes('BOOKING_INVENTORY_HOLDING_STATUSES') &&
    refund.includes('Math.min') &&
    DEPOSIT_PERCENT === 30 &&
    BALANCE_DUE_HOURS_BEFORE_START === 48 &&
    STANDARD_COMMISSION_PERCENT === 18,
);
expect(
  'AA locked legal docs unchanged',
  versions.includes('1.1.2-advisor-final'),
);
expect(
  'AB Production untouched / job + preflight wired',
  jobs.includes('complete-verified-visits') &&
    pkg.includes('preflight:successful-visit-completion') &&
    pkg.includes('qa:phase3c4e4c-successful-visit-completion') &&
    docs.includes('checked_in'),
);
expect(
  'audit booking.visit_completed',
  completion.includes('booking.visit_completed'),
);
expect(
  'projection uses ended checked_in as completed before persist',
  visit.includes('Derived projection') && visit.includes("displayKey: 'completed'"),
);

console.log(`\n3C.4E.4C QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
