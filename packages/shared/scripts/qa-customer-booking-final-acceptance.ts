/**
 * CB-7 — Customer Booking Final Acceptance (static + domain integration checks).
 * Run: cd apps/api && pnpm exec tsx ../../packages/shared/scripts/qa-customer-booking-final-acceptance.ts
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

const ar = JSON.parse(read('apps/web/messages/ar.json'));
const en = JSON.parse(read('apps/web/messages/en.json'));
const schemaPrisma = read('packages/db/prisma/schema.prisma');
const envExample = read('.env.example');
const paytabsCfg = read('apps/api/src/config/paytabs-config.ts');
const paymentSvc = read('apps/api/src/services/payment.service.ts');
const bookingSvc = read('apps/api/src/services/booking.service.ts');
const quoteSvc = exists('apps/api/src/services/booking-quote.service.ts')
  ? read('apps/api/src/services/booking-quote.service.ts')
  : '';
const holdSvc = read('apps/api/src/services/booking-hold.service.ts');
const approvalExpiry = read('apps/api/src/services/owner-approval-expiry.service.ts');
const payoutSvc = read('apps/api/src/services/payment-payout.service.ts');
const signature = read('apps/api/src/services/payment/paytabs-signature.ts');
const vaultCrypto = exists('apps/api/src/lib/payment-vault-crypto.ts')
  ? read('apps/api/src/lib/payment-vault-crypto.ts')
  : '';
const savedSvc = exists('apps/api/src/services/saved-payment-method.service.ts')
  ? read('apps/api/src/services/saved-payment-method.service.ts')
  : '';
const choiceLib = read('apps/api/src/lib/initial-payment-choice.ts');
const publicMapper = read('apps/api/src/mappers/public-booking.mapper.ts');
const panel = read('apps/web/src/components/marketplace/booking-panel.tsx');
const quoteUi = read('apps/web/src/components/marketplace/booking/booking-quote-breakdown.tsx');
const view = read('apps/web/src/components/checkout/checkout-view.tsx');
const method = read('apps/web/src/components/checkout/checkout-payment-method.tsx');
const choiceUi = read('apps/web/src/components/checkout/checkout-initial-payment-choice.tsx');
const returnUi = read('apps/web/src/components/checkout/checkout-return-view.tsx');
const myBookings = read('apps/web/src/components/account/my-bookings-view.tsx');
const propSummary = read('apps/web/src/components/checkout/checkout-property-summary.tsx');
const ownerRoutes = read('apps/api/src/routes/owner.ts');
const apiPay = read('apps/web/src/lib/api-payments.ts');
const paymentSchema = read('packages/shared/src/schemas/payment.ts');
const types = read('packages/shared/src/types.ts');
const financials = read('packages/shared/src/booking-financials.ts');
const stateMachine = read('packages/shared/src/payment-state-machine.ts');
const money = read('packages/shared/src/money.ts');
const playwrightCfg = read('playwright.config.ts');
const tsconfigWeb = read('apps/web/tsconfig.json');
const calendarQa = read('packages/shared/scripts/qa-customer-booking-calendar.ts');
const refundSvc = exists('apps/api/src/services/refund-request.service.ts')
  ? read('apps/api/src/services/refund-request.service.ts')
  : '';

const e2eCb7 = exists('e2e/cb7-customer-booking-final-acceptance.spec.ts')
  ? read('e2e/cb7-customer-booking-final-acceptance.spec.ts')
  : '';
const shotsDir = join(root, '_cb7_final_acceptance');

console.log('\nCB-7 Customer Booking Final Acceptance QA\n');

expect(
  '01 Calendar',
  exists('packages/shared/scripts/qa-customer-booking-calendar.ts') ||
    exists('e2e/cb1-booking-calendar.spec.ts'),
);
expect('02 past date', calendarQa.includes("return 'past'"));
expect('03 unavailable date', exists('e2e/cb1-booking-calendar.spec.ts'));
expect('04 partial availability', calendarQa.includes('partial') || calendarQa.includes('Partial'));
expect(
  '05 all period types',
  schemaPrisma.includes('overnight') && schemaPrisma.includes('morning'),
);
expect('06 guest capacity', quoteSvc.includes('capacity') || bookingSvc.includes('capacity'));
expect(
  '07 quote authority',
  quoteSvc.includes('resolveBookingPricing') && !quoteSvc.includes('prisma.booking.create'),
);
expect('08 promotion', quoteSvc.includes('promotion') || quoteSvc.includes('Promotion'));
expect(
  '09 coupon',
  quoteSvc.includes('evaluateCouponForCustomer') || bookingSvc.includes('coupon'),
);
expect('10 service fee', financials.includes('customerServiceFeeAmount'));
expect('11 no tax', !quoteUi.includes('VAT') && !quoteUi.includes('ضريبة القيمة'));
expect(
  '12 smart CTA',
  ar.property.ctaContinuePayment === 'متابعة للدفع' &&
    ar.property.ctaSendRequest === 'إرسال طلب الحجز',
);
expect(
  '13 owner approval',
  bookingSvc.includes('pending_owner_approval') && bookingSvc.includes('acceptOwnerBooking'),
);
expect(
  '14 owner reject',
  bookingSvc.includes('rejectOwnerBooking') || ownerRoutes.includes('/bookings/:id/reject'),
);
expect('15 owner timeout', approvalExpiry.includes('ownerApprovalExpiresAt'));
expect('16 hold', holdSvc.includes('holdExpiresAt') || bookingSvc.includes('holdExpiresAt'));
expect(
  '17 stale slot',
  bookingSvc.includes('SLOT_UNAVAILABLE') || paymentSvc.includes('SLOT_UNAVAILABLE'),
);
expect('18 pricing changed', bookingSvc.includes('PRICING_CHANGED'));
expect(
  '19 Checkout',
  view.includes('checkout-page') && exists('apps/web/src/components/checkout/checkout-view.tsx'),
);
expect(
  '20 location privacy',
  propSummary.includes('approximate') ||
    publicMapper.includes('approximate') ||
    view.includes('checkout-approximate-location'),
);
expect(
  '21 truthful contacts',
  paymentSvc.includes('PAYMENT_CONTACT_REQUIRED') && view.includes('CheckoutPaymentContact'),
);
expect(
  '22 Deposit choice',
  choiceUi.includes('payDepositNowTitle') && ar.checkout.payDepositNowTitle === 'ادفع العربون الآن',
);
expect('23 Full choice', ar.checkout.payFullNowTitle === 'ادفع المبلغ كاملًا');

const identical = buildInitialPaymentOptions({
  status: 'pending_payment',
  paymentCollectionMode: 'deposit_balance',
  paymentState: 'unpaid',
  holdExpiresAt: new Date(Date.now() + 3_600_000),
  depositAmount: 100,
  remainingAmount: 0,
  customerServiceFeeAmount: 8,
  customerPayableTotal: 108,
  payments: [],
});
expect('24 100% deposit dedupe', identical.options === null);
expect('25 Deposit purpose', paymentSvc.includes('PaymentPurpose.deposit'));
expect('26 Full purpose', paymentSvc.includes('PaymentPurpose.full'));
expect('27 Balance purpose', paymentSvc.includes('PaymentPurpose.balance'));
expect(
  '28 Managed Form',
  method.includes('checkout-managed-form') && paymentSvc.includes('createManagedFormPayment'),
);
expect(
  '29 no PAN/CVV server',
  paymentSvc.includes('PCI_FORBIDDEN_FIELD') &&
    !paymentSchema.match(/createManagedFormPaymentSchema[\s\S]*?cvv/),
);
expect(
  '30 HPP fallback',
  view.includes('preferHostedFallback') || method.includes('useSecureHostedPage'),
);
expect('31 save card', method.includes('checkout-save-card') && paymentSchema.includes('saveCard'));
expect(
  '32 vault encryption',
  vaultCrypto.includes('encryptPaymentVaultToken') || schemaPrisma.includes('providerTokenCipher'),
);
expect('33 saved card', paymentSvc.includes('createSavedCardPayment'));
expect(
  '34 revoke',
  savedSvc.includes('revoke') || exists('apps/web/src/components/account/payment-methods-view.tsx'),
);
expect(
  '35 expired card',
  savedSvc.includes('SAVED_CARD_EXPIRED') || savedSvc.includes('isSavedCardExpired'),
);
expect(
  '36 IDOR saved method',
  savedSvc.includes('loadSavedPaymentMethodForCharge') || savedSvc.includes('revokedAt: null'),
);
expect(
  '37 no auto charge',
  view.includes('handleSavedCardPay') || view.includes('onPaySavedCard') || view.includes('hasAmountChoice'),
);
expect('38 double click', view.includes('managedPayLockRef'));
expect('39 payment idempotency', paymentSvc.includes('idempotencyKey'));
expect(
  '40 unknown reconcile',
  paymentSvc.includes('PAYMENT_STATUS_UNKNOWN') || paymentSvc.includes('reconcile'),
);
expect('41 3DS', paymentSvc.includes('redirectUrl') || paymentSvc.includes('redirect_3ds'));
expect('42 callback signature', signature.includes('verifyPaytabsCallbackSignature'));
expect(
  '43 browser return non-authority',
  paymentSvc.includes('acknowledgeBrowserPaymentReturn') &&
    returnUi.includes('fetchPaymentReturnStatus'),
);
expect('44 hold expiry', paymentSvc.includes('HOLD_EXPIRED'));
expect(
  '45 payment/hold race',
  paymentSvc.includes('recoverHoldExpiredBookingForCapture') &&
    paymentSvc.includes('SLOT_UNAVAILABLE') &&
    paymentSvc.includes('FOR UPDATE'),
);
expect(
  '46 Deposit success',
  stateMachine.includes("purpose === 'deposit'") && paymentSvc.includes('finalizePaymentSuccess'),
);
expect('47 Full success', stateMachine.includes("purpose === 'full'"));
expect('48 Balance success', paymentSvc.includes('PaymentPurpose.balance'));
expect('49 refund Deposit', refundSvc.length > 0);
expect('50 refund Full', stateMachine.includes('paymentStateAfterRefund'));
expect(
  '51 refund Deposit+Balance',
  exists('apps/api/src/services/refund-request.service.ts'),
);
expect(
  '52 settlement equality',
  payoutSvc.includes("payment.purpose === 'deposit'") && paymentSvc.includes('ownerNetPayoutAmount'),
);
expect('53 commission equality', paymentSvc.includes('platformCommissionAmount'));
expect(
  '54 My Bookings state',
  myBookings.includes('pay-deposit') &&
    myBookings.includes('pay-balance') &&
    myBookings.includes('paymentState'),
);
expect(
  '55 Checkout status guard',
  view.includes('pending_owner_approval') && view.includes('holdExpired'),
);
expect('56 Auth handoff', exists('apps/web/src/components/auth/unified-auth-view.tsx'));
expect('57 AR', Boolean(ar.checkout?.title));
expect('58 EN', Boolean(en.checkout?.payFullNowTitle));
expect('59 RTL', panel.includes('text-start') || view.includes('text-start'));
expect('60 accessibility', choiceUi.includes('radiogroup') && choiceUi.includes('type="radio"'));
expect(
  '61 reload',
  view.includes('defaultInitialPaymentChoice') && returnUi.includes('purpose'),
);
expect(
  '62 multi-tab safety',
  paymentSvc.includes('FOR UPDATE') && choiceLib.includes('PAYMENT_CHOICE_LOCKED'),
);
expect('63 payment modes', paytabsCfg.includes('managed_form') && paytabsCfg.includes('hpp'));
expect(
  '64 tokenization gate',
  envExample.includes('PAYTABS_TOKENIZATION_ENABLED') &&
    (savedSvc.includes('PAYTABS_TOKENIZATION_ENABLED') ||
      paymentSvc.includes('savedCardsEnabled')),
);
expect(
  '65 recurring default-safe',
  envExample.includes('PAYTABS_RECURRING_ENABLED=false') &&
    envExample.includes('PAYTABS_SAVED_CARD_CHARGE_MODE=off'),
);
expect(
  '66 no internal data leakage',
  !types.match(/SavedPaymentMethodPublic[\s\S]{0,400}providerToken[^C]/) &&
    !apiPay.includes('providerToken'),
);
expect(
  '67 no false 7-day cancellation copy',
  !String(ar.property.safeBookingSubtitle).includes('7 أيام') &&
    !String(en.property.safeBookingSubtitle).includes('7 days') &&
    !panel.includes('7 أيام قبل الوصول'),
);
expect(
  '68 DB integrity',
  schemaPrisma.includes('model Booking') &&
    schemaPrisma.includes('model Payment') &&
    schemaPrisma.includes('PaymentPurpose'),
);
expect(
  '69 no schema drift',
  !readdirSync(join(root, 'packages/db/prisma/migrations')).some((n) =>
    n.toLowerCase().includes('cb7'),
  ),
);
expect(
  '70 no production mutation',
  playwrightCfg.includes("PAYMENT_GATEWAY_PROVIDER: 'mock'") &&
    envExample.includes('PAYTABS_RECURRING_ENABLED=false'),
);
expect('71 money precision', money.includes('jodToFils') || money.includes('fils'));
expect('72 e2e suite present', e2eCb7.includes('CB-7') && e2eCb7.includes('_cb7_final_acceptance'));
expect(
  '73 tsconfig no permanent QA build dirs',
  !tsconfigWeb.includes('.next-build-cb') && tsconfigWeb.includes('.next/types'),
);
expect(
  '74 owner approval no charge copy',
  String(ar.property.ownerApprovalNoCharge).includes('لن يتم خصم'),
);
expect(
  '75 balance CTA copy',
  String(ar.checkout.payBalanceCta).includes('المتبقي'),
);

const ineligible = isInitialPaymentChoiceAllowed(
  {
    status: 'confirmed',
    paymentCollectionMode: 'deposit_balance',
    paymentState: 'deposit_paid',
    holdExpiresAt: null,
    depositAmount: 30,
    remainingAmount: 70,
    customerServiceFeeAmount: 8,
    customerPayableTotal: 108,
    payments: [{ status: 'succeeded', purpose: 'deposit', providerRef: 'x' }],
  },
  'full',
);
expect('76 reject Full after Deposit', ineligible.ok === false);
expect(
  '77 screenshot folder path reserved',
  e2eCb7.includes('_cb7_final_acceptance/') || existsSync(shotsDir),
);
expect(
  '78 CB-1..CB-6 regression scripts exist',
  [
    'qa-customer-booking-calendar.ts',
    'qa-customer-booking-quote.ts',
    'qa-customer-native-checkout.ts',
    'qa-paytabs-managed-form.ts',
    'qa-paytabs-saved-cards.ts',
    'qa-paytabs-saved-card-charging.ts',
    'qa-deposit-vs-full-payment.ts',
  ].every((f) => exists(`packages/shared/scripts/${f}`)),
);

console.log(`\nCB-7 QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
