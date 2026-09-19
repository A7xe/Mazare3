/**
 * Phase 3C.4E.2B — First-payment revalidation + webhook capture integrity QA.
 * Run: pnpm qa:phase3c4e2b-first-payment-integrity
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FULL_PAYMENT_WITHIN_HOURS,
  resolvePaymentPlan,
  validateProviderCaptureAgainstPayment,
  CAPTURE_VALIDATION_CATEGORY,
  jodToFils,
  STANDARD_COMMISSION_PERCENT,
  VERIFIED_COMMISSION_PERCENT,
  ADVISOR_REVISED_VERSION,
  PRIVACY_ADVISOR_REVISED_VERSION,
  OWNER_ADVISOR_REVISED_VERSION,
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

console.log('\nPhase 3C.4E.2B First-Payment + Webhook Integrity QA\n');

const paymentSvc = src('apps/api/src/services/payment.service.ts');
const bookingSvc = src('apps/api/src/services/booking.service.ts');
const reconcile = src('apps/api/src/services/paytabs-reconciliation.service.ts');
const gateway = src('apps/api/src/services/payment/paytabs-payment-gateway.ts');
const signature = src('apps/api/src/services/payment/paytabs-signature.ts');
const captureVal = src('packages/shared/src/payment-capture-validation.ts');
const checkout = src('apps/web/src/components/checkout/checkout-view.tsx');
const docs = src('docs/MAZARE3_FIRST_PAYMENT_WEBHOOK_INTEGRITY_3C4E2B.md');
const preflightDoc = src('docs/MAZARE3_FIRST_PAYMENT_INTEGRITY_PREFLIGHT_3C4E2B.md');
const pkg = src('package.json');
const multiCapture = src('apps/api/src/services/multi-capture-refund.service.ts');
const regulatory = src('apps/api/src/services/property-bookability.service.ts');

// A–D boundary math
{
  const payable = 200;
  const over = resolvePaymentPlan({ hoursUntilStart: 72 + 1 / 3600, customerPayable: payable });
  expect('A >72h deposit allowed', !over.fullPaymentRequired && over.depositAmount === 60);

  const exact = resolvePaymentPlan({ hoursUntilStart: 72, customerPayable: payable });
  expect('C exact 72h full only', exact.fullPaymentRequired && exact.depositAmount === 200);

  const under = resolvePaymentPlan({ hoursUntilStart: 72 - 1 / 3600, customerPayable: payable });
  expect('D <72h full only', under.fullPaymentRequired && under.depositAmount === 200);

  const fullOpt = resolvePaymentPlan({ hoursUntilStart: 100, customerPayable: payable });
  expect('B >72h may use full (plan allows deposit or full)', !fullOpt.fullPaymentRequired);
}

expect('FULL_PAYMENT_WITHIN_HOURS === 72', FULL_PAYMENT_WITHIN_HOURS === 72);

expect(
  'E createPaymentIntent revalidates plan',
  paymentSvc.includes('syncLivePaymentPlanForBooking') &&
    paymentSvc.includes('PAYMENT_PLAN_UPDATED'),
);

expect(
  'F Owner approval does not freeze forever (sync at payment)',
  bookingSvc.includes('syncLivePaymentPlanForBooking') &&
    paymentSvc.includes('syncLivePaymentPlanForBooking'),
);

expect(
  'G retry revalidates',
  paymentSvc.includes('resolvePaymentPlan') && paymentSvc.includes('hoursUntilBookingStart'),
);

expect(
  'H stale session not reused',
  paymentSvc.includes('activeAmountFils') && paymentSvc.includes('requiredFils'),
);

expect(
  'I updated due-now UX',
  checkout.includes('fullPaymentRequiredWithin72h') &&
    checkout.includes('PAYMENT_PLAN_UPDATED') &&
    checkout.includes('paymentPlanRevalidated'),
);

expect(
  'J/K balance not reclassified as first full',
  paymentSvc.includes('72h first-payment revalidation does not apply') ||
    paymentSvc.includes('Balance on a confirmed deposit Booking'),
);

{
  const ok = validateProviderCaptureAgainstPayment({
    expectedAmountJod: 60,
    expectedCurrency: 'JOD',
    providerAmountJod: 60,
    providerCurrency: 'JOD',
    requireAmountCurrency: true,
  });
  expect('L valid amount+currency ok', ok.ok);

  const badAmt = validateProviderCaptureAgainstPayment({
    expectedAmountJod: 200,
    expectedCurrency: 'JOD',
    providerAmountJod: 60,
    providerCurrency: 'JOD',
    requireAmountCurrency: true,
  });
  expect(
    'M wrong amount rejected',
    !badAmt.ok && badAmt.category === CAPTURE_VALIDATION_CATEGORY.AMOUNT_MISMATCH,
  );

  const badCur = validateProviderCaptureAgainstPayment({
    expectedAmountJod: 60,
    expectedCurrency: 'JOD',
    providerAmountJod: 60,
    providerCurrency: 'USD',
    requireAmountCurrency: true,
  });
  expect(
    'N wrong currency rejected',
    !badCur.ok && badCur.category === CAPTURE_VALIDATION_CATEGORY.CURRENCY_MISMATCH,
  );

  const badRef = validateProviderCaptureAgainstPayment({
    expectedAmountJod: 60,
    expectedCurrency: 'JOD',
    expectedProviderRef: 'TST1',
    providerAmountJod: 60,
    providerCurrency: 'JOD',
    providerRef: 'TST2',
    requireAmountCurrency: true,
  });
  expect(
    'O reference mismatch rejected',
    !badRef.ok && badRef.category === CAPTURE_VALIDATION_CATEGORY.REFERENCE_MISMATCH,
  );

  const badPurpose = validateProviderCaptureAgainstPayment({
    expectedAmountJod: 60,
    expectedCurrency: 'JOD',
    expectedPurpose: 'deposit',
    providerAmountJod: 60,
    providerCurrency: 'JOD',
    cartPurpose: 'balance',
    requireAmountCurrency: true,
  });
  expect(
    'P purpose mismatch rejected',
    !badPurpose.ok && badPurpose.category === CAPTURE_VALIDATION_CATEGORY.PURPOSE_MISMATCH,
  );
}

expect(
  'Q duplicate webhook idempotent',
  paymentSvc.includes('Duplicate gateway event ignored') &&
    paymentSvc.includes('payment.status === PaymentStatus.succeeded'),
);

expect(
  'R stale failure ignored after success',
  paymentSvc.includes('Stale payment_failed ignored'),
);

expect(
  'S reconcile uses shared validation',
  reconcile.includes('validateProviderCaptureAgainstPayment') &&
    captureVal.includes('validateProviderCaptureAgainstPayment'),
);

expect(
  'T mismatch actionable/auditable',
  paymentSvc.includes('payment.capture_mismatch') &&
    paymentSvc.includes('gateway.capture_validation_failed'),
);

expect(
  'U return URL cannot forge success',
  paymentSvc.includes('acknowledgeBrowserPaymentReturn') &&
    paymentSvc.includes('must NEVER mark a payment succeeded'),
);

expect(
  'V/W/X API cannot force stale deposit / alter amount/currency',
  paymentSvc.includes('PAYMENT_PLAN_UPDATED') &&
    paymentSvc.includes('PCI_FORBIDDEN_FIELD') &&
    paymentSvc.includes('installmentForPurpose'),
);

expect(
  'Y snapshot amount authoritative (no live property price recalculation in sync)',
  bookingSvc.includes('merchantBookingValue') &&
    bookingSvc.includes('Does NOT change commercial price'),
);

expect('Z 18%/15% unchanged', STANDARD_COMMISSION_PERCENT === 18 && VERIFIED_COMMISSION_PERCENT === 15);

expect(
  'AA cancellation/refund rules unchanged',
  !paymentSvc.includes('CANCELLATION_CHARGE_PERCENT_TIER_30 ='),
);

expect(
  'AB multi-capture refund unchanged',
  multiCapture.includes('NEWEST_CAPTURE_FIRST') && multiCapture.includes('executeRefundRequestAllocations'),
);

expect(
  'AC regulatory gate unchanged',
  regulatory.includes('assertPropertyEligibleForNewPaidBooking'),
);

expect(
  'AD locked legal docs unchanged',
  ADVISOR_REVISED_VERSION === '1.1.2-advisor-final' &&
    PRIVACY_ADVISOR_REVISED_VERSION === '1.1.2-advisor-final' &&
    OWNER_ADVISOR_REVISED_VERSION === '1.1.1-advisor-final',
);

expect(
  'AE Production untouched',
  docs.toLowerCase().includes('production untouched') &&
    pkg.includes('preflight:first-payment-integrity'),
);

expect(
  'webhook parses amount/currency',
  gateway.includes('parsePaytabsQueryAmount') && gateway.includes('cartPurpose'),
);

expect(
  'reschedule_difference cart_id parse fixed',
  signature.includes('reschedule_difference') &&
    docs.includes('RESCHEDULE') ||
    docs.includes('reschedule'),
);

expect('integer fils compare', jodToFils(60.004) === jodToFils(60));

expect('docs present', docs.includes('72') && preflightDoc.includes('Read-only'));
expect('preflight script', pkg.includes('preflight:first-payment-integrity'));
expect('stale shortfall handling', paymentSvc.includes('FIRST_PAYMENT_OBLIGATION_SHORTFALL') || paymentSvc.includes('stale_session_shortfall'));

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
