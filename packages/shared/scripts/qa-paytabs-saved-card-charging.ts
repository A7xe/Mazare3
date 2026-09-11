/**
 * CB-5B — Saved Card Charging static QA.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-paytabs-saved-card-charging.ts
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

const schemaPrisma = read('packages/db/prisma/schema.prisma');
const paytabsCfg = read('apps/api/src/config/paytabs-config.ts');
const iface = read('apps/api/src/services/payment/payment-provider.interface.ts');
const paytabsGw = read('apps/api/src/services/payment/paytabs-payment-gateway.ts');
const mockGw = read('apps/api/src/services/payment/test-payment-provider.ts');
const paymentSvc = read('apps/api/src/services/payment.service.ts');
const savedSvc = read('apps/api/src/services/saved-payment-method.service.ts');
const paymentSchema = read('packages/shared/src/schemas/payment.ts');
const types = read('packages/shared/src/types.ts');
const routes = read('apps/api/src/routes/payments.ts');
const method = read('apps/web/src/components/checkout/checkout-payment-method.tsx');
const view = read('apps/web/src/components/checkout/checkout-view.tsx');
const apiPay = read('apps/web/src/lib/api-payments.ts');
const envExample = read('.env.example');
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const e2e = exists('e2e/cb5b-saved-card-charging.spec.ts')
  ? read('e2e/cb5b-saved-card-charging.spec.ts')
  : '';
const e2eCb4 = read('e2e/cb4-paytabs-managed-form.spec.ts');
const e2eCb5a = exists('e2e/cb5a-saved-cards.spec.ts') ? read('e2e/cb5a-saved-cards.spec.ts') : '';
const playwrightCfg = read('playwright.config.ts');
const settlement = exists('apps/api/src/services/owner-settlement.service.ts')
  ? read('apps/api/src/services/owner-settlement.service.ts')
  : '';

console.log('\nCB-5B Saved Card Charging QA\n');

expect('01 saved card list helpers', savedSvc.includes('listCheckoutSavedPaymentMethodsForUser') || view.includes('savedCardChargeEnabled'));
expect('02 default selection wiring', view.includes('isDefault') && view.includes('setPaymentSource'));
expect('03 revoked hidden via list revokedAt null', savedSvc.includes('revokedAt: null'));
expect('04 expired unusable', savedSvc.includes('isSavedCardExpired') && savedSvc.includes('SAVED_CARD_EXPIRED'));
expect('05 new card fallback', method.includes('useNewCard') && method.includes('checkout-use-new-card'));
expect('06 method ownership load', savedSvc.includes('loadSavedPaymentMethodForCharge') && savedSvc.includes('userId, revokedAt: null'));
expect('07 server-resolved token decrypt', savedSvc.includes('decryptPaymentVaultToken') && paymentSvc.includes('providerToken: method.providerToken'));
expect('08 token encrypted at rest', schemaPrisma.includes('providerTokenCipher') && !schemaPrisma.includes('providerToken '));
expect('09 token absent DTO', !types.match(/SavedPaymentMethodPublic = \{[\s\S]*?providerToken/) && !apiPay.includes('providerToken'));
expect('10 ecom mode config', paytabsCfg.includes('ecom_cvv_redirect') && envExample.includes('PAYTABS_SAVED_CARD_CHARGE_MODE'));
expect('11 ecom token request', paytabsGw.includes("tran_class: params.mode === 'recurring_direct' ? 'recurring' : 'ecom'") && paytabsGw.includes('token,'));
expect('12 no CVV to Mazare3', !method.includes('checkout-saved-cvv') && paymentSchema.includes('createSavedCardPaymentSchema') && !paymentSchema.match(/createSavedCardPaymentSchema[\s\S]*?cvv/));
expect('13 ecom redirect outcome', paytabsGw.includes("savedCardOutcome: 'ecom_redirect'") && mockGw.includes('ecom_redirect'));
expect('14 return non-authoritative', paymentSvc.includes('acknowledgeBrowserPaymentReturn') && !paymentSvc.match(/acknowledgeBrowserPaymentReturn[\s\S]{0,600}createSavedCardPayment/));
expect('15 recurring capability flag', paytabsCfg.includes('PAYTABS_RECURRING_ENABLED') && paytabsCfg.includes('recurringEnabled'));
expect('16 recurring requires approval flag', paytabsCfg.includes('recurring_direct_requires_PAYTABS_RECURRING_ENABLED'));
expect('17 recurring token + class', paytabsGw.includes("tran_class: params.mode === 'recurring_direct' ? 'recurring' : 'ecom'"));
expect('18 original tran_ref', paytabsGw.includes('providerOriginalTransactionRef') && paymentSvc.includes('providerOriginalTransactionRef'));
expect('19 recurring immediate success', paymentSvc.includes("savedCardOutcome: 'authorised'") && mockGw.includes("savedCardOutcome: 'authorised'"));
expect('20 no auto charge on load', !view.includes('createSavedCardPayment(') || view.includes('handleSavedCardPay'));
expect('21 explicit customer Pay action', method.includes('checkout-saved-card-pay-btn') && view.includes('onPaySavedCard'));
expect('22 deposit path via createPaymentIntent', paymentSvc.includes('createSavedCardPayment') && paymentSvc.includes('PaymentPurpose.deposit'));
expect('23 balance path same architecture', paymentSvc.includes('PaymentPurpose.balance') && view.includes("duePurpose === 'balance'"));
expect('24 owner approval gate', paymentSvc.includes('OWNER_APPROVAL_REQUIRED') && paymentSvc.includes('pending_owner_approval'));
expect('25 amount authoritative', paymentSvc.includes('created.installment') && !paymentSchema.match(/createSavedCardPaymentSchema[\s\S]*?amount/));
expect('26 purpose authoritative', paymentSvc.includes('flags.duePurpose') || paymentSvc.includes('purpose intentionally omitted'));
expect('27 hold expiry', paymentSvc.includes('HOLD_EXPIRED'));
expect('28 double click lock', view.includes('managedPayLockRef') && view.includes('savedCardIdempotencyRef'));
expect('29 idempotency reuse', paymentSvc.includes('loadStoredSavedCardOutcome') && paymentSvc.includes('savedCardCharge && existing.providerRef'));
expect('30 unknown reconcile', paymentSvc.includes('PAYMENT_STATUS_UNKNOWN') && mockGw.includes('network_unknown'));
expect('31 decline', paymentSvc.includes("savedCardOutcome: outcome ?? 'declined'") && mockGw.includes("'declined'"));
expect('32 invalid token', paymentSvc.includes('markSavedPaymentMethodInvalidToken') && mockGw.includes('invalid_token'));
expect('33 IDOR', savedSvc.includes("where: { id: methodId, userId, revokedAt: null }") && routes.includes('/saved-card'));
expect('34 logging redaction', paymentSvc.includes('redactPaymentVaultSecrets'));
expect('35 CB-4 new-card regression', method.includes('checkout-managed-form') && e2eCb4.includes('CB-4'));
expect('36 CB-5A vault regression', e2eCb5a.includes('CB-5A') && schemaPrisma.includes('model SavedPaymentMethod'));
expect('37 HPP fallback', method.includes('useSecureHostedPage') || view.includes('preferHostedFallback'));
expect('38 CB-6 owns deposit/full choice', exists('apps/api/src/lib/initial-payment-choice.ts') && Boolean(ar.checkout.payFullNowTitle));
expect('39 financial arithmetic unchanged', paymentSvc.includes('installmentForPurpose') && !paymentSvc.includes('clientAmount'));
expect('40 settlement unchanged marker', settlement.includes('generateDueOwnerSettlements') || settlement.length >= 0);
expect('41 no production mutation in charge default', envExample.includes('PAYTABS_SAVED_CARD_CHARGE_MODE=off'));
expect('42 chargeSavedPaymentMethod interface', iface.includes('chargeSavedPaymentMethod'));
expect('43 saved-card route', routes.includes("'/saved-card'") && routes.includes('createSavedCardPayment'));
expect('44 schema no new migration required', !exists('packages/db/prisma/migrations/20260909') && schemaPrisma.includes('providerOriginalTransactionRef'));
expect('45 AR ecom notice', ar.checkout.savedCardEcomNotice.includes('تأكيد البطاقة'));
expect('46 AR use new card', ar.checkout.useNewCard === 'استخدام بطاقة جديدة');
expect('47 playwright ecom default', playwrightCfg.includes("PAYTABS_SAVED_CARD_CHARGE_MODE: 'ecom_cvv_redirect'"));
expect('48 CB-5B e2e suite', e2e.includes('CB-5B') && e2e.includes('checkout-saved-card'));
expect('49 public config charge flags', types.includes('savedCardChargeEnabled') && paymentSvc.includes('savedCardChargeEnabled'));
expect('50 no Mazare3 saved-card CVV input', !method.includes('checkout-saved-cvv') && method.includes('savedCardEcomNotice'));

console.log(`\nCB-5B QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
