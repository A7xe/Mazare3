/**
 * Phase 1 — Mazare3 Jordan Fair Marketplace financial policy QA.
 * Run: pnpm qa:phase1-financial-policy
 */
import {
  calculateBookingFinancialSnapshot,
  calculatePlatformFundedSnapshot,
  computeBalanceDueAtFromStart,
} from '../src/booking-financials.js';
import {
  BALANCE_DUE_HOURS_BEFORE_START,
  DEPOSIT_PERCENT,
  distributeRetainedAmount,
  evaluateCancellationSettlement,
  FULL_PAYMENT_WITHIN_HOURS,
  resolveCommissionPercentForListing,
  resolvePaymentPlan,
  hoursUntilInstant,
  STANDARD_COMMISSION_PERCENT,
  VERIFIED_COMMISSION_PERCENT,
} from '../src/marketplace-financial-policy.js';

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
function near(a: number, b: number, label: string) {
  expect(label, Math.abs(a - b) < 0.011, `expected ${b}, got ${a}`);
}

console.log('\nPhase 1 Financial Policy QA\n');

// A. 200 JOD standard: commission 36, owner 164
{
  const snap = calculateBookingFinancialSnapshot({
    bookingTotalAmount: 200,
    depositPercent: DEPOSIT_PERCENT,
    platformCommissionPercent: STANDARD_COMMISSION_PERCENT,
    customerServiceFeePercent: 0,
    fullPayment: true,
  });
  near(snap.platformCommissionAmount, 36, 'A commission 36');
  near(snap.ownerNetPayoutAmount, 164, 'A owner 164');
}

// B. 200 verified: commission 30, owner 170
{
  const pct = resolveCommissionPercentForListing('platform_verified');
  expect('B verified percent', pct === VERIFIED_COMMISSION_PERCENT);
  const snap = calculateBookingFinancialSnapshot({
    bookingTotalAmount: 200,
    depositPercent: DEPOSIT_PERCENT,
    platformCommissionPercent: pct,
    customerServiceFeePercent: 0,
    fullPayment: true,
  });
  near(snap.platformCommissionAmount, 30, 'B commission 30');
  near(snap.ownerNetPayoutAmount, 170, 'B owner 170');
}

// C. >72h deposit 60 / balance 140
{
  const plan = resolvePaymentPlan({ hoursUntilStart: 100, customerPayable: 200 });
  expect('C deposit allowed', !plan.fullPaymentRequired);
  near(plan.depositAmount, 60, 'C deposit 60');
  near(plan.balanceAmount, 140, 'C balance 140');
}

// D. <=72h full 200 required
{
  const plan = resolvePaymentPlan({ hoursUntilStart: 48, customerPayable: 200 });
  expect('D full required', plan.fullPaymentRequired);
  near(plan.depositAmount, 200, 'D full 200');
  near(plan.balanceAmount, 0, 'D balance 0');
}

// E–H cancellation tiers
{
  const merchant = 200;
  const captured = 200;
  const commission = 18;

  const free = evaluateCancellationSettlement({
    merchantBookingValue: merchant,
    capturedAmount: captured,
    hoursUntilStart: 80,
    commissionPercent: commission,
  });
  near(free.customerRefund, 200, 'E free refund 200');
  near(free.retainedAmount, 0, 'E retained 0');

  const t30 = evaluateCancellationSettlement({
    merchantBookingValue: merchant,
    capturedAmount: captured,
    hoursUntilStart: 60,
    commissionPercent: commission,
  });
  near(t30.retainedAmount, 60, 'F 30% tier retain 60');
  near(t30.customerRefund, 140, 'F 30% tier refund 140');

  const t50 = evaluateCancellationSettlement({
    merchantBookingValue: merchant,
    capturedAmount: captured,
    hoursUntilStart: 36,
    commissionPercent: commission,
  });
  near(t50.retainedAmount, 100, 'G 50% tier retain 100');
  near(t50.customerRefund, 100, 'G 50% tier refund 100');

  const depositOnly = evaluateCancellationSettlement({
    merchantBookingValue: merchant,
    capturedAmount: 60,
    hoursUntilStart: 36,
    commissionPercent: commission,
  });
  near(depositOnly.retainedAmount, 60, 'H deposit-only retain 60 not 100');
  near(depositOnly.customerRefund, 0, 'H deposit-only refund 0');
}

// I. unpaid balance cancel retains 60 only (deposit captured)
{
  const settlement = evaluateCancellationSettlement({
    merchantBookingValue: 200,
    capturedAmount: 60,
    hoursUntilStart: -1,
    commissionPercent: 18,
  });
  expect('I past not cancellable', !settlement.canCancel);
}

// J. timing uses period start not midnight
{
  const start = new Date('2026-09-15T14:00:00.000Z');
  const now = new Date('2026-09-15T10:00:00.000Z');
  const hours = hoursUntilInstant(start, now);
  expect('J uses instant start', Math.abs(hours - 4) < 0.01, `got ${hours}`);
  const midnight = new Date('2026-09-15T00:00:00.000Z');
  const hoursMidnight = hoursUntilInstant(midnight, now);
  expect('J differs from midnight', Math.abs(hoursMidnight - hours) > 0.5);
  const due = computeBalanceDueAtFromStart(start, BALANCE_DUE_HOURS_BEFORE_START);
  expect(
    'J balance due 48h before start',
    due.getTime() === start.getTime() - BALANCE_DUE_HOURS_BEFORE_START * 3600000,
  );
}

// K. platform-funded coupon keeps owner on merchant value
{
  const snap = calculatePlatformFundedSnapshot({
    merchantBookingValue: 200,
    platformDiscountAmount: 40,
    depositPercent: DEPOSIT_PERCENT,
    platformCommissionPercent: STANDARD_COMMISSION_PERCENT,
    customerServiceFeePercent: 0,
  });
  near(snap.platformCommissionAmount, 36, 'K commission on merchant 200');
  near(snap.ownerNetPayoutAmount, 164, 'K owner on merchant 200');
  near(snap.customerPayableTotal, 160, 'K customer pays 160');
}

// L. refund obligation idempotent shape (pure — retained + refund = captured)
{
  const s = evaluateCancellationSettlement({
    merchantBookingValue: 200,
    capturedAmount: 150,
    hoursUntilStart: 60,
    commissionPercent: 18,
  });
  near(s.retainedAmount + s.customerRefund, 150, 'L retained+refund=captured');
  const split = distributeRetainedAmount(s.retainedAmount, 18);
  near(split.platformRetained + split.ownerRetained, s.retainedAmount, 'L split sums retained');
}

// Config SSOT spot checks
expect('FULL_PAYMENT_WITHIN_HOURS=72', FULL_PAYMENT_WITHIN_HOURS === 72);
expect('BALANCE_DUE=48', BALANCE_DUE_HOURS_BEFORE_START === 48);
expect('STANDARD=18', STANDARD_COMMISSION_PERCENT === 18);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
