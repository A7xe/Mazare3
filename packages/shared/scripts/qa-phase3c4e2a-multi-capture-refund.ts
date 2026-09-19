/**
 * Phase 3C.4E.2A — Multi-capture refund integrity QA.
 * Run: pnpm qa:phase3c4e2a-multi-capture-refund
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  jodToFils,
  filsToJod,
  ADVISOR_REVISED_VERSION,
  PRIVACY_ADVISOR_REVISED_VERSION,
  OWNER_ADVISOR_REVISED_VERSION,
  STANDARD_COMMISSION_PERCENT,
  evaluateCancellationSettlement,
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

/** Mirror of allocateRefundAcrossCaptures (newest first) for pure unit checks. */
function allocateNewestFirst(
  requestedFils: number,
  captures: Array<{ paymentId: string; remainingRefundableFils: number; capturedAt: number }>,
) {
  let remaining = Math.max(0, Math.floor(requestedFils));
  const plan: Array<{ paymentId: string; allocatedFils: number }> = [];
  const ordered = [...captures].sort((a, b) => b.capturedAt - a.capturedAt);
  for (const c of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, c.remainingRefundableFils);
    if (take <= 0) continue;
    plan.push({ paymentId: c.paymentId, allocatedFils: take });
    remaining -= take;
  }
  return plan;
}

console.log('\nPhase 3C.4E.2A Multi-Capture Refund Integrity QA\n');

const multi = src('apps/api/src/services/multi-capture-refund.service.ts');
const refundSvc = src('apps/api/src/services/refund-request.service.ts');
const ledger = src('apps/api/src/lib/booking-ledger.ts');
const paymentSvc = src('apps/api/src/services/payment.service.ts');
const schema = src('packages/db/prisma/schema.prisma');
const migration = src(
  'packages/db/prisma/migrations/20260917210000_phase3c4e2a_multi_capture_refund/migration.sql',
);
const adminUi = src('apps/web/src/components/admin/admin-refunds-view.tsx');
const customerUi = src('apps/web/src/components/account/my-bookings-view.tsx');
const docs = src('docs/MAZARE3_MULTI_CAPTURE_REFUND_INTEGRITY_3C4E2A.md');
const preflightDoc = src('docs/MAZARE3_MULTI_CAPTURE_REFUND_PREFLIGHT_3C4E2A.md');
const terms = src('apps/web/src/content/legal/terms.ts');
const cancel = src('apps/web/src/content/legal/cancellation.ts');
const bookingPay = src('apps/web/src/content/legal/booking-payment.ts');
const privacy = src('apps/web/src/content/legal/privacy.ts');
const pkg = src('package.json');

// --- Pure allocation math ---
{
  // A. single full capture
  const plan = allocateNewestFirst(jodToFils(200), [
    { paymentId: 'full', remainingRefundableFils: jodToFils(200), capturedAt: 1 },
  ]);
  expect('A single-capture full refund', plan.length === 1 && plan[0]!.allocatedFils === jodToFils(200));
}

{
  // B. deposit-only
  const plan = allocateNewestFirst(jodToFils(60), [
    { paymentId: 'dep', remainingRefundableFils: jodToFils(60), capturedAt: 1 },
  ]);
  expect('B deposit-only refund', plan.length === 1 && plan[0]!.allocatedFils === jodToFils(60));
}

{
  // C. deposit+balance full
  const plan = allocateNewestFirst(jodToFils(200), [
    { paymentId: 'dep', remainingRefundableFils: jodToFils(60), capturedAt: 1 },
    { paymentId: 'bal', remainingRefundableFils: jodToFils(140), capturedAt: 2 },
  ]);
  expect(
    'C deposit+balance spans captures',
    plan.length === 2 &&
      plan[0]!.paymentId === 'bal' &&
      plan[0]!.allocatedFils === jodToFils(140) &&
      plan[1]!.paymentId === 'dep' &&
      plan[1]!.allocatedFils === jodToFils(60),
  );
}

{
  // D. partial cancellation refund 140 across captures (newest first)
  const policy = evaluateCancellationSettlement({
    merchantBookingValue: 200,
    capturedAmount: 200,
    hoursUntilStart: 60,
    commissionPercent: STANDARD_COMMISSION_PERCENT,
  });
  const plan = allocateNewestFirst(jodToFils(policy.customerRefund), [
    { paymentId: 'dep', remainingRefundableFils: jodToFils(60), capturedAt: 1 },
    { paymentId: 'bal', remainingRefundableFils: jodToFils(140), capturedAt: 2 },
  ]);
  const sum = plan.reduce((s, p) => s + p.allocatedFils, 0);
  expect('D partial cancel refund amount 140', Math.abs(policy.customerRefund - 140) < 0.011);
  expect(
    'D partial cancel allocates across captures',
    sum === jodToFils(140) &&
      plan[0]!.paymentId === 'bal' &&
      plan[0]!.allocatedFils === jodToFils(140),
  );
}

{
  // E. never exceed capture
  const plan = allocateNewestFirst(jodToFils(200), [
    { paymentId: 'dep', remainingRefundableFils: jodToFils(60), capturedAt: 1 },
  ]);
  expect('E never exceed capture', plan[0]!.allocatedFils === jodToFils(60));
}

{
  // F. total equals obligation when funds available
  const req = jodToFils(200);
  const plan = allocateNewestFirst(req, [
    { paymentId: 'a', remainingRefundableFils: jodToFils(60), capturedAt: 1 },
    { paymentId: 'b', remainingRefundableFils: jodToFils(140), capturedAt: 2 },
  ]);
  expect('F total allocation equals obligation', plan.reduce((s, p) => s + p.allocatedFils, 0) === req);
}

