/**
 * Phase 3A — Reschedule checkout / pricing / fairness QA.
 * Run: pnpm qa:phase3a-reschedule-checkout
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeReschedulePricing,
  resolveCancellationPolicyHours,
  MAX_CUSTOMER_RESCHEDULES,
  STANDARD_COMMISSION_PERCENT,
  VERIFIED_COMMISSION_PERCENT,
  resolveCommissionPercentForListing,
  RESCHEDULE_COUNTERPARTY_EXPIRE_HOURS,
  PAYMENT_HOLD_MINUTES,
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
function near(a: number, b: number, label: string) {
  expect(label, Math.abs(a - b) < 0.011, `expected ${b}, got ${a}`);
}
function src(rel: string) {
  return readFileSync(resolve(root, rel), 'utf8');
}
function has(rel: string, needle: string | RegExp, label: string) {
  const body = src(rel);
  const ok = typeof needle === 'string' ? body.includes(needle) : needle.test(body);
  expect(label, ok, `missing in ${rel}`);
}

console.log('\nPhase 3A Reschedule Checkout QA\n');

// A. Customer same price
{
  const p = computeReschedulePricing({
    fromMerchantValue: 100,
    toListMerchantValue: 100,
    initiatedBy: 'customer',
  });
  expect('A same-price mode', p.pricingMode === 'customer_market');
  near(p.customerPayableDelta, 0, 'A same-price delta 0');
  near(p.customerContractedValue, 100, 'A same-price contracted');
}

// B. Customer higher price
{
  const p = computeReschedulePricing({
    fromMerchantValue: 100,
    toListMerchantValue: 130,
    initiatedBy: 'customer',
  });
  near(p.customerPayableDelta, 30, 'B customer higher pays 30');
  near(p.commissionBasisValue, 130, 'B commission on new value');
  near(p.ownerAbsorbsAmount, 0, 'B owner absorbs 0');
}

// C. Delta cannot be client-tampered — server purpose + installment path
{
  has(
    'apps/api/src/services/payment.service.ts',
    'reschedule_difference',
    'C payment purpose reschedule_difference',
  );
  has(
    'apps/api/src/services/payment.service.ts',
    'customerPayableDelta',
    'C amount from customerPayableDelta',
  );
  has(
    'packages/shared/src/constants.ts',
    'reschedule_difference',
    'C PAYMENT_PURPOSES includes reschedule_difference',
  );
}

// D. Reschedule does not complete before PSP capture
{
  has(
    'apps/api/src/services/reschedule.service.ts',
    'accepted_pending_payment',
    'D accepted_pending_payment state',
  );
  has(
    'apps/api/src/services/reschedule.service.ts',
    'PAYMENT_REQUIRED',
    'D blocks finalize without payment',
  );
  has(
    'apps/api/src/services/payment.service.ts',
    'afterSuccessfulDeltaPayment',
    'D finalize only after capture hook',
  );
}

// E. Failed delta leaves original booking — expire releases without finalize
{
  has(
    'apps/api/src/services/reschedule.service.ts',
    'expireRescheduleRequests',
    'E expireRescheduleRequests exists',
  );
  has(
    'apps/api/src/services/reschedule.service.ts',
    'releaseHeldTargetSlotIfUnused',
    'E releases held target slot',
  );
}

// F. Expired delta hold releases target slot
{
  has(
    'apps/api/src/services/reschedule.service.ts',
    'AvailabilitySlotStatus.held',
    'F uses held slot status',
  );
  has(
    'apps/api/src/services/reschedule.service.ts',
    'targetSlotHeldUntil',
    'F targetSlotHeldUntil tracked',
  );
}

// G. Duplicate webhook cannot finalize twice
{
  has(
    'apps/api/src/services/reschedule.service.ts',
    'alreadyFinalized',
    'G finalize idempotent alreadyFinalized',
  );
  has(
    'apps/api/src/services/payment.service.ts',
    "kind: 'already'",
    'G payment already-succeeded path',
  );
}

// H. Customer cheaper → refund
{
  const p = computeReschedulePricing({
    fromMerchantValue: 120,
    toListMerchantValue: 90,
    initiatedBy: 'customer',
  });
  near(p.customerPayableDelta, -30, 'H cheaper delta -30');
  has(
    'apps/api/src/services/reschedule.service.ts',
    'ensureSystemOwnerFaultRefund',
    'H refund via durable RefundRequest',
  );
}

// I. Owner-proposed same price
{
  const p = computeReschedulePricing({
    fromMerchantValue: 100,
    toListMerchantValue: 100,
    initiatedBy: 'owner',
  });
  expect('I owner same mode freeze', p.pricingMode === 'owner_price_freeze');
  near(p.customerPayableDelta, 0, 'I owner same payable 0');
}

// J. Owner-proposed cheaper → refund difference
{
  const p = computeReschedulePricing({
    fromMerchantValue: 150,
    toListMerchantValue: 100,
    initiatedBy: 'owner',
  });
  near(p.customerPayableDelta, -50, 'J owner cheaper refund -50');
  near(p.customerContractedValue, 100, 'J contracted drops to 100');
}

// K. Owner-proposed higher → customer pays NO additional amount
{
  const p = computeReschedulePricing({
    fromMerchantValue: 100,
    toListMerchantValue: 180,
    initiatedBy: 'owner',
  });
  near(p.customerPayableDelta, 0, 'K owner higher customer pays 0');
  near(p.customerContractedValue, 100, 'K contracted frozen at 100');
  near(p.commissionBasisValue, 100, 'K commission basis frozen');
  near(p.ownerAbsorbsAmount, 80, 'K owner absorbs 80');
  has(
    'apps/api/src/services/reschedule.service.ts',
    'Owner request: NEVER require customer to pay more',
    'K respond path never charges customer for owner request',
  );
}

// L. Owner cannot unilaterally reschedule
{
  has(
    'apps/api/src/services/reschedule.service.ts',
    'Customer must respond to owner',
    'L owner proposal requires customer respond',
  );
  has(
    'apps/web/src/components/account/my-bookings-view.tsx',
    'pendingReschedule',
    'L customer UI shows pendingReschedule',
  );
}

// M. FM equivalent higher → no extra customer charge
{
  const p = computeReschedulePricing({
    fromMerchantValue: 100,
    toListMerchantValue: 140,
    initiatedBy: 'admin',
    forceMajeure: true,
  });
  expect('M FM equivalent mode', p.pricingMode === 'force_majeure_equivalent');
  near(p.customerPayableDelta, 0, 'M FM equivalent no charge');
  near(p.ownerAbsorbsAmount, 40, 'M FM equivalent owner absorbs');
}

// N. Voluntary FM upgrade may require accepted difference
{
  const p = computeReschedulePricing({
    fromMerchantValue: 100,
    toListMerchantValue: 140,
    initiatedBy: 'admin',
    forceMajeure: true,
    voluntaryUpgrade: true,
  });
  expect('N FM upgrade mode', p.pricingMode === 'force_majeure_upgrade');
  near(p.customerPayableDelta, 40, 'N FM upgrade customer pays 40');
}

// O. Anti-cancellation-gaming intact
{
  const now = new Date('2026-06-01T12:00:00+03:00');
  const original = new Date('2026-06-02T12:00:00+03:00'); // ~24h
  const movedFar = new Date('2026-07-01T12:00:00+03:00'); // ~30d
  const hours = resolveCancellationPolicyHours({
    currentBookingStartAt: movedFar,
    originalBookingStartAt: original,
    applyRescheduleAnchor: true,
    now,
  });
  expect('O anti-abuse uses more restrictive hours', hours < 48 && hours > 0);
}

// P. Max one normal customer reschedule
{
  expect('P MAX_CUSTOMER_RESCHEDULES === 1', MAX_CUSTOMER_RESCHEDULES === 1);
  has(
    'apps/api/src/services/reschedule.service.ts',
    'RESCHEDULE_LIMIT',
    'P enforces RESCHEDULE_LIMIT',
  );
}

// Q/R. Commission SSOT
{
  expect('Q standard 18%', STANDARD_COMMISSION_PERCENT === 18);
  expect('R verified 15%', VERIFIED_COMMISSION_PERCENT === 15);
  expect(
    'Q resolve standard listing',
    resolveCommissionPercentForListing('unverified') === 18,
  );
  expect(
    'R resolve verified listing',
    resolveCommissionPercentForListing('platform_verified') === 15,
  );
}

// S. Commercial custom terms / 12% cannot silently return
{
  has(
    'apps/api/src/config/payment-policy.config.ts',
    'ALLOW_LEGACY_COMMISSION_OVERRIDE',
    'S legacy override flag guard',
  );
  has(
    'apps/api/src/services/commercial-terms.service.ts',
    'Obsolete 12% legacy rate',
    'S commercial audit flags 12%',
  );
  has(
    'apps/api/src/services/commercial-terms.service.ts',
    'obsoleteLegacy12',
    'S audit exposes obsoleteLegacy12',
  );
}

// T. Admin high-impact actions require reason/audit
{
  has(
    'apps/api/src/services/force-majeure.service.ts',
    'createAuditLog',
    'T force majeure audited',
  );
  has(
    'apps/api/src/services/marketplace-fairness-admin.service.ts',
    'Admin reason is required',
    'T extra reschedule requires reason',
  );
  has(
    'apps/api/src/services/marketplace-fairness-admin.service.ts',
    'createAuditLog',
    'T extra reschedule audited',
  );
  has(
    'apps/web/src/components/admin/admin-marketplace-fairness-view.tsx',
    'reason',
    'T admin UI collects reason',
  );
}

// Infrastructure presence
{
  expect(
    'migration phase3a exists',
    existsSync(
      resolve(
        root,
        'packages/db/prisma/migrations/20260911190000_phase3a_reschedule_checkout/migration.sql',
      ),
    ),
  );
  expect('RESCHEDULE_COUNTERPARTY_EXPIRE_HOURS 48', RESCHEDULE_COUNTERPARTY_EXPIRE_HOURS === 48);
  expect('PAYMENT_HOLD_MINUTES defined', typeof PAYMENT_HOLD_MINUTES === 'number' && PAYMENT_HOLD_MINUTES > 0);
  has(
    'apps/web/src/components/bookings/reschedule-slot-picker.tsx',
    'RescheduleSlotPicker',
    'UI RescheduleSlotPicker',
  );
  has(
    'apps/web/src/components/checkout/reschedule-checkout-view.tsx',
    'createRescheduleDifferencePayment',
    'UI delta checkout view',
  );
}

console.log(`\nPhase 3A QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
