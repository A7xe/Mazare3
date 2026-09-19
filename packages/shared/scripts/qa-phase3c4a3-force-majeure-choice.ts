/**
 * Phase 3C.4A.3 — Force majeure Customer choice enforcement (static + SSOT).
 * Run: pnpm qa:phase3c4a3-force-majeure-choice
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOOKING_CANCELLATION_REASON,
  computeReschedulePricing,
  getLaunchLegalDocument,
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
function near(a: number, b: number, name: string) {
  expect(name, Math.abs(a - b) < 0.001, `${a} vs ${b}`);
}

console.log('\nPhase 3C.4A.3 Force Majeure Customer Choice QA\n');

const fm = src('apps/api/src/services/force-majeure.service.ts');
const reschedule = src('apps/api/src/services/reschedule.service.ts');
const me = src('apps/api/src/routes/me.ts');
const ops = src('packages/shared/src/schemas/operations.ts');
const schema = src('packages/db/prisma/schema.prisma');
const migration = src(
  'packages/db/prisma/migrations/20260913120000_phase3c4a3_force_majeure_customer_choice/migration.sql',
);
const notify = src('apps/api/src/services/notification.service.ts');
const adminUi = src('apps/web/src/components/admin/admin-marketplace-fairness-view.tsx');
const customerUi = src('apps/web/src/components/account/my-bookings-view.tsx');
const en = src('apps/web/messages/en.json');
const ar = src('apps/web/messages/ar.json');

// A — full refund path allowed without Customer reschedule choice
expect('A confirm_awaiting_customer outcome', ops.includes('confirm_awaiting_customer'));
expect('A admin full_refund path', /outcome === 'full_refund'/.test(fm));
expect(
  'A no election gate on full_refund',
  !/outcome === 'full_refund'[\s\S]{0,200}FORCE_MAJEURE_CUSTOMER_CHOICE_REQUIRED/.test(fm),
);

// B — admin reschedule rejected without consent
expect(
  'B server rejects approve_reschedule without election',
  fm.includes('FORCE_MAJEURE_CUSTOMER_CHOICE_REQUIRED'),
);
expect(
  'B domain-safe message',
  fm.includes('Customer has not chosen rescheduling. Confirmed force majeure must resolve to full refund.'),
);

// C — Owner request is not Customer consent
expect(
  'C election actor is customerResolutionChosenByUserId',
  fm.includes('customerResolutionChosenByUserId: params.customerUserId'),
);
expect(
  'C openedByUserId is not used as election',
  !/customerResolutionChosenByUserId:\s*(params\.adminUserId|incident\.openedByUserId)/.test(fm),
);

// D — Admin selection is not Customer consent
expect(
  'D adminClassify does not write customerResolutionChoice',
  !/adminClassifyForceMajeure[\s\S]*customerResolutionChoice:\s*ForceMajeureCustomerChoice/.test(fm),
);
expect(
  'D only customerElect writes election',
  fm.includes('export async function customerElectForceMajeureResolution'),
);

// E / F — durable auditable elections
expect('E/F FULL_REFUND enum', schema.includes('FULL_REFUND'));
expect('E/F EQUIVALENT_RESCHEDULE enum', schema.includes('EQUIVALENT_RESCHEDULE'));
expect('E/F migration additive', migration.includes('ForceMajeureCustomerChoice'));
expect(
  'E/F audit customer_resolution_selected',
  fm.includes("action: 'force_majeure.customer_resolution_selected'"),
);

// G — reschedule finalises only after valid election
expect('G isValidRescheduleElection helper', fm.includes('isValidRescheduleElection'));
expect('G EQUIVALENT_RESCHEDULE required', fm.includes('ForceMajeureCustomerChoice.EQUIVALENT_RESCHEDULE'));

// H — election from another booking cannot be reused
expect(
  'H incident bookingId mismatch rejected',
  fm.includes('fresh.bookingId !== booking.id') ||
    fm.includes("bookingId !== booking.id"),
);
expect(
  'H customer elect scoped to booking',
  /customerElectForceMajeureResolution[\s\S]*bookingId: booking\.id/.test(fm),
);

// I — full refund = 100% eligible captured
expect('I refundableCapturedFils used', fm.includes('refundableCapturedFils'));
expect('I ensureSystemOwnerFaultRefund', fm.includes('ensureSystemOwnerFaultRefund'));

// J — ordinary cancellation penalty = 0
expect('J cancellationPenaltyAmount: 0 on payments', fm.includes('cancellationPenaltyAmount: 0'));
expect('J FORCE_MAJEURE cancel reason', fm.includes('BOOKING_CANCELLATION_REASON.FORCE_MAJEURE'));
expect('J SSOT reason constant', BOOKING_CANCELLATION_REASON.FORCE_MAJEURE === 'FORCE_MAJEURE');

// K — Owner penalty = 0 (reliability category without penaltyAmount)
expect(
  'K force_majeure reliability without penaltyAmount default',
  /OwnerReliabilityCategory\.force_majeure[\s\S]{0,80}reason:/.test(fm),
);
expect('K no createOwnerPenaltyAdjustment in FM service', !fm.includes('createOwnerPenaltyAdjustment'));

// L — platform commission 0 on refunded value
expect('L platformCommissionAmount: 0 on booking', fm.includes('platformCommissionAmount: 0'));
expect('L payout blocked', fm.includes('PayoutStatus.blocked'));

// M — refund-due vs completed preserved via existing refund infra
expect('M uses ensureSystemOwnerFaultRefund', fm.includes('ensureSystemOwnerFaultRefund'));
expect(
  'M refund processing notify mentions refund-due',
  notify.includes('refund-due') || notify.includes('مُستحق'),
);

// N — equivalent reschedule preserves contracted price
{
  const p = computeReschedulePricing({
    fromMerchantValue: 100,
    toListMerchantValue: 140,
    initiatedBy: 'customer',
    forceMajeure: true,
  });
  expect('N FM equivalent mode', p.pricingMode === 'force_majeure_equivalent');
  near(p.customerPayableDelta, 0, 'N no extra charge');
  near(p.customerContractedValue, 100, 'N contracted preserved');
}

// O — voluntary upgrade requires acceptance + payment flow
{
  const p = computeReschedulePricing({
    fromMerchantValue: 100,
    toListMerchantValue: 140,
    initiatedBy: 'customer',
    forceMajeure: true,
    voluntaryUpgrade: true,
  });
  expect('O upgrade mode', p.pricingMode === 'force_majeure_upgrade');
  near(p.customerPayableDelta, 40, 'O customer pays delta');
}
expect(
  'O customer FM reschedule uses voluntaryUpgrade',
  reschedule.includes('createCustomerForceMajeureReschedule') &&
    /voluntaryUpgrade: params\.voluntaryUpgrade === true/.test(reschedule),
);
expect(
  'O payment required path retained',
  /createCustomerForceMajeureReschedule[\s\S]*accepted_pending_payment/.test(reschedule),
);

// P — FM reschedule does not consume normal allowance
expect(
  'P exemptFromRescheduleLimit true on customer FM',
  /createCustomerForceMajeureReschedule[\s\S]*exemptFromRescheduleLimit:\s*true/.test(reschedule),
);

// Q — notifications deduplicated
expect('Q choice_required dedupe', /notifyForceMajeureChoiceRequired[\s\S]*dedupe:\s*true/.test(notify));
expect('Q refund_processing dedupe', /notifyForceMajeureRefundProcessing[\s\S]*dedupe:\s*true/.test(notify));
expect(
  'Q reschedule_proceeding dedupe',
  /notifyForceMajeureRescheduleProceeding[\s\S]*dedupe:\s*true/.test(notify),
);

// R — audit actor for Customer choice is Customer
expect(
  'R customer_resolution_selected actorUserId is customer',
  /createAuditLog\(\{\s*actorUserId: params\.customerUserId,\s*action: 'force_majeure\.customer_resolution_selected'/.test(
    fm,
  ),
);
expect('R actorKind customer metadata', fm.includes("actorKind: 'customer'"));

// S — admin UI blocks reschedule without Customer choice
expect('S admin disables approve without election', adminUi.includes('!fmRescheduleAllowed'));
expect('S admin blocked copy', adminUi.includes('fmRescheduleBlocked'));
expect('S admin shows customer choice', adminUi.includes('fmCustomerChoiceLabel'));

// Customer UI
expect('customer choose API route', me.includes("'/bookings/:id/force-majeure/choose'"));
expect('customer UI FM panel', customerUi.includes('force-majeure-choice-'));
expect('EN FM confirmed title', en.includes('This case was confirmed as force majeure'));
expect('AR FM confirmed title', ar.includes('تم اعتماد الحالة كقوة قاهرة'));
expect('EN full refund option', en.includes('Full refund of eligible amounts'));
expect('AR full refund option', ar.includes('استرداد كامل للمبالغ المؤهلة'));

// T — current 1.1.1 legal wording remains accurate (no new version for this phase)
{
  const cancel = getLaunchLegalDocument('cancellation_refund_policy');
  const flat = cancel.markdownEn;
  expect(
    'T FM full refund entitlement wording',
    /full refund of eligible captured Booking payments/i.test(flat),
  );
  expect(
    'T equivalent reschedule not imposed without agreement',
    /not imposed instead of that refund without the Customer.s agreement/i.test(flat),
  );
  expect(
    'T historical 1.1.1 preserved; corpus on advisor-final',
    src('packages/shared/src/legal-content/build-legal-markdown.ts').includes(
      "ADVISOR_REVISED_VERSION_111 = '1.1.1-advisor-revised'",
    ) &&
      src('packages/shared/src/legal-content/build-legal-markdown.ts').includes(
        "ADVISOR_REVISED_VERSION = '1.1.2-advisor-final'",
      ),
  );
}

console.log(`\nPhase 3C.4A.3 QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
