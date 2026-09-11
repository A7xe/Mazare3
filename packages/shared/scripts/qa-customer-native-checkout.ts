/**
 * CB-3 — Native Mazare3 checkout static QA.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-customer-native-checkout.ts
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
const page = readFileSync(
  join(root, 'apps/web/src/app/[locale]/checkout/[bookingId]/page.tsx'),
  'utf8',
);
const retPage = readFileSync(
  join(root, 'apps/web/src/app/[locale]/checkout/[bookingId]/return/page.tsx'),
  'utf8',
);
const view = readFileSync(join(root, 'apps/web/src/components/checkout/checkout-view.tsx'), 'utf8');
const retView = readFileSync(
  join(root, 'apps/web/src/components/checkout/checkout-return-view.tsx'),
  'utf8',
);
const propertySum = readFileSync(
  join(root, 'apps/web/src/components/checkout/checkout-property-summary.tsx'),
  'utf8',
);
const details = readFileSync(
  join(root, 'apps/web/src/components/checkout/checkout-booking-details.tsx'),
  'utf8',
);
const paySum = readFileSync(
  join(root, 'apps/web/src/components/checkout/checkout-payment-summary.tsx'),
  'utf8',
);
const method = readFileSync(
  join(root, 'apps/web/src/components/checkout/checkout-payment-method.tsx'),
  'utf8',
);
const contact = readFileSync(
  join(root, 'apps/web/src/components/checkout/checkout-payment-contact.tsx'),
  'utf8',
);
const hold = readFileSync(
  join(root, 'apps/web/src/components/checkout/checkout-hold-banner.tsx'),
  'utf8',
);
const bookingSvc = readFileSync(join(root, 'apps/api/src/services/booking.service.ts'), 'utf8');
const paymentSvc = readFileSync(join(root, 'apps/api/src/services/payment.service.ts'), 'utf8');
const paytabsGw = existsSync(
  join(root, 'apps/api/src/services/payment/paytabs-payment-gateway.ts'),
)
  ? readFileSync(join(root, 'apps/api/src/services/payment/paytabs-payment-gateway.ts'), 'utf8')
  : '';
const types = readFileSync(join(root, 'packages/shared/src/types.ts'), 'utf8');
const ar = JSON.parse(readFileSync(join(root, 'apps/web/messages/ar.json'), 'utf8'));
const en = JSON.parse(readFileSync(join(root, 'apps/web/messages/en.json'), 'utf8'));
const e2e = existsSync(join(root, 'e2e/cb3-native-checkout.spec.ts'))
  ? readFileSync(join(root, 'e2e/cb3-native-checkout.spec.ts'), 'utf8')
  : '';
const schemaPrisma = join(root, 'packages/db/prisma/schema.prisma');
const envExample = readFileSync(join(root, '.env.example'), 'utf8');
const cb1 = existsSync(join(root, 'packages/shared/scripts/qa-customer-booking-calendar.ts'));
const cb2 = existsSync(join(root, 'packages/shared/scripts/qa-customer-booking-quote.ts'));

console.log('\n— CB-3 native checkout —\n');

expect('1 canonical checkout route retained', page.includes('CheckoutView') && page.includes('bookingId'));
expect('2 Mazare3-owned structure components', propertySum.includes('checkout-property-summary') && paySum.includes('checkout-payment-summary'));
expect('3 property summary', propertySum.includes('propertyTitle'));
expect('4 approximate location only', propertySum.includes('approximateLocation') && !propertySum.includes('exactAddress'));
expect('5 no private address leakage in checkout UI', !view.includes('exactAddress') && !details.includes('exactAddress'));
expect('6 booking date', details.includes('checkout-booking-date'));
expect('7 period', details.includes('checkout-booking-period'));
expect('8 period times', details.includes('checkout-booking-times'));
expect('9 guests', details.includes('checkout-booking-guests'));
expect('10 booking snapshot price', paySum.includes('pricing.customerPayableAmount') || paySum.includes('customerPayableAmount'));
expect('11 discount row', paySum.includes('checkout-discount'));
expect('12 customer fee', paySum.includes('serviceFee'));
expect('13 no fake tax', !paySum.includes('ضريبة') && !paySum.includes('VAT') && !view.includes('taxAmount'));
expect('14 no commission in UI', !paySum.includes('platformCommission') && !paySum.includes('عمولة'));
expect('15 total', paySum.includes('bookingTotal'));
expect('16 deposit due', paySum.includes('checkout-due-now') && paySum.includes('payNowDeposit'));
expect('17 remaining balance', paySum.includes('remainingBalance'));
expect('18 balance duePurpose', view.includes("duePurpose === 'balance'") || paySum.includes('isBalance'));
expect('19 payment CTA amount', view.includes('payAmountCta') && view.includes('dueNowAmount'));
expect('20 Card method', method.includes('methodBankCard') && ar.checkout.methodBankCard === 'بطاقة بنكية');
expect('21 no PAN name submission', !method.includes('name="number"') && !method.includes('name="cardNumber"') && method.includes('data-paylib="number"'));
expect('22 no CVV name submission', !method.includes('name="cvv"') && method.includes('data-paylib="cvv"'));
expect('23 Managed Form expiry paylib attrs', method.includes('data-paylib="expmonth"') && method.includes('data-paylib="expyear"'));
expect('23b HPP mode still present', method.includes('hosted_redirect') && method.includes('methodBankCardHint'));
expect('24 no saved cards', !view.includes('saved card') && !view.includes('بطاقة محفوظة') && !view.includes('Save this card') && !view.includes('احفظ بطاقتي'));
expect('25 no full/deposit selector', !view.includes('ادفع كامل') && !view.includes('fullPaymentChoice'));
expect('26 truthful contacts JIT', view.includes('contactEmail') && view.includes('PAYMENT_CONTACT_REQUIRED'));
expect('27 missing email UI', contact.includes('checkout-contact-email'));
expect('28 missing phone UI', contact.includes('checkout-contact-phone'));
expect('29 email collision', view.includes('PAYMENT_CONTACT_EMAIL_UNAVAILABLE'));
expect('30 no fake fallback contacts', !view.includes('customer@mazare3') && !view.includes('0790000000'));
expect('31 payment intent flow preserved', view.includes('createPaymentIntent'));
expect('32 Hosted PayTabs still', view.includes('redirectUrl') && (paytabsGw.includes('PayTabs') || paytabsGw.includes('paytabs') || paymentSvc.includes('paytabs')));
expect('33 return non-authoritative', retView.includes('Never treats URL') || retView.includes('does not finalize'));
expect('34 success backend-authoritative', retView.includes('fetchPaymentReturnStatus') && retView.includes('succeeded'));
expect('35 pending status', retView.includes('pending'));
expect('36 failed/cancel status', retView.includes('failed'));
expect('37 hold expiry UI', view.includes('holdExpiredTitle') && hold.includes('holdExpiresAt'));
expect('38 no pay after expiry', view.includes('holdExpiredClient') && view.includes('awaitingPay'));
expect('39 pending_owner_approval no pay', view.includes("pending_owner_approval") && view.includes('awaitingOwnerApprovalTitle'));
expect('40 owner accept enables payment', bookingSvc.includes('getCheckoutBooking') && view.includes('duePurpose'));
expect('41 retry same booking', retView.includes('returnBackCheckout'));
expect('42 IDOR via userId scoped checkout', bookingSvc.includes('userId') && bookingSvc.includes('getCheckoutBooking'));
expect('43 reload server-derived', view.includes('fetchCheckoutBooking'));
expect('44 propertyCoverUrl additive DTO', types.includes('propertyCoverUrl') && bookingSvc.includes('propertyCoverUrl'));
expect('45 cancellation link', view.includes('cancellation-refund') || view.includes('cancellationLink'));
expect('46 terms/privacy', view.includes('/terms') && view.includes('/privacy'));
expect('47 AR title', ar.checkout.title === 'إتمام الدفع');
expect(
  '48 EN title',
  en.checkout.title.includes('Complete payment') || en.checkout.title.includes('Complete'),
);
expect('49 accessibility h1', view.includes('<h1') && propertySum.includes('alt={title}'));
expect('50 CB-1 regression suite present', cb1);
expect('51 CB-2 regression suite present', cb2);
expect('52 no schema migration for saved cards', existsSync(schemaPrisma) && !readFileSync(schemaPrisma, 'utf8').includes('SavedCard'));
expect('53 no env checkout invention', !envExample.includes('CHECKOUT_NATIVE'));
expect('54 PayTabs adapter path unchanged (create-intent)', paymentSvc.includes('createPaymentIntent') && view.includes('createPaymentIntent'));
expect('55 no production mutation helpers', !view.includes('ensure-available') && !e2e.includes('PRODUCTION'));
expect('return route retained', retPage.includes('CheckoutReturnView'));
expect('e2e suite present', e2e.includes('CB-3') && e2e.includes('checkout-page'));
expect('simulate testids preserved', view.includes('checkout-simulate-success') && view.includes('checkout-simulate-failure'));

console.log(`\nCB-3 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
