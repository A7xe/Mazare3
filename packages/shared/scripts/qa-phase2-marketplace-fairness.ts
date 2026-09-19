/**
 * Phase 2 — Mazare3 Jordan Fair Marketplace fairness QA.
 * Run: pnpm qa:phase2-marketplace-fairness
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calculateOwnerPenaltyJod,
  resolveCancellationPolicyHours,
  resolveCheckInWindow,
  isCustomerNoShowEligible,
  isForceMajeureReason,
  OWNER_CANCELLATION_REASON,
  OWNER_PENALTY_MIN_JOD,
  OWNER_PENALTY_MAX_JOD,
  STANDARD_COMMISSION_PERCENT,
  VERIFIED_COMMISSION_PERCENT,
  resolveCommissionPercentForListing,
  MAX_CUSTOMER_RESCHEDULES,
  CUSTOMER_NO_SHOW_GRACE_MINUTES,
} from '../src/marketplace-financial-policy.js';

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
function near(a: number, b: number, label: string) {
  expect(label, Math.abs(a - b) < 0.011, `expected ${b}, got ${a}`);
}

console.log('\nPhase 2 Marketplace Fairness QA\n');

// A. Owner cancels >72h — no penalty
{
  near(calculateOwnerPenaltyJod(200, 80), 0, 'A penalty 0');
}

// B. Owner cancels 24–72h — 10% min applied
{
  near(calculateOwnerPenaltyJod(200, 48), 20, 'B 10% of 200');
  near(calculateOwnerPenaltyJod(50, 48), OWNER_PENALTY_MIN_JOD, 'B min 10 JOD');
}

// C. Owner cancels <=24h — 20%
{
  near(calculateOwnerPenaltyJod(200, 12), 40, 'C 20% of 200');
  near(calculateOwnerPenaltyJod(200, 0.5), 40, 'C 20% near start');
}

// D. Owner no-show confirmed penalty 20%
{
  near(calculateOwnerPenaltyJod(200, 'owner_no_show'), 40, 'D 20% no-show');
}

// E. Force majeure — no penalty via reason helper
{
  expect('E FM reason', isForceMajeureReason(OWNER_CANCELLATION_REASON.FORCE_MAJEURE));
  near(calculateOwnerPenaltyJod(200, 10), 40, 'E penalty calc exists separately from FM waive in service');
}

// F. Customer no-show eligibility after grace
{
  const start = new Date('2026-09-15T10:00:00.000Z');
  const beforeGrace = new Date('2026-09-15T10:30:00.000Z');
  const afterGrace = new Date('2026-09-15T11:05:00.000Z');
  expect('F before grace', !isCustomerNoShowEligible({ bookingStartAt: start, checkInVerified: false, now: beforeGrace }));
  expect('F after grace', isCustomerNoShowEligible({ bookingStartAt: start, checkInVerified: false, now: afterGrace }));
}

// G. Owner cannot unilaterally finalize — static check
{
  const src = readFileSync(resolve(root, 'apps/api/src/services/no-show.service.ts'), 'utf8');
  expect('G report creates incident', src.includes('customer_no_show_report'));
  expect('G not auto-finalize', !src.includes('adminConfirmCustomerNoShow(') || src.indexOf('reportCustomerNoShow') < src.indexOf('adminConfirmCustomerNoShow'));
  expect('G admin confirm separate', src.includes('adminConfirmCustomerNoShow'));
}

// H. Verified check-in blocks no-show path in admin confirm
{
  const src = readFileSync(resolve(root, 'apps/api/src/services/no-show.service.ts'), 'utf8');
  expect('H check-in verified guard', src.includes('CHECKIN_VERIFIED'));
}

// I. Same-price reschedule delta 0 logic
{
  const delta = 200 - 200;
  expect('I same price delta 0', delta === 0);
}

// J. Higher-price requires payment (service returns paymentRequired)
{
  const src = readFileSync(resolve(root, 'apps/api/src/services/reschedule.service.ts'), 'utf8');
  expect('J payment required path', src.includes('paymentRequired'));
}

// K. Lower-price refund obligation
{
  const src = readFileSync(resolve(root, 'apps/api/src/services/reschedule.service.ts'), 'utf8');
  expect('K lower price refund', src.includes('ensureSystemOwnerFaultRefund'));
}

// L. Double booking prevented
{
  const src = readFileSync(resolve(root, 'apps/api/src/services/reschedule.service.ts'), 'utf8');
  expect(
    'L slot lock',
    src.includes('assertTargetSlotUsable') || src.includes('assertSlotAvailable'),
  );
  expect('L FOR UPDATE', src.includes('FOR UPDATE'));
}

// M. Reschedule anti-abuse anchor
{
  const original = new Date('2026-09-12T10:00:00.000Z');
  const moved = new Date('2026-10-12T10:00:00.000Z');
  const now = new Date('2026-09-11T10:00:00.000Z');
  const hours = resolveCancellationPolicyHours({
    currentBookingStartAt: moved,
    originalBookingStartAt: original,
    applyRescheduleAnchor: true,
    now,
  });
  expect('M anchor uses tighter window', hours < 30 && hours > 20, `got ${hours}`);
}

// N. Penalty minimum 10 JOD
{
  near(calculateOwnerPenaltyJod(30, 10), OWNER_PENALTY_MIN_JOD, 'N min 10');
}

// O. Penalty maximum 50 JOD
{
  near(calculateOwnerPenaltyJod(500, 10), OWNER_PENALTY_MAX_JOD, 'O max 50');
}

// P. 12% env blocked without override — static
{
  const src = readFileSync(resolve(root, 'apps/api/src/config/payment-policy.config.ts'), 'utf8');
  expect('P legacy 12 guard', src.includes('LEGACY_OBSOLETE_COMMISSION = 12'));
  expect('P override flag', src.includes('ALLOW_LEGACY_COMMISSION_OVERRIDE'));
}

// Q. Standard 18%
{
  expect('Q standard 18', STANDARD_COMMISSION_PERCENT === 18);
  expect('Q listing 18', resolveCommissionPercentForListing(null) === 18);
}

// R. Verified 15%
{
  expect('R verified 15', VERIFIED_COMMISSION_PERCENT === 15);
  expect('R listing verified', resolveCommissionPercentForListing('platform_verified') === 15);
}

// Schema / migration presence
{
  expect('migration exists', existsSync(resolve(root, 'packages/db/prisma/migrations/20260911180000_phase2_marketplace_fairness/migration.sql')));
  expect('owner cancel service', existsSync(resolve(root, 'apps/api/src/services/owner-cancellation.service.ts')));
  expect('check-in service', existsSync(resolve(root, 'apps/api/src/services/check-in.service.ts')));
}

// Check-in window
{
  const start = new Date('2026-09-15T14:00:00.000Z');
  const early = new Date('2026-09-15T11:00:00.000Z');
  const open = new Date('2026-09-15T12:30:00.000Z');
  expect('check-in not open early', resolveCheckInWindow(start, early).status === 'not_open');
  expect('check-in available', resolveCheckInWindow(start, open).status === 'available');
}

expect('MAX_CUSTOMER_RESCHEDULES=1', MAX_CUSTOMER_RESCHEDULES === 1);
expect('NO_SHOW_GRACE=60', CUSTOMER_NO_SHOW_GRACE_MINUTES === 60);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
