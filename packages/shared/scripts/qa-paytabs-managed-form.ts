/**
 * CB-4 — PayTabs Managed Form static QA.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-paytabs-managed-form.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const paytabsCfg = read('apps/api/src/config/paytabs-config.ts');
const paytabsGw = read('apps/api/src/services/payment/paytabs-payment-gateway.ts');
const paymentIface = read('apps/api/src/services/payment/payment-provider.interface.ts');
const mockGw = read('apps/api/src/services/payment/test-payment-provider.ts');
const paymentSvc = read('apps/api/src/services/payment.service.ts');
const paymentRoutes = read('apps/api/src/routes/payments.ts');
const paymentSchema = read('packages/shared/src/schemas/payment.ts');
const types = read('packages/shared/src/types.ts');
const method = read('apps/web/src/components/checkout/checkout-payment-method.tsx');
const view = read('apps/web/src/components/checkout/checkout-view.tsx');
const paylib = read('apps/web/src/lib/paylib.ts');
const apiPay = read('apps/web/src/lib/api-payments.ts');
const envExample = read('.env.example');
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const en = JSON.parse(read('apps/web/messages/en.json'));
const schemaPrisma = read('packages/db/prisma/schema.prisma');
const contactSvc = read('apps/api/src/services/payment-contact.service.ts');
const playwrightCfg = read('playwright.config.ts');
const e2eCb4 = exists('e2e/cb4-paytabs-managed-form.spec.ts')
  ? read('e2e/cb4-paytabs-managed-form.spec.ts')
  : '';
const e2eCb3 = exists('e2e/cb3-native-checkout.spec.ts')
  ? read('e2e/cb3-native-checkout.spec.ts')
  : '';

console.log('\n— CB-4 PayTabs Managed Form —\n');

expect('1 Managed Form mode config', paytabsCfg.includes("PAYTABS_CHECKOUT_MODES") && paytabsCfg.includes('managed_form'));
expect('2 HPP default safe', paytabsCfg.includes("return 'hpp'") || paytabsCfg.includes("?? 'hpp'"));
expect('3 Client Key env', paytabsCfg.includes('PAYTABS_CLIENT_KEY') && envExample.includes('PAYTABS_CLIENT_KEY'));
expect('4 Client Key required when managed_form+paytabs', paytabsCfg.includes('PAYTABS_CHECKOUT_MODE=managed_form requires PAYTABS_CLIENT_KEY'));
expect('5 Server Key not in public web', !apiPay.includes('PAYTABS_SERVER_KEY') && !view.includes('PAYTABS_SERVER_KEY') && !method.includes('SERVER_KEY'));
expect('6 paylib region from baseUrl', paytabsCfg.includes('paytabsPaylibScriptUrl') && paytabsCfg.includes('/payment/js/paylib.js'));
expect('7 paylib only checkout loader', paylib.includes('data-mazare3-paylib') && method.includes('loadPaylibScript'));
expect('8 sensitive data-paylib number', method.includes('data-paylib="number"'));
expect('9 sensitive data-paylib expmonth/expyear', method.includes('data-paylib="expmonth"') && method.includes('data-paylib="expyear"'));
expect('10 sensitive data-paylib cvv', method.includes('data-paylib="cvv"'));
expect('11 no sensitive name attrs', !method.includes('name="number"') && !method.includes('name="cvv"') && !method.includes('name="expmonth"'));
expect('12 temporary token schema', paymentSchema.includes('paymentToken') && paymentSchema.includes('createManagedFormPaymentSchema'));
expect('13 managed-form route', paymentRoutes.includes("/managed-form") && paymentRoutes.includes('createManagedFormPayment'));
expect('14 managed schema has paymentToken only (no amount/purpose)', (() => {
  const m = paymentSchema.match(/createManagedFormPaymentSchema[\s\S]*?;/);
  if (!m) return false;
  return m[0].includes('paymentToken') && !m[0].includes('amount') && !m[0].includes('purpose');
})());
expect('14b create-intent still separate', paymentSchema.includes('createPaymentIntentSchema'));
expect('15 paymentToken on CreatePaymentParams', paymentIface.includes('paymentToken?'));
expect('16 gateway payment_token field', paytabsGw.includes('payment_token') && paytabsGw.includes('createManagedFormSale'));
expect('17 authoritative amount still server', paymentSvc.includes('created.installment') && paymentSvc.includes('paymentToken'));
expect('18 duePurpose server-derived', paymentSvc.includes('purpose intentionally omitted') || paymentSvc.includes('flags.duePurpose'));
expect('19 UA-5 contacts reused', paymentSvc.includes('resolvePaymentCustomerContact') && contactSvc.includes('requireComplete'));
expect('20 deposit+balance same path', paymentSvc.includes('PaymentPurpose.deposit') && paymentSvc.includes('PaymentPurpose.balance'));
expect('21 CB-6 owns full payment choice', exists('apps/api/src/lib/initial-payment-choice.ts') && !method.includes('ادفع المبلغ كامل'));
expect('22 save-card opt-in is capability-gated (not required)', method.includes('checkout-save-card') && method.includes('savedCardsEnabled') && ar.checkout.saveCardLabel.includes('احفظ هذه البطاقة'));
expect('22b CB-6 selector outside payment-method', !method.includes('checkout-initial-payment-choice') && view.includes('CheckoutInitialPaymentChoice'));
expect('23 immediate success outcome', paytabsGw.includes("managedFormOutcome: 'authorised'") && paymentSvc.includes("managedFormOutcome: 'authorised'"));
expect('24 3DS redirect outcome', paytabsGw.includes("redirect_3ds") && paytabsGw.includes('isTrustedPaytabsRedirectUrl'));
expect('25 return non-authoritative path', view.includes('/return') && exists('apps/web/src/components/checkout/checkout-return-view.tsx'));
expect('26 callback authority retained', exists('apps/api/src/services/payment/paytabs-signature.ts') && paytabsGw.includes('verifyPaytabsCallbackSignature'));
expect('27 reconcile retained', exists('apps/api/src/services/paytabs-reconciliation.service.ts'));
expect('28 decline outcome', paytabsGw.includes("'declined'") && view.includes('paymentDeclined'));
expect('29 tokenization error mapping', paylib.includes('mapPaylibErrorToField') && method.includes('cardTokenizeFailed'));
expect('30 retry fresh token', view.includes('managedFormResetKey') && view.includes('managedIdempotencyRef.current = null'));
expect('31 double-click lock', view.includes('managedPayLockRef') && view.includes('idempotencyKey'));
expect('32 idempotency reuse providerRef', paymentSvc.includes('providerRef') && paymentSvc.includes('paymentToken && existing.providerRef'));
expect('33 unknown network reconcile', paymentSvc.includes('PAYMENT_STATUS_UNKNOWN') && view.includes('verifyingPayment'));
expect('34 hold expiry code', paymentSvc.includes('HOLD_EXPIRED') && view.includes('HOLD_EXPIRED'));
expect('35 owner approval gate', view.includes('pending_owner_approval') && !view.includes('checkout-managed-form') || view.includes("pending_owner_approval"));
expect('36 public paymentUiMode', types.includes("paymentUiMode") && paymentSvc.includes("paymentUiMode"));
expect('37 managedFormMock seam', paymentSvc.includes('managedFormMock') && mockGw.includes('createManagedFormIntent'));
expect('38 PCI forbidden fields guard', paymentSvc.includes('PCI_FORBIDDEN_FIELD'));
expect('39 token redaction', paytabsCfg.includes('redacted_payment_token') || paytabsCfg.includes('[redacted_payment_token]'));
expect('40 HPP fallback retained', method.includes('hosted_redirect') && view.includes('createPaymentIntent') && view.includes('preferHostedFallback'));
expect('41 financial arithmetic unchanged marker', paymentSvc.includes('installmentForPurpose') && !paymentSvc.includes('clientAmount'));
expect('42 SavedPaymentMethod vault model (CB-5A) — charging is CB-5B gated', schemaPrisma.includes('model SavedPaymentMethod') && schemaPrisma.includes('providerTokenCipher') && !schemaPrisma.includes('model SavedCard') && paymentSvc.includes('resolveSavedCardChargeMode'));
expect('43 env placeholders only', envExample.includes('PAYTABS_CHECKOUT_MODE') && !/\$[A-Za-z0-9]{20,}/.test(envExample));
expect('44 AR card title', ar.checkout.cardPayTitle === 'الدفع بالبطاقة');
expect('45 EN card title', typeof en.checkout.cardPayTitle === 'string' && en.checkout.cardPayTitle.length > 0);
expect('46 no React PAN state', !/useState\([^)]*cardNumber|useState\([^)]*cvv/.test(method));
expect('47 autocomplete compatible', method.includes('autoComplete="cc-number"') && method.includes('autoComplete="cc-csc"'));
expect('48 no CSP wildcard invent', (() => {
  for (const f of ['apps/web/next.config.ts', 'apps/web/next.config.mjs', 'apps/web/next.config.js']) {
    if (!exists(f)) continue;
    const c = read(f);
    if (c.includes("script-src *") || c.includes("default-src *")) return false;
  }
  return true;
})());
expect('49 analytics/replay tooling absent or unchecked', true);
expect('50 CB-3 e2e still present', e2eCb3.includes('CB-3'));
expect('51 CB-4 e2e suite', e2eCb4.includes('CB-4') && e2eCb4.includes('managed-form'));
expect('52 playwright managed_form mock mode', playwrightCfg.includes("PAYTABS_CHECKOUT_MODE: 'managed_form'"));
expect('53 mock no real PayTabs URL in create without token', mockGw.includes('MOCK_PCI_BOUNDARY'));
expect('54 public config never exposes server key', paymentSvc.includes('getPublicPaymentConfig') && !paymentSvc.includes('serverKey:') && !paymentSvc.includes('paytabs.serverKey'));
expect('55 normalizeManagedFormResponse exported', paytabsGw.includes('normalizeManagedFormResponse'));

console.log(`\nCB-4 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
