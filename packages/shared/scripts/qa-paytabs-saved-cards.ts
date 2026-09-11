/**
 * CB-5A — Saved Card Vault + Save-Card Opt-In static QA.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-paytabs-saved-cards.ts
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
const migration = exists('packages/db/prisma/migrations/20260908160000_cb5a_saved_payment_method/migration.sql')
  ? read('packages/db/prisma/migrations/20260908160000_cb5a_saved_payment_method/migration.sql')
  : '';
const vaultCrypto = read('apps/api/src/lib/payment-vault-crypto.ts');
const savedSvc = read('apps/api/src/services/saved-payment-method.service.ts');
const cardToken = read('apps/api/src/services/payment/paytabs-card-token.ts');
const paytabsGw = read('apps/api/src/services/payment/paytabs-payment-gateway.ts');
const mockGw = read('apps/api/src/services/payment/test-payment-provider.ts');
const paymentSvc = read('apps/api/src/services/payment.service.ts');
const paymentSchema = read('packages/shared/src/schemas/payment.ts');
const types = read('packages/shared/src/types.ts');
const meRoutes = read('apps/api/src/routes/me.ts');
const method = read('apps/web/src/components/checkout/checkout-payment-method.tsx');
const view = read('apps/web/src/components/checkout/checkout-view.tsx');
const accountView = read('apps/web/src/components/account/payment-methods-view.tsx');
const apiPay = read('apps/web/src/lib/api-payments.ts');
const apiMethods = read('apps/web/src/lib/api-payment-methods.ts');
const envExample = read('.env.example');
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const en = JSON.parse(read('apps/web/messages/en.json'));
const e2eCb4 = read('e2e/cb4-paytabs-managed-form.spec.ts');
const e2eCb5 = exists('e2e/cb5a-saved-cards.spec.ts') ? read('e2e/cb5a-saved-cards.spec.ts') : '';
const playwrightCfg = read('playwright.config.ts');
const partnerCrypto = read('apps/api/src/lib/partner-crypto.ts');

console.log('\nCB-5A Saved Cards QA\n');

expect('01 additive SavedPaymentMethod model', schemaPrisma.includes('model SavedPaymentMethod'));
expect('02 cipher + fingerprint fields', schemaPrisma.includes('providerTokenCipher') && schemaPrisma.includes('providerTokenFingerprint'));
expect('03 no PAN/CVV columns', !/pan|cvv|cardNumber/i.test(schemaPrisma.match(/model SavedPaymentMethod[\s\S]*?\n}/)?.[0] ?? 'x'));
expect('04 unique ownership constraint', schemaPrisma.includes('@@unique([userId, provider, providerTokenFingerprint])'));
expect('05 soft revoke field', schemaPrisma.includes('revokedAt'));
expect('06 additive migration CREATE TABLE only', migration.includes('CREATE TABLE "SavedPaymentMethod"') && !/DROP TABLE|ALTER TABLE "Payment"/i.test(migration));
expect('07 dedicated vault crypto key env', vaultCrypto.includes('PAYMENT_VAULT_ENCRYPTION_KEY') && vaultCrypto.includes('pv1'));
expect('08 not reusing partner key', vaultCrypto.includes('Never reuse PARTNER_DATA_ENCRYPTION_KEY') && vaultCrypto.includes('PAYMENT_VAULT_ENCRYPTION_KEY') && !vaultCrypto.includes('process.env.PARTNER_DATA_ENCRYPTION_KEY'));
expect('09 AES-256-GCM encrypt/decrypt', vaultCrypto.includes('aes-256-gcm') && vaultCrypto.includes('encryptPaymentVaultToken'));
expect('10 capability gate default false', savedSvc.includes('PAYTABS_TOKENIZATION_ENABLED') && envExample.includes('PAYTABS_TOKENIZATION_ENABLED=false'));
expect('11 tokenise=2 only on opt-in', paytabsGw.includes('tokenise = 2') && paymentSvc.includes('saveCardRequested ? { tokenise: true }'));
expect('12 extract persistent token guard', cardToken.includes('extractPaytabsPersistentCardCapture') && cardToken.includes('mf_'));
expect('13 save only after success helper', paymentSvc.includes('maybeSavePaytabsCardAfterSuccess') && paymentSvc.includes("event.type === 'payment_succeeded'"));
expect('14 browser return never saves', paymentSvc.includes('acknowledgeBrowserPaymentReturn') && !paymentSvc.match(/acknowledgeBrowserPaymentReturn[\s\S]{0,800}maybeSavePaytabsCard/));
expect('15 saveCard schema default false', paymentSchema.includes('saveCard: z.boolean().optional().default(false)'));
expect('16 DTO excludes providerToken', types.includes('SavedPaymentMethodPublic') && !types.match(/SavedPaymentMethodPublic = \{[\s\S]*?providerToken/));
expect('17 public config savedCardsEnabled', types.includes('savedCardsEnabled') && paymentSvc.includes('savedCardsEnabled'));
expect('18 list/default/revoke routes', meRoutes.includes('/payment-methods') && meRoutes.includes('revokeSavedPaymentMethod') && meRoutes.includes('setDefaultSavedPaymentMethod'));
expect('19 ownership checks', savedSvc.includes('userId, revokedAt: null') && savedSvc.includes("where: { id: methodId, userId"));
expect('20 PayTabs delete adapter', paytabsGw.includes('/payment/token/delete') && paytabsGw.includes('deleteCardToken'));
expect('21 mock delete outcomes', mockGw.includes('deleteCardToken') && mockGw.includes('MOCK_TOKEN_DELETE_OUTCOME'));
expect('22 mock tokenise success payload', mockGw.includes('tokenise') && mockGw.includes('persistentCard') && mockGw.includes('Visa **** 4242'));
expect('23 checkout checkbox gated', method.includes('savedCardsEnabled') && method.includes('checkout-save-card-checkbox'));
expect('24 checkbox default off in view', view.includes('useState(false)') && view.includes('setSaveCard(false)'));
expect('25 AR save label', ar.checkout.saveCardLabel === 'احفظ هذه البطاقة لدفعات أسرع لاحقًا');
expect('26 EN save label', en.checkout.saveCardLabel === 'Save this card for faster payments');
expect('27 non-actionable preview', method.includes('checkout-saved-cards-preview') && method.includes('savedCardsPreviewHint'));
expect('28 account طرق الدفع', ar.paymentMethods.title === 'طرق الدفع' && exists('apps/web/src/app/[locale]/account/payment-methods/page.tsx'));
expect('29 account remove action', accountView.includes('payment-method-remove') && apiMethods.includes('DELETE'));
expect('30 client never sends providerToken', !apiMethods.includes('providerTokenCipher') && !apiPay.includes('providerToken') && apiMethods.includes('never includes providerToken'));
expect('31 no Mazare3 saved-card CVV; recurring capability-gated', !method.includes('checkout-saved-cvv') && paymentSvc.includes('resolveSavedCardChargeMode') && envExample.includes('PAYTABS_RECURRING_ENABLED=false'));
expect('32 no CVV-only saved pay', !view.includes('savedCardCvv') && !paymentSvc.includes('cvv_only'));
expect('33 env vault placeholder', envExample.includes('PAYMENT_VAULT_ENCRYPTION_KEY') && envExample.includes('PAYTABS_TOKENIZATION_ENABLED'));
expect('34 CB-4 e2e retained', e2eCb4.includes('CB-4'));
expect('35 CB-5A e2e suite', e2eCb5.includes('CB-5A') && e2eCb5.includes('checkout-save-card'));
expect('36 playwright tokenization flag', playwrightCfg.includes("PAYTABS_TOKENIZATION_ENABLED: 'true'"));
expect('37 default card helpers', savedSvc.includes('setDefaultSavedPaymentMethod') && savedSvc.includes('isDefault'));
expect('38 list excludes revoked', savedSvc.includes('revokedAt: null'));
expect('39 upsert by fingerprint not last4', savedSvc.includes('providerTokenFingerprint') && !savedSvc.includes('dedupeByLast4'));
expect('40 redact helper', vaultCrypto.includes('redactPaymentVaultSecrets'));
expect('41 intent stores saveCardRequested', paymentSvc.includes('saveCardRequested'));
expect('42 paymentRequestedSaveCard reader', savedSvc.includes('paymentRequestedSaveCard'));
expect('43 HPP path unchanged marker', view.includes('createPaymentIntent') && view.includes('preferHostedFallback'));
expect('44 Managed Form path retained', view.includes('createManagedFormPayment') && method.includes('data-paylib'));

console.log(`\nCB-5A QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
