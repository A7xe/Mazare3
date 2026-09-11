/**
 * CB-6 — Deposit vs Full initial payment choice QA.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-deposit-vs-full-payment.ts
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildInitialPaymentOptions,
  isInitialPaymentChoiceAllowed,
} from '../../../apps/api/src/lib/initial-payment-choice.ts';

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

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const exists = (rel: string) => existsSync(join(root, rel));

const schemaPrisma = read('packages/db/prisma/schema.prisma');
const paymentSvc = read('apps/api/src/services/payment.service.ts');
const bookingSvc = read('apps/api/src/services/booking.service.ts');
const choiceLib = read('apps/api/src/lib/initial-payment-choice.ts');
const paymentSchema = read('packages/shared/src/schemas/payment.ts');
const types = read('packages/shared/src/types.ts');
const payoutSvc = read('apps/api/src/services/payment-payout.service.ts');
const stateMachine = read('packages/shared/src/payment-state-machine.ts');
const view = read('apps/web/src/components/checkout/checkout-view.tsx');
const summary = read('apps/web/src/components/checkout/checkout-payment-summary.tsx');
const choiceUi = read('apps/web/src/components/checkout/checkout-initial-payment-choice.tsx');
const method = read('apps/web/src/components/checkout/checkout-payment-method.tsx');
const apiPay = read('apps/web/src/lib/api-payments.ts');
const quoteUi = read('apps/web/src/components/marketplace/booking/booking-quote-breakdown.tsx');
const returnUi = read('apps/web/src/components/checkout/checkout-return-view.tsx');
const myBookings = read('apps/web/src/components/account/my-bookings-view.tsx');
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const envExample = read('.env.example');
const e2e = exists('e2e/cb6-deposit-vs-full.spec.ts')
  ? read('e2e/cb6-deposit-vs-full.spec.ts')
  : '';
const e2eCb4 = exists('e2e/cb4-paytabs-managed-form.spec.ts')
  ? read('e2e/cb4-paytabs-managed-form.spec.ts')
  : '';
const e2eCb5a = exists('e2e/cb5a-saved-cards.spec.ts') ? read('e2e/cb5a-saved-cards.spec.ts') : '';
const e2eCb5b = exists('e2e/cb5b-saved-card-charging.spec.ts')
  ? read('e2e/cb5b-saved-card-charging.spec.ts')
  : '';

const migrationsDir = join(root, 'packages/db/prisma/migrations');
const migrationFolders = existsSync(migrationsDir)
  ? readdirSync(migrationsDir).filter((n) => n.startsWith('20260909') || n.includes('cb6') || n.includes('initial_payment'))
  : [];

console.log('\nCB-6 Deposit vs Full Payment QA\n');

const baseBooking = {
  status: 'pending_payment',
  paymentCollectionMode: 'deposit_balance',
  paymentState: 'unpaid',
  holdExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
  depositAmount: 30,
  remainingAmount: 70,
  customerServiceFeeAmount: 8,
  customerPayableTotal: 108,
  payments: [] as Array<{ status: string; purpose: string; providerRef: string | null }>,
};

const opts = buildInitialPaymentOptions(baseBooking);
expect('01 initial Deposit option', Boolean(opts.options?.some((o) => o.choice === 'deposit')));
expect('02 initial Full option', Boolean(opts.options?.some((o) => o.choice === 'full')));
expect('03 Deposit default', opts.defaultChoice === 'deposit');
expect(
  '04 server-derived options',
  bookingSvc.includes('buildInitialPaymentOptions') && types.includes('initialPaymentOptions'),
);
expect(
  '05 no client amount authority',
  paymentSchema.includes('initialPaymentChoice') &&
    !paymentSchema.match(/createManagedFormPaymentSchema[\s\S]*?amount:/) &&
    paymentSvc.includes('PCI_FORBIDDEN_FIELD'),
);
expect(
  '06 no client purpose authority',
  paymentSvc.includes('initialPaymentChoice is authoritative over client purpose') ||
    paymentSvc.includes('initialPaymentChoice'),
);
const depositOpt = opts.options?.find((o) => o.choice === 'deposit');
const fullOpt = opts.options?.find((o) => o.choice === 'full');
expect('07 Deposit amount', depositOpt?.dueNowAmount === 38);
expect('08 Full amount', fullOpt?.dueNowAmount === 108);
expect('09 remaining after Deposit', depositOpt?.remainingAfterPayment === 70);
expect('10 zero remaining after Full', fullOpt?.remainingAfterPayment === 0);
expect(
  '11 service fee once',
  paymentSvc.includes('purpose === PaymentPurpose.full') &&
    paymentSvc.includes('customerPayableTotal') &&
    depositOpt!.dueNowAmount === 30 + 8 &&
    fullOpt!.dueNowAmount === 108,
);
expect(
  '12 promotion snapshot',
  paymentSvc.includes('bookingTotalAmount: decimalToNumber(working.totalAmount)') ||
    paymentSvc.includes('bookingTotalAmount: decimalToNumber(booking.totalAmount)'),
);
expect(
  '13 coupon snapshot',
  paymentSvc.includes('redeemCouponInTx') && paymentSvc.includes('PaymentPurpose.full'),
);
expect('14 no tax', !summary.includes('VAT') && !summary.includes('ضريبة القيمة'));
expect(
  '15 commission hidden',
  !choiceUi.includes('platformCommission') && !summary.includes('platformCommissionAmount'),
);

const identical = buildInitialPaymentOptions({
  ...baseBooking,
  depositAmount: 100,
  remainingAmount: 0,
  customerServiceFeeAmount: 8,
  customerPayableTotal: 108,
});
expect('16 100% deposit dedupe', identical.options === null);

const approval = buildInitialPaymentOptions({
  ...baseBooking,
  status: 'pending_owner_approval',
});
expect('17 owner approval gate', approval.options === null);

const expired = buildInitialPaymentOptions({
  ...baseBooking,
  holdExpiresAt: new Date(Date.now() - 1000),
});
expect('18 hold expiry', expired.options === null);

expect(
  '19 Deposit Managed Form',
  view.includes('initialPaymentChoice') && view.includes('createManagedFormPayment'),
);
expect(
  '20 Full Managed Form',
  apiPay.includes('initialPaymentChoice') && paymentSvc.includes("choice === 'full'"),
);
expect(
  '21 Deposit saved card',
  view.includes('createSavedCardPayment') && paymentSvc.includes('initialPaymentChoice: input.initialPaymentChoice'),
);
expect('22 Full saved card', paymentSvc.includes('createSavedCardPayment') && choiceLib.includes("'full'"));
expect(
  '23 HPP Deposit',
  view.includes('handlePaytabsCheckout') && view.includes('initialPaymentChoice'),
);
expect('24 HPP Full', paymentSvc.includes('PaymentCollectionMode.full') && paymentSvc.includes("choice === 'full'"));
expect(
  '25 3DS state persistence',
  choiceLib.includes('findInFlightInitialPayment') && choiceLib.includes('providerRef'),
);
expect('26 PaymentPurpose.deposit', paymentSvc.includes('PaymentPurpose.deposit'));
expect('27 PaymentPurpose.full', paymentSvc.includes('PaymentPurpose.full'));
expect('28 PaymentPurpose.balance', paymentSvc.includes('PaymentPurpose.balance'));
expect(
  '29 full collection mode',
  paymentSvc.includes('paymentCollectionMode: PaymentCollectionMode.full') &&
    schemaPrisma.includes('enum PaymentCollectionMode'),
);
expect(
  '30 Deposit success',
  paymentSvc.includes("purpose === PaymentPurpose.deposit") &&
    stateMachine.includes("purpose === 'deposit'"),
);
expect(
  '31 Full success',
  stateMachine.includes("purpose === 'full'") && paymentSvc.includes('completesBooking'),
);
expect(
  '32 no balance after Full',
  summary.includes('checkout-remaining-zero') || summary.includes('remainingAfterPayment'),
);
expect(
  '33 balance after Deposit',
  view.includes("duePurpose === 'balance'") && myBookings.includes('pay-balance'),
);
expect(
  '34 switching before Pay',
  view.includes('setInitialPaymentChoice') && view.includes('setPayment(null)'),
);
expect(
  '35 no payment on selection',
  view.includes('Selection must not create Payment') ||
    (view.includes('setPayment(null)') && view.includes('hasAmountChoice')),
);
expect(
  '36 definitive decline switch safety',
  paymentSvc.includes('paymentCollectionMode: PaymentCollectionMode.deposit_balance') &&
    choiceLib.includes('locksChoice: false'),
);
expect(
  '37 unknown locks selector',
  choiceLib.includes('PAYMENT_CHOICE_LOCKED') &&
    view.includes('PAYMENT_CHOICE_LOCKED') &&
    choiceUi.includes('checkout-amount-choice-locked'),
);
expect(
  '38 idempotency',
  paymentSvc.includes('idempotencyKey') && view.includes('managedIdempotencyRef'),
);
expect('39 double click', view.includes('managedPayLockRef'));
expect(
  '40 reload',
  view.includes('defaultInitialPaymentChoice') && view.includes('lockedInitialPaymentChoice'),
);
expect(
  '41 direct API tampering',
  isInitialPaymentChoiceAllowed(
    { ...baseBooking, payments: [{ status: 'succeeded', purpose: 'deposit', providerRef: 'x' }] },
    'full',
  ).ok === false && paymentSvc.includes('collectionMode'),
);
expect(
  '42 refund Deposit',
  paymentSvc.includes('finalizePaymentSuccess') &&
    exists('apps/api/src/services/refund-request.service.ts'),
);
expect(
  '43 refund Full',
  stateMachine.includes('paymentStateAfterRefund') && paymentSvc.includes("purpose === PaymentPurpose.full"),
);
expect(
  '44 settlement equality',
  payoutSvc.includes("payment.purpose === 'deposit'") &&
    paymentSvc.includes('ownerNetPayoutAmount') &&
    stateMachine.includes("purpose === 'full'"),
);
expect(
  '45 owner commission unchanged',
  paymentSvc.includes('platformCommissionAmount: decimalToNumber(working.platformCommissionAmount)') ||
    paymentSvc.includes('platformCommissionAmount: decimalToNumber(booking.platformCommissionAmount)'),
);
expect(
  '46 platform commission unchanged',
  !paymentSvc.includes('commissionRate =') && paymentSvc.includes('installmentForPurpose'),
);
expect(
  '47 no auto charge',
  view.includes('hasAmountChoice') && view.includes('!hasAmountChoice'),
);
expect('48 CB-4 new-card regression', method.includes('checkout-managed-form') && e2eCb4.includes('CB-4'));
expect('49 CB-5A save-card regression', e2eCb5a.includes('CB-5A') && schemaPrisma.includes('SavedPaymentMethod'));
expect('50 CB-5B saved-card regression', e2eCb5b.includes('CB-5B') && method.includes('checkout-saved-card'));
expect(
  '51 financial arithmetic integrity',
  paymentSvc.includes('installmentForPurpose') &&
    paymentSvc.includes('PAYMENT_EXCEEDS_BALANCE') &&
    !paymentSvc.includes('clientAmount'),
);
expect(
  '52 no destructive migration',
  migrationFolders.length === 0 && schemaPrisma.includes('full') && exists('apps/api/src/lib/initial-payment-choice.ts'),
);
expect(
  '53 no production mutation',
  !envExample.includes('CB6') && !envExample.includes('INITIAL_PAYMENT_CHOICE'),
);

expect(
  '54 AR deposit/full copy',
  ar.checkout.payDepositNowTitle === 'ادفع العربون الآن' &&
    ar.checkout.payFullNowTitle === 'ادفع المبلغ كاملًا',
);
expect('55 property hint only', quoteUi.includes('quoteFullChoiceHint') && !quoteUi.includes('radiogroup'));
expect(
  '56 return success purpose',
  (returnUi.includes('returnSuccessFullBody') || returnUi.includes('returnFullyPaid')) &&
    returnUi.includes('purpose'),
);
expect('57 e2e suite present', e2e.includes('CB-6') && e2e.includes('checkout-initial-payment-choice'));
expect(
  '58 radio semantics',
  choiceUi.includes('role="radiogroup"') && choiceUi.includes('type="radio"'),
);

const lockedInFlight = buildInitialPaymentOptions({
  ...baseBooking,
  payments: [{ status: 'pending', purpose: 'full', providerRef: 'tran_1' }],
});
expect(
  '59 in-flight locks choice',
  lockedInFlight.choiceLocked === true && lockedInFlight.lockedChoice === 'full',
);

const invalidFull = isInitialPaymentChoiceAllowed(
  { ...baseBooking, status: 'confirmed', payments: [{ status: 'succeeded', purpose: 'deposit', providerRef: 'x' }] },
  'full',
);
expect('60 reject full when ineligible', invalidFull.ok === false);

console.log(`\nCB-6 QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
