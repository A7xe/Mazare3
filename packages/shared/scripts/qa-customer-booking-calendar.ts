/**
 * CB-1 — Customer booking calendar static QA.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-customer-booking-calendar.ts
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
const panel = readFileSync(
  join(root, 'apps/web/src/components/marketplace/booking-panel.tsx'),
  'utf8',
);
const calendar = readFileSync(
  join(root, 'apps/web/src/components/marketplace/booking/availability-calendar.tsx'),
  'utf8',
);
const periods = readFileSync(
  join(root, 'apps/web/src/components/marketplace/booking/booking-period-selector.tsx'),
  'utf8',
);
const guests = readFileSync(
  join(root, 'apps/web/src/components/marketplace/booking/guest-count-stepper.tsx'),
  'utf8',
);
const helpers = readFileSync(join(root, 'apps/web/src/lib/booking-calendar.ts'), 'utf8');
const bookingUi = readFileSync(join(root, 'e2e/helpers/booking-ui.ts'), 'utf8');
const e2eSpec = readFileSync(join(root, 'e2e/cb1-booking-calendar.spec.ts'), 'utf8');
const ar = JSON.parse(readFileSync(join(root, 'apps/web/messages/ar.json'), 'utf8'));
const en = JSON.parse(readFileSync(join(root, 'apps/web/messages/en.json'), 'utf8'));
const schemaPath = join(root, 'packages/db/prisma/schema.prisma');
const envExample = readFileSync(join(root, '.env.example'), 'utf8');
const availabilityConfig = readFileSync(
  join(root, 'apps/api/src/config/availability-config.ts'),
  'utf8',
);

console.log('\n— CB-1 customer booking calendar —\n');

expect('1 native date input removed from panel', !panel.includes('type="date"'));
expect(
  '1b calendar component present',
  existsSync(join(root, 'apps/web/src/components/marketplace/booking/availability-calendar.tsx')),
);
expect('2 full-month grid role', calendar.includes('role="grid"') && calendar.includes('booking-calendar-grid'));
expect('3 one range fetch helper', helpers.includes('monthRangeForFetch') && calendar.includes('monthRangeForFetch'));
expect(
  '3b fetchPropertyAvailability once per month path',
  calendar.includes('fetchPropertyAvailability') && !calendar.includes('for (const day'),
);
expect('4 currentMonthKey used', calendar.includes('currentMonthKey()'));
expect('5 prev disabled at current', calendar.includes('canPrev') && calendar.includes('disabled={!canPrev'));
expect('6 next month navigation', calendar.includes('booking-calendar-next') && helpers.includes('shiftMonthKey'));
expect('7 back toward current via prev', calendar.includes('booking-calendar-prev'));
expect('8 past via dayAvailabilityState', helpers.includes("iso < today") && helpers.includes("return 'past'"));
expect('9 today aria-current', calendar.includes("aria-current={isToday ? 'date'"));
expect('10 full availability state', helpers.includes("return 'available'"));
expect('11 partial availability state', helpers.includes("partially_available"));
expect('12 unavailable state', helpers.includes("return 'unavailable'"));
expect(
  '13 no false booked customer copy in calendar',
  !calendar.includes('محجوز') && ar.property.calendar.unavailable === 'غير متاح',
);
expect('14 morning period key', ar.property.period.morning === 'صباحي' && en.property.period.morning === 'Morning');
expect('15 evening period key', ar.property.period.evening === 'مسائي');
expect('16 full_day period key', ar.property.period.full_day === 'يوم كامل');
expect('17 overnight period key', ar.property.period.overnight === 'مبيت');
expect('18 real start/end times rendered', periods.includes('startAtLocal') && periods.includes('endAtLocal'));
expect(
  '19 selected date testid',
  calendar.includes('booking-date-trigger') && calendar.includes('data-testid="booking-date"'),
);
expect('20 period reset on date change', panel.includes("setPeriod('')") && panel.includes('handleSelectDate'));
expect('21 guest stepper', guests.includes('booking-guest-stepper') && guests.includes('booking-guests-decrease'));
expect('22 min guest 1', guests.includes('const min = 1'));
expect('23 max capacity', guests.includes('capacity') && guests.includes('booking-guests-increase'));
expect(
  '24 guests do not change price',
  !panel.includes('per person') && !panel.includes('لكل شخص') && !panel.includes('perPerson'),
);
expect('25 availability API authority', calendar.includes('fetchPropertyAvailability'));
expect(
  '26 no hold on calendar/period selection modules',
  !calendar.includes('createBooking') && !periods.includes('createBooking') && !guests.includes('createBooking'),
);
expect(
  '26b createBooking only on submit handler',
  panel.includes('async function handleBook') && panel.includes('createBooking({'),
);
expect('27 booking create still authoritative', panel.includes('createBooking') && panel.includes('SLOT_UNAVAILABLE'));
expect('28 stale slot rejected UI', panel.includes('slotUnavailable') && panel.includes('calendarEpoch'));
expect('29 instant checkout path preserved', panel.includes('checkout/${res.data.id}'));
expect(
  '30 owner approval path preserved',
  panel.includes('pending_owner_approval') && panel.includes('/account/bookings'),
);
expect('31 Favorite regression', panel.includes('FavoriteButton'));
expect(
  '32 cancellation copy truthful/neutral',
  panel.includes('safeBookingPolicyLink') &&
    ar.property.safeBookingPolicyLink.includes('الإلغاء') &&
    !ar.property.safeBookingPolicyLink.includes('7 أيام') &&
    !panel.includes("{t('safeBookingSubtitle')}"),
);
expect('33 AR calendar strings', Boolean(ar.property.calendar?.loadError?.includes('تعذر')));
expect('34 EN calendar strings', Boolean(en.property.calendar?.unavailable === 'Unavailable'));
expect(
  '35 RTL month nav icons flip not logic',
  calendar.includes('isRtl') && calendar.includes('canPrev') && calendar.includes('shiftMonthKey(m, -1)'),
);
expect(
  '36 accessibility calendar + periods + guests',
  calendar.includes('aria-label') && periods.includes('role="radiogroup"') && guests.includes('aria-label'),
);
expect('37 no schema file missing', existsSync(schemaPath));
expect('38 no env calendar horizon invention', !envExample.includes('BOOKING_CALENDAR_HORIZON'));
expect('39 no payment change in panel', !panel.includes('PayTabs') && !panel.includes('create-intent'));
expect('40 no production mutation helpers in calendar', !calendar.includes('prisma') && !calendar.includes('ensure-available'));

expect(
  'horizon mirrors API 90',
  helpers.includes('BOOKING_CALENDAR_HORIZON_DAYS = 90') &&
    availabilityConfig.includes('DEFAULT_AVAILABILITY_HORIZON_DAYS = 90'),
);
expect(
  'selectDateForPeriods empty hint',
  ar.property.selectDateForPeriods.includes('اختر يومًا') && periods.includes('selectDateForPeriods'),
);
expect('platform timezone Asia/Amman', helpers.includes("BOOKING_CALENDAR_TIME_ZONE = 'Asia/Amman'"));
expect('hidden booking-date keeps e2e value', calendar.includes('type="hidden"') && calendar.includes('booking-date'));
expect('race-safe requestSeq', calendar.includes('requestSeq'));
expect('month cache Map', calendar.includes('cacheRef'));
expect('skeleton loading', calendar.includes('booking-calendar-skeleton'));
expect('error retry', calendar.includes('booking-calendar-retry'));
expect('e2e helper uses calendar not fill', bookingUi.includes('selectCalendarDate') && !bookingUi.includes(".fill(slot.date)"));
expect('e2e suite present', e2eSpec.includes('CB-1') && e2eSpec.includes('one range fetch'));
expect('latn numbering convention', helpers.includes("numberingSystem: 'latn'"));
expect('extracted period + guest components', panel.includes('BookingPeriodSelector') && panel.includes('GuestCountStepper'));

console.log(`\nCB-1 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
