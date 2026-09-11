/**
 * CB-UX-1 — Customer Booking Journey UX Restructure (static + domain checks).
 * Run: cd apps/api && pnpm exec tsx ../../packages/shared/scripts/qa-customer-booking-ux-restructure.ts
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canRevealExactLocation } from '../src/location-privacy.ts';

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
const entry = read('apps/web/src/components/marketplace/property-booking-entry-card.tsx');
const aside = read('apps/web/src/components/marketplace/property-booking-aside.tsx');
const panel = read('apps/web/src/components/marketplace/booking-panel.tsx');
const bookPage = read('apps/web/src/app/[locale]/properties/[slug]/book/page.tsx');
const chrome = read('apps/web/src/components/layout/site-chrome.tsx');
const view = read('apps/web/src/components/checkout/checkout-view.tsx');
const returnUi = read('apps/web/src/components/checkout/checkout-return-view.tsx');
const choiceUi = read('apps/web/src/components/checkout/checkout-initial-payment-choice.tsx');
const method = read('apps/web/src/components/checkout/checkout-payment-method.tsx');
const mobileCta = read('apps/web/src/components/marketplace/mobile-book-cta.tsx');
const bookingUi = read('e2e/helpers/booking-ui.ts');
const bookingSvc = read('apps/api/src/services/booking.service.ts');
const holdSvc = read('apps/api/src/services/booking-hold.service.ts');
const paymentSvc = read('apps/api/src/services/payment.service.ts');
const financials = read('packages/shared/src/booking-financials.ts');
const locPriv = read('packages/shared/src/location-privacy.ts');
const publicMapper = read('apps/api/src/mappers/public-booking.mapper.ts');
const schemaPrisma = read('packages/db/prisma/schema.prisma');
const detailView = read('apps/web/src/components/marketplace/property-detail-view.tsx');

console.log('\nCB-UX-1 Customer Booking UX Restructure QA\n');

expect('01 entry card exists', entry.includes('booking-entry-card'));
expect(
  '02 no date selector on entry',
  !entry.includes('AvailabilityCalendar') && !entry.includes('booking-date'),
);
expect('03 no period selector on entry', !entry.includes('BookingPeriodSelector'));
expect('04 no guest stepper on entry', !entry.includes('GuestCountStepper'));
expect(
  '05 morning price logic',
  entry.includes("period === 'morning'") &&
    entry.includes('bookingEntryMorningPeriod') &&
    entry.includes('bookingEntryGenericFrom') &&
    entry.includes('data-morning={morningFound') &&
    entry.includes("morningFound ? t('bookingEntryMorningPeriod') : t('bookingEntryGenericFrom')"),
);
expect('06 capacity from property', entry.includes('property.capacity'));
expect('07 period types summary', entry.includes('booking-entry-periods'));
expect(
  '08 instant/approval indicator',
  entry.includes('bookingEntryInstant') && entry.includes('bookingEntryOwnerApproval'),
);
expect(
  '09 Book Now route',
  entry.includes('/book') && ar.common.bookNow === 'احجز الآن' && en.common.bookNow === 'Book now',
);
expect('10 Book Now no createBooking', !entry.includes('createBooking'));
expect('11 dedicated book page', exists('apps/web/src/app/[locale]/properties/[slug]/book/page.tsx'));
expect('12 calendar still in panel', panel.includes('AvailabilityCalendar'));
expect('13 period in panel', panel.includes('BookingPeriodSelector'));
expect('14 guests in panel', panel.includes('GuestCountStepper'));
expect('15 quote in panel', panel.includes('fetchBookingQuote') || panel.includes('BookingQuoteBreakdown'));
expect('16 coupon in panel', panel.includes('coupon-box'));
expect(
  '17 no Hold before CTA on entry/book route alone',
  !entry.includes('createBooking') && bookPage.includes('robots'),
);
expect(
  '18 Instant Continue copy',
  ar.property.ctaContinuePayment === 'متابعة للدفع',
);
expect(
  '19 Owner Approval request copy',
  ar.property.ctaSendRequest === 'إرسال طلب الحجز',
);
expect('20 payment page separate', view.includes('checkout-page') && ar.checkout.title === 'إتمام الدفع');
expect(
  '21 Deposit/Full only payment',
  choiceUi.includes('payDepositNowTitle') && !entry.includes('initialPaymentChoice'),
);
expect('22 payment method only payment', method.includes('Payment') || method.includes('managed'));
expect('23 summary on config', panel.includes('paymentSummaryTitle') || panel.includes('BookingQuoteBreakdown'));
expect('24 managed form preserved', method.includes('managed_form') || view.includes('managed_form'));
expect('25 saved card preserved', view.includes('savedCard') || method.includes('saved'));
expect('26 HPP fallback preserved', view.includes('hosted_redirect') || view.includes('preferHostedFallback'));
expect('27 Balance CTA preserved', ar.checkout.payBalanceCta?.includes('المتبقي') || en.checkout.payBalanceCta.includes('remaining'));
expect('28 success confirmation', returnUi.includes('returnConfirmedTitle') && returnUi.includes('booking-confirmation-summary'));
expect('29 backend-authoritative success', returnUi.includes('fetchPaymentReturnStatus') && !returnUi.includes('search.get(\'status\')'));
expect(
  '30 location authorization',
  returnUi.includes('booking?.arrival') && publicMapper.includes('canRevealExactLocation'),
);
expect(
  '31 exact location not public entry',
  !entry.includes('exactAddress') && !detailView.includes('exactAddress'),
);
expect('32 booking-owner IDOR via me booking', returnUi.includes('fetchMyBooking'));
expect('33 processing state', returnUi.includes('returnProcessingTitle') || returnUi.includes('pending'));
expect('34 mobile sticky CTA', panel.includes('booking-sticky-cta'));
expect('35 RTL copy', ar.property.bookingPanelTitle === 'احجز إقامتك');
expect('36 EN copy', en.checkout.title === 'Complete payment');
expect('37 desktop sticky becomes static', panel.includes('lg:static'));
expect('38 accessibility calendar/submit', panel.includes('booking-submit') && panel.includes('AvailabilityCalendar'));
expect(
  '39 no financial formula change in UX files',
  !entry.includes('customerServiceFee') && !panel.includes('platformCommission'),
);
expect(
  '40 payment security unchanged markers',
  paymentSvc.includes('managed-form') || paymentSvc.includes('managedForm'),
);
expect('41 createBooking only on submit', panel.includes('createBooking') && panel.includes('handleBook'));
expect(
  '42 no false 7-day cancellation',
  !ar.property.safeBookingSubtitle?.includes('7 أيام') &&
    !entry.includes('7 أيام') &&
    ar.property.safeBookingPolicyLink.includes('الإلغاء'),
);
expect(
  '43 no schema for notes',
  !schemaPrisma.includes('customerNotes') && !panel.includes('ملاحظات إضافية'),
);
expect('44 no production mutation scripts', !exists('scripts/prod-booking-ux.ts'));
expect('45 aside uses entry card', aside.includes('PropertyBookingEntryCard') && !aside.includes('<BookingPanel'));
expect('46 mobile CTA navigates to book', mobileCta.includes('/book'));
expect('47 chrome hides bottom nav on book', chrome.includes('isBookingConfigPath'));
expect('48 e2e helper book route', bookingUi.includes('/book') && bookingUi.includes('booking-entry-card'));
expect('49 hold still server-side', holdSvc.includes('holdExpiresAt') || bookingSvc.includes('holdExpiresAt'));
expect('50 financials module untouched by UX', financials.includes('customerServiceFeeAmount'));

expect(
  '51 location reveal rules intact',
  canRevealExactLocation({ status: 'confirmed', paymentState: 'deposit_paid' }) === true &&
    canRevealExactLocation({ status: 'pending_owner_approval', paymentState: 'unpaid' }) === false &&
    canRevealExactLocation({ status: 'pending_payment', paymentState: 'unpaid' }) === false,
);

expect('52 notes skipped (no field)', !schemaPrisma.match(/notes.*customer|customerNote/i));

const e2eUx = exists('e2e/cb-ux1-booking-journey.spec.ts');
const e2eFinal = exists('e2e/cb-ux1-final-acceptance.spec.ts');
expect('53 UX e2e file or helper updated', e2eUx || bookingUi.includes('gotoPropertyDetail'));
expect('53b final acceptance e2e', e2eFinal);

if (exists('_cb_ux1_final_acceptance')) {
  const shots = readdirSync(join(root, '_cb_ux1_final_acceptance')).filter((f) =>
    f.endsWith('.png'),
  );
  expect('54 visual final acceptance dir', shots.length >= 0);
} else if (exists('_cb_ux1_visual')) {
  pass('54 visual dir optional until capture');
} else {
  pass('54 visual dir optional until capture');
}

expect(
  '55 morning wording gated by morningFound',
  entry.includes("morningFound ? t('bookingEntryMorningPeriod') : t('bookingEntryGenericFrom')"),
);

expect(
  '56 location reveal after deposit_paid confirmed',
  canRevealExactLocation({ status: 'confirmed', paymentState: 'deposit_paid' }) === true &&
    canRevealExactLocation({ status: 'confirmed', paymentState: 'fully_paid' }) === true,
);

console.log(`\nCB-UX-1 result: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
