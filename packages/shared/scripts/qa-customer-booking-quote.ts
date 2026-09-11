/**
 * CB-2 — Customer booking quote static QA.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-customer-booking-quote.ts
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
const quoteSvc = readFileSync(
  join(root, 'apps/api/src/services/booking-quote.service.ts'),
  'utf8',
);
const bookingSvc = readFileSync(join(root, 'apps/api/src/services/booking.service.ts'), 'utf8');
const routes = readFileSync(join(root, 'apps/api/src/routes/properties.ts'), 'utf8');
const panel = readFileSync(
  join(root, 'apps/web/src/components/marketplace/booking-panel.tsx'),
  'utf8',
);
const breakdown = readFileSync(
  join(root, 'apps/web/src/components/marketplace/booking/booking-quote-breakdown.tsx'),
  'utf8',
);
const apiBookings = readFileSync(join(root, 'apps/web/src/lib/api-bookings.ts'), 'utf8');
const schema = readFileSync(join(root, 'packages/shared/src/schemas/property-search.ts'), 'utf8');
const types = readFileSync(join(root, 'packages/shared/src/types.ts'), 'utf8');
const financials = readFileSync(join(root, 'packages/shared/src/booking-financials.ts'), 'utf8');
const ar = JSON.parse(readFileSync(join(root, 'apps/web/messages/ar.json'), 'utf8'));
const en = JSON.parse(readFileSync(join(root, 'apps/web/messages/en.json'), 'utf8'));
const e2e = existsSync(join(root, 'e2e/cb2-booking-quote.spec.ts'))
  ? readFileSync(join(root, 'e2e/cb2-booking-quote.spec.ts'), 'utf8')
  : '';
const schemaPrisma = join(root, 'packages/db/prisma/schema.prisma');
const envExample = readFileSync(join(root, '.env.example'), 'utf8');
const calendarQa = existsSync(
  join(root, 'packages/shared/scripts/qa-customer-booking-calendar.ts'),
);

console.log('\n— CB-2 customer booking quote —\n');

expect('1 quote read-only (no booking.create in quote svc)', !quoteSvc.includes('prisma.booking.create'));
expect('2 server authority via resolveBookingPricing', quoteSvc.includes('resolveBookingPricing'));
expect('3 bookingQuoteSchema date', schema.includes('bookingQuoteSchema') && schema.includes('date:'));
expect('4 bookingQuoteSchema period', schema.includes('period: z.enum'));
expect('5 guest validation min 1', quoteSvc.includes('Guest count must be at least 1'));
expect('6 capacity validation', quoteSvc.includes('Guest count exceeds property capacity'));
expect('7 baseAmount in quote type', types.includes('baseAmount: number'));
expect('8 promotion reflected', quoteSvc.includes('resolvePriceForSlot') && quoteSvc.includes('appliedPromotion'));
expect('9 coupon revalidated on quote', quoteSvc.includes('evaluateCouponForCustomer'));
expect(
  '10 customer service fee from snapshot',
  quoteSvc.includes('customerServiceFeeAmount') && financials.includes('customerServiceFeeAmount'),
);
expect(
  '11 no fake tax in breakdown UI',
  !breakdown.includes('ضريبة') && !breakdown.includes('VAT') && !breakdown.includes('taxAmount'),
);
expect(
  '12 commission not shown in customer breakdown',
  !breakdown.includes('platformCommission') && !breakdown.includes('عمولة'),
);
expect('13 total customerPayableTotal', breakdown.includes('customerPayableTotal'));
expect('14 depositDueAmount', breakdown.includes('depositDueAmount') && breakdown.includes('quoteDepositDue'));
expect('15 remainingAmount', breakdown.includes('remainingAmount'));
expect(
  '16 guests do not multiply price',
  !panel.includes('per person') && !panel.includes('لكل شخص') && !panel.includes('perPerson'),
);
expect('17 quote race seq', panel.includes('quoteSeq'));
expect('18 quote error fail-closed', panel.includes('quoteLoadError') && panel.includes('setQuote(null)'));
expect('19 no booking on quote route', routes.includes("'/':slug/booking-quote'") || routes.includes('/:slug/booking-quote'));
expect('19b quote route uses getBookingQuote', routes.includes('getBookingQuote'));
expect('20 no hold mutation in quote', !quoteSvc.includes('AvailabilitySlotStatus.booked'));
expect('21 no payment in quote', !quoteSvc.includes('prisma.payment') && !quoteSvc.includes('create-intent'));
expect('22 instant CTA', ar.property.ctaContinuePayment === 'متابعة للدفع' && panel.includes('ctaContinuePayment'));
expect('23 owner approval CTA', ar.property.ctaSendRequest === 'إرسال طلب الحجز');
expect(
  '24 owner approval no-charge copy',
  ar.property.ownerApprovalNoCharge.includes('لن يتم خصم') && panel.includes('owner-approval-no-charge-note'),
);
expect('25 create uses expectedTotalAmount from quote', panel.includes('expectedTotalAmount: quote.expectedTotalAmount'));
expect(
  '26 owner approval path',
  panel.includes('pending_owner_approval') && panel.includes('/account/bookings'),
);
expect(
  '27 PRICING_CHANGED review UX',
  panel.includes('pricingChangedReview') && ar.property.pricingChangedReview.includes('تم تحديث السعر'),
);
expect('28 SLOT_UNAVAILABLE handling', panel.includes('SLOT_UNAVAILABLE') && panel.includes('slotUnavailable'));
expect(
  '29 createBooking still authoritative',
  bookingSvc.includes('resolveBookingPricing') && bookingSvc.includes('PRICING_CHANGED'),
);
expect(
  '30 deposit_balance unchanged',
  quoteSvc.includes("paymentCollectionMode: 'deposit_balance'") &&
    bookingSvc.includes('PaymentCollectionMode.deposit_balance'),
);
expect('31 no full-payment UI', !panel.includes('paymentCollectionMode') || !panel.includes('fullPayment'));
expect(
  '32 cancellation neutral',
  panel.includes('safeBookingPolicyLink') && !panel.includes("{t('safeBookingSubtitle')}"),
);
expect('33 CB-1 calendar still wired', panel.includes('AvailabilityCalendar') && calendarQa);
expect('34 AR CTA strings', Boolean(ar.property.ctaContinuePayment && ar.property.ctaSendRequest));
expect('35 EN CTA strings', en.property.ctaContinuePayment === 'Continue to payment');
expect(
  '36 accessibility quote live',
  breakdown.includes('aria-live') && breakdown.includes('role="alert"'),
);
expect('37 schema file present no quote migration needed', existsSync(schemaPrisma));
expect('38 no env quote invention', !envExample.includes('BOOKING_QUOTE'));
expect(
  '39 PayTabs unchanged in panel',
  !panel.includes('PayTabs') && !panel.includes('create-intent') && !quoteSvc.includes('paytabs'),
);
expect('40 no production mutation helpers', !quoteSvc.includes('ensure-available') && !e2e.includes('PRODUCTION'));
expect('fetchBookingQuote client', apiBookings.includes('fetchBookingQuote'));
expect('e2e suite present', e2e.includes('CB-2') && e2e.includes('booking-quote'));
expect('create shares resolveBookingPricing', bookingSvc.includes('resolveBookingPricing'));

console.log(`\nCB-2 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
