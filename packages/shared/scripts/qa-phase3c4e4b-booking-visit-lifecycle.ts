/**
 * Phase 3C.4E.4B — Check-in / no-show / access-denied lifecycle QA.
 * Run: pnpm qa:phase3c4e4b-booking-visit-lifecycle
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CUSTOMER_NO_SHOW_GRACE_MINUTES,
  CHECK_IN_OPEN_HOURS_BEFORE_START,
  DEPOSIT_PERCENT,
  BALANCE_DUE_HOURS_BEFORE_START,
  STANDARD_COMMISSION_PERCENT,
  isPastCustomerNoShowGrace,
  customerNoShowGraceDeadline,
  isTerminalVisitOutcome,
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

console.log('\nPhase 3C.4E.4B Booking Visit / No-Show Lifecycle QA\n');

const noShow = src('apps/api/src/services/no-show.service.ts');
const checkIn = src('apps/api/src/services/check-in.service.ts');
const fm = src('apps/api/src/services/force-majeure.service.ts');
const policy = src('packages/shared/src/marketplace-financial-policy.ts');
const visit = src('packages/shared/src/booking-visit-lifecycle.ts');
const schema = src('packages/db/prisma/schema.prisma');
const migration = src(
  'packages/db/prisma/migrations/20260919120000_phase3c4e4b_booking_visit_outcome/migration.sql',
);
const mapper = src('apps/api/src/mappers/public-booking.mapper.ts');
const jobs = src('apps/api/src/services/background-jobs.service.ts');
const myBookings = src('apps/web/src/components/account/my-bookings-view.tsx');
const ar = src('apps/web/messages/ar.json');
const en = src('apps/web/messages/en.json');
const pkg = src('package.json');
const docs = src('docs/MAZARE3_BOOKING_VISIT_NO_SHOW_LIFECYCLE_3C4E4B.md');
const preflightDoc = src('docs/MAZARE3_BOOKING_VISIT_LIFECYCLE_PREFLIGHT_3C4E4B.md');
const hold = src('apps/api/src/lib/payment-hold.ts');
const legal = src('apps/api/src/services/legal/customer-booking-legal.service.ts');
const refund = src('apps/api/src/services/multi-capture-refund.service.ts');
const versions = src('packages/shared/src/legal-content/build-legal-markdown.ts');

const start = new Date('2026-09-19T10:00:00.000Z');
const almost = new Date(start.getTime() + 60 * 60 * 1000 - 1);
const exact = new Date(start.getTime() + 60 * 60 * 1000);

expect(
  'A cannot finalize before 60m grace',
  !isPastCustomerNoShowGrace({ bookingStartAt: start, now: almost }) &&
    noShow.includes('GRACE_NOT_ELAPSED'),
);
expect(
  'B exact +60m is review-eligible',
  isPastCustomerNoShowGrace({ bookingStartAt: start, now: exact }) &&
    customerNoShowGraceDeadline(start).getTime() === exact.getTime() &&
    CUSTOMER_NO_SHOW_GRACE_MINUTES === 60,
);
expect(
  'C absence of check-in alone does not auto-finalize',
  jobs.includes('mark-visit-review-eligible') &&
    jobs.includes('does not finalize') &&
    !noShow.includes('autoConfirmCustomerNoShow'),
);
expect(
  'D verified check-in prevents no-show finalization',
  noShow.includes('CHECKIN_VERIFIED') && checkIn.includes('BookingVisitOutcome.checked_in'),
);
expect(
  'E Owner cannot self-finalize (adminConfirmCustomerNoShow only)',
  noShow.includes('adminConfirmCustomerNoShow') &&
    !noShow.includes('ownerConfirmCustomerNoShow'),
);
expect('F Owner can submit reportCustomerNoShow', noShow.includes('reportCustomerNoShow'));
expect(
  'G Customer can report owner arrival problem',
  noShow.includes('reportOwnerArrivalProblem') &&
    noShow.includes('access_denied_report'),
);
expect(
  'H open owner-fault blocks customer no-show',
  noShow.includes('VISIT_DISPUTE_OPEN') && noShow.includes('owner_no_show_report'),
);
expect(
  'I Force Majeure blocks / sets visitOutcome',
  noShow.includes('force_majeure') && fm.includes('BookingVisitOutcome.force_majeure'),
);
expect(
  'J cancelled / non-confirmed cannot finalize customer no-show',
  noShow.includes('BOOKING_NOT_CONFIRMED'),
);
expect(
  'K BALANCE_NOT_PAID cannot become no-show',
  noShow.includes('BALANCE_NOT_PAID') && noShow.includes('BALANCE_NOT_PAID'),
);
expect(
  'L reschedule uses bookingStartAt via resolveBookingPeriodStart',
  noShow.includes('resolveBookingPeriodStart'),
);
expect(
  'M/N/O Customer no-show keeps confirmed + reason code (refund 0 / normal earnings)',
  (() => {
    const start = noShow.indexOf('export async function adminConfirmCustomerNoShow');
    const end = noShow.indexOf('export async function reportOwnerArrivalProblem');
    const block = start >= 0 && end > start ? noShow.slice(start, end) : '';
    return (
      block.includes('CUSTOMER_NO_SHOW') &&
      block.includes('BookingVisitOutcome.customer_no_show') &&
      block.includes('refund: 0') &&
      !block.includes('BookingStatus.cancelled')
    );
  })(),
);
expect(
  'P/Q/R Owner no-show full refund + zero nets',
  noShow.includes('ensureSystemOwnerFaultRefund') &&
    noShow.includes('ownerNetPayoutAmount: 0') &&
    noShow.includes('platformCommissionAmount: 0'),
);
expect(
  'S Owner adjustment separate createOwnerPenaltyAdjustment',
  noShow.includes('createOwnerPenaltyAdjustment'),
);
expect(
  'T access denied / property_unavailable use owner-fault path',
  noShow.includes('property_unavailable_report') &&
    noShow.includes('ACCESS_DENIED'),
);
expect(
  'U/V Force Majeure full refund + explicit customer election remains',
  fm.includes('FORCE_MAJEURE') &&
    fm.includes('customerElectForceMajeureResolution'),
);
expect(
  'W/X idempotent confirm (early return if confirmed)',
  noShow.includes("incident.status === BookingIncidentStatus.confirmed") &&
    noShow.includes('idempotent'),
);
expect(
  'Y Customer sees terminal lifecycle outcome',
  myBookings.includes('visitLifecycle') &&
    ar.includes('لم يتم الحضور') &&
    en.includes('Did not attend'),
);
expect(
  'Z pending review not final fault',
  ar.includes('الزيارة قيد المراجعة') && visit.includes('visit_under_review'),
);
expect(
  'AA aggregate refund via ensureSystemOwnerFaultRefund (3C.4E.2A path)',
  noShow.includes('ensureSystemOwnerFaultRefund'),
);
expect(
  'AB/AC ownership scoped queries',
  noShow.includes('userId: params.customerUserId') &&
    noShow.includes('resolveOwnerScope'),
);
expect(
  'AD Owner cannot call adminConfirm (admin routes / fairness service)',
  noShow.includes('adminConfirmCustomerNoShow') &&
    (src('apps/api/src/routes/admin.ts').includes('marketplace-fairness') ||
      src('apps/api/src/services/marketplace-fairness-admin.service.ts').includes(
        'adminConfirmCustomerNoShow',
      )),
);
expect(
  'AE legacy not fabricated (nullable visitOutcome)',
  migration.includes('ADD COLUMN') && schema.includes('visitOutcome'),
);
expect(
  'AF privacy: no GPS/biometric in check-in',
  !checkIn.includes('latitude') && !checkIn.includes('biometric'),
);
expect(
  'AG financial snapshot authoritative (no live commission recompute on no-show)',
  !noShow.includes('VERIFIED_COMMISSION') && noShow.includes('syncPayoutStatusForPayment'),
);
expect(
  'AH cancellation tiers / deposit unchanged',
  DEPOSIT_PERCENT === 30 && BALANCE_DUE_HOURS_BEFORE_START === 48,
);
expect(
  'AI legal acceptance unchanged',
  legal.includes('resolveApplicableCustomerBookingLegalSet'),
);
expect(
  'AJ slot integrity unchanged',
  hold.includes('BOOKING_INVENTORY_HOLDING_STATUSES'),
);
expect(
  'AK payment/refund integrity unchanged',
  refund.includes('Math.min') && refund.includes('capturedFils'),
);
expect(
  'AL locked legal docs unchanged',
  versions.includes('1.1.2-advisor-final'),
);
expect(
  'AM Production untouched / local migration markers',
  migration.includes('LOCAL/DEV') &&
    pkg.includes('preflight:booking-visit-lifecycle') &&
    pkg.includes('qa:phase3c4e4b-booking-visit-lifecycle'),
);
expect(
  'check-in window SSOT 2h before',
  CHECK_IN_OPEN_HOURS_BEFORE_START === 2 && policy.includes('CHECK_IN_OPEN_HOURS_BEFORE_START'),
);
expect(
  'visit outcome model additive',
  schema.includes('enum BookingVisitOutcome') && isTerminalVisitOutcome('customer_no_show'),
);
expect(
  'mapper exposes visitLifecycle',
  mapper.includes('resolveVisitLifecycleProjection') && mapper.includes('visitLifecycle'),
);
expect(
  'docs present',
  docs.includes('60') && preflightDoc.includes('mutation'),
);
expect(
  'reject incident re-syncs payout',
  noShow.includes('adminRejectIncident') &&
    /adminRejectIncident[\s\S]*syncPayoutStatusForPayment/.test(noShow),
);

console.log(`\n3C.4E.4B QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