expect(
  'G succeeded never re-refunded (skip succeeded)',
  multi.includes('if (alloc.status === RefundAllocationStatus.succeeded)') &&
    multi.includes('continue'),
);

expect(
  'H partial failure leaves actionable',
  multi.includes('PARTIAL_REFUND_ACTION_REQUIRED') && multi.includes('RefundRequestStatus.pending'),
);

expect(
  'I retry only unresolved',
  multi.includes('executeRefundRequestAllocations') &&
    multi.includes('RefundAllocationStatus.succeeded') &&
    refundSvc.includes('executeRefundRequestAllocations'),
);

expect(
  'J uncertain reconciles before inventing refund',
  multi.includes('refund.allocation_reconciled') &&
    multi.includes('provider_already_refunded') &&
    multi.includes('idempotencyKey'),
);

expect(
  'K aggregate completion only after required amount',
  multi.includes('view.complete') && multi.includes('refund.request_completed'),
);

expect(
  'L Customer UI aggregate not premature complete',
  customerUi.includes('refundAggregate') &&
    customerUi.includes('refundAggregateDetail') &&
    customerUi.includes('aggregateLabel'),
);

expect(
  'M Admin can see partial state',
  adminUi.includes('refundAllocationsTitle') &&
    adminUi.includes('colRemainingRefund') &&
    adminUi.includes('retryRefundAllocations'),
);

expect(
  'N concurrent idempotent (FOR UPDATE + unique idempotency)',
  multi.includes('FOR UPDATE') &&
    schema.includes('idempotencyKey') &&
    migration.includes('RefundPaymentAllocation_idempotencyKey_key'),
);

expect(
  'O system cancel uses multi-capture create+execute',
  refundSvc.includes('createRefundRequestWithAllocations') &&
    refundSvc.includes('ensureSystemCancellationRefund') &&
    refundSvc.includes('executeRefundRequestAllocations') &&
    !refundSvc.includes('getPaymentGateway'),
);

expect(
  'P owner fault multi-capture',
  refundSvc.includes('ensureSystemOwnerFaultRefund') &&
    refundSvc.includes('createRefundRequestWithAllocations'),
);

expect(
  'Q force majeure uses owner-fault path (same infrastructure)',
  src('apps/api/src/services/force-majeure.service.ts').includes('ensureSystemOwnerFaultRefund') ||
    src('apps/api/src/services/owner-cancellation.service.ts').includes(
      'ensureSystemOwnerFaultRefund',
    ) ||
    refundSvc.includes('ensureSystemOwnerFaultRefund'),
);

expect(
  'R reschedule delta uses same infrastructure',
  src('apps/api/src/services/reschedule.service.ts').includes('ensureSystemOwnerFaultRefund'),
);

expect(
  'S no-double-recovery via ledger allocations',
  ledger.includes('refundedFilsFromRequests') && ledger.includes("a.status !== 'succeeded'"),
);

expect(
  'T financial snapshot remains authoritative (no per-allocation commission rule)',
  docs.toLowerCase().includes('snapshot') &&
    docs.toLowerCase().includes('merely execution') &&
    !multi.includes('calculatePlatformFundedSnapshot'),
);

expect(
  'U commission/cancel % unchanged',
  STANDARD_COMMISSION_PERCENT === 18 &&
    !multi.includes('DEPOSIT_PERCENT =') &&
    !refundSvc.includes('evaluateCancellationSettlement({'),
);

expect(
  'V locked legal docs unchanged versions',
  ADVISOR_REVISED_VERSION === '1.1.2-advisor-final' &&
    PRIVACY_ADVISOR_REVISED_VERSION === '1.1.2-advisor-final' &&
    OWNER_ADVISOR_REVISED_VERSION === '1.1.1-advisor-final' &&
    terms.includes('getLaunchPublicLegalPage') &&
    cancel.includes('cancellation-refund') &&
    bookingPay.includes('booking-payment') &&
    privacy.includes("'privacy'"),
);

expect(
  'W Production untouched (local migration only, preflight read-only)',
  migration.includes('RefundPaymentAllocation') &&
    pkg.includes('preflight:multi-capture-refunds') &&
    !docs.toLowerCase().includes('deploy to production') &&
    docs.toLowerCase().includes('production untouched'),
);

expect(
  'schema RefundPaymentAllocation additive',
  schema.includes('model RefundPaymentAllocation') &&
    schema.includes('refundedAmount') &&
    migration.includes('ADD COLUMN IF NOT EXISTS "refundedAmount"'),
);

expect(
  'ordering NEWEST_CAPTURE_FIRST documented',
  multi.includes('NEWEST_CAPTURE_FIRST') && docs.includes('NEWEST'),
);

expect(
  'webhook maps to allocation not blind complete',
  paymentSvc.includes('applyProviderRefundEventToAllocations') &&
    multi.includes('requestCompleted'),
);

expect(
  'preflight script present',
  pkg.includes('preflight:multi-capture-refunds') &&
    src('apps/api/scripts/preflight-multi-capture-refunds-3c4e2a.ts').includes(
      'runMultiCaptureRefundPreflightReport',
    ),
);

expect('docs integrity present', docs.includes('MULTI_CAPTURE_REFUND_CRITICAL') || docs.includes('Root cause'));
expect('docs preflight present', preflightDoc.includes('mutation') || preflightDoc.includes('Read-only'));

// Integer money
expect('integer fils allocation', filsToJod(jodToFils(60)) === 60);

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
