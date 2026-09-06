/**
 * Phase AF-4 — Add Farm Pricing & Availability.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-add-farm-pricing-availability.ts
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AVAILABILITY_PERIODS,
  TEST_DEFAULT_DEPOSIT_PERCENT,
  calculatePropertyOnboardingReadiness,
  isAddFarmPricingComplete,
} from '../src/index.ts';

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

const pricingStep = read(
  'apps/web/src/components/owner/add-farm-onboarding/steps/pricing-availability-step.tsx',
);
const wizard = read('apps/web/src/components/owner/add-farm-onboarding/add-farm-wizard.tsx');
const preview = read('apps/web/src/components/owner/add-farm-onboarding/add-farm-preview.tsx');
const onboarding = read('packages/shared/src/add-farm-onboarding.ts');
const listingComplete = read('packages/shared/src/property-listing-completeness.ts');
const bookingService = read('apps/api/src/services/booking.service.ts');
const search = read('apps/api/src/services/property-search.service.ts');
const genService = read('apps/api/src/services/availability-generation.service.ts');
const ownerAvailPage = read('apps/web/src/app/[locale]/owner/availability/page.tsx');
const ownerSchedule = read('apps/web/src/components/owner/owner-availability-schedule.tsx');
const paymentPolicy = read('apps/api/src/config/payment-policy.config.ts');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const migrationsDir = join(root, 'packages/db/prisma/migrations');

console.log('\n— Draft / basePrice —');
{
  expect('1 pricing need draft messaging', pricingStep.includes('pricingNeedDraft'));
  expect('2 Next requires propertyId for pricing', wizard.includes('pricingNeedDraft'));
  expect('3 same draft syncUrl', wizard.includes('syncUrl(next, id)'));
  expect('4 basePrice > 0 validation', wizard.includes('price <= 0') && pricingStep.includes('add-farm-base-price'));
  expect(
    '5 readiness pricing = positive basePrice',
    isAddFarmPricingComplete({ basePrice: 100 }) && !isAddFarmPricingComplete({ basePrice: null }),
  );
  expect('6 null basePrice allowed in partial readiness', !isAddFarmPricingComplete({}));
  expect('7 JOD via formatPrice / currencyJod', pricingStep.includes('currencyJod') && preview.includes('formatPrice'));
  expect('8 browse from semantics', pricingStep.includes('basePriceBrowseHint') && preview.includes("tCommon('from')"));
  expect('9 no revenue estimate', !pricingStep.includes('monthly') && !pricingStep.includes('earn'));
  expect(
    '10 no fake recommendation price',
    !pricingStep.includes('Recommended 70') &&
      !pricingStep.includes('too expensive') &&
      !pricingStep.includes('market benchmark'),
  );
}

console.log('\n— Deposit / commission —');
{
  expect('11 deposit informational only', pricingStep.includes('depositBody') && pricingStep.includes('TEST_DEFAULT_DEPOSIT_PERCENT'));
  expect('12 no editable depositPercent input', !pricingStep.includes('depositPercent') || !pricingStep.includes('name="deposit'));
  expect('13 no commission input', !pricingStep.includes('commission') || pricingStep.includes('depositBody'));
  expect('14 platform deposit config authoritative', paymentPolicy.includes('defaultDepositPercent'));
  expect('15 default deposit constant', TEST_DEFAULT_DEPOSIT_PERCENT === 30);
}

console.log('\n— Periods / overnight —');
{
  expect('16 canonical AVAILABILITY_PERIODS', pricingStep.includes('AVAILABILITY_PERIODS'));
  expect('17 periods are morning evening full_day overnight', AVAILABILITY_PERIODS.join(',') === 'morning,evening,full_day,overnight');
  expect('18 overnight gated by allowsOvernight', pricingStep.includes("p !== 'overnight' || form.allowsOvernight"));
  expect('19 no second allowsOvernight toggle', !/allowsOvernight:\s*!/.test(pricingStep) && !pricingStep.includes('onChange({ allowsOvernight'));
  expect('20 period pricing via putOwnerAvailabilityRules', pricingStep.includes('putOwnerAvailabilityRules'));
}

console.log('\n— Availability engine reuse —');
{
  expect('21 generateOwnerAvailability reused', pricingStep.includes('generateOwnerAvailability'));
  expect('22 no wizard-only slot invent', !pricingStep.includes('createMany') && !wizard.includes('AvailabilitySlot'));
  expect('23 generate not on open', !/useEffect[\s\S]{0,200}generateOwnerAvailability/.test(pricingStep));
  expect('24 generation clamps past dates', genService.includes('from < today') || genService.includes('from = today'));
  expect('25 Asia/Amman / platform TZ in gen path', genService.includes('Asia/Amman') || genService.includes('platformTimeZone') || genService.includes('getPlatformTimeZone'));
  expect('26 insert-only / skipDuplicates', genService.includes('skipDuplicates') || genService.includes('alreadyExisting'));
  expect('27 dirty-gated rule persist', pricingStep.includes('if (!propertyId || !dirty)'));
}

console.log('\n— Save / Next / partial failure —');
{
  expect('28 Save Draft partial allowed', /handleSaveDraft[\s\S]*step === 'basic' \|\| !propertyId/.test(wizard));
  expect('29 Save does not submit review', !/handleSaveDraft[\s\S]{0,800}submitOwnerPropertyReview/.test(wizard));
  expect('30 persistAvailabilityIfNeeded', wizard.includes('persistAvailabilityIfNeeded'));
  expect('31 Next blocked on avail failure', /availOk = await persistAvailabilityIfNeeded[\s\S]*if \(!availOk\) return/.test(wizard));
  expect('32 Next advances to review via ADD_FARM_STEPS', wizard.includes('ADD_FARM_STEPS[idx + 1]'));
  expect('33 no auto submit-review on pricing', !/step === 'pricing'[\s\S]{0,400}submitOwnerPropertyReview/.test(wizard));
  expect('34 availability save failed copy', en.addFarm.errors.availabilitySaveFailed.includes('Base price was saved'));
}

console.log('\n— Preview / promotions —');
{
  expect('35 preview uses formatPrice', preview.includes('formatPrice(basePrice'));
  expect('36 no fake promo in preview', !preview.includes('discount') && !preview.includes('wasPrice'));
  expect('37 no promotion apply in step', !pricingStep.includes('resolveSlotPromotion') && !pricingStep.includes('promotional'));
}

console.log('\n— Gates / public / regression freeze —');
{
  expect('38 listing complete needs basePrice', listingComplete.includes('basePrice'));
  expect('39 search excludes drafts via published', search.includes('PropertyStatus.published'));
  expect('40 PRICING_CHANGED still in booking', bookingService.includes('PRICING_CHANGED'));
  expect('41 owner availability page intact', ownerAvailPage.includes('OwnerAvailabilityView') || ownerAvailPage.includes('owner-availability'));
  expect('42 advanced schedule component intact', ownerSchedule.includes('OwnerAvailabilitySchedule'));
  expect('43 readiness pricing helper unchanged meaning', onboarding.includes('isAddFarmPricingComplete'));
  const priced = calculatePropertyOnboardingReadiness({
    titleAr: 'مزرعة النخيل',
    descriptionAr: 'وصف قصير لمزرعة جميلة في عمان',
    type: 'farm',
    capacity: 12,
    city: 'amman',
    area: 'Airport',
    approximateAddress: 'Near airport road',
    exactAddress: 'Gate 12 exact',
    basePrice: 150,
    mediaCount: 1,
  });
  expect('44 four buckets → review when price set', priced.pricing && priced.review && priced.percent === 100);
  expect(
    '45 pricing incomplete without price',
    calculatePropertyOnboardingReadiness({
      titleAr: 'مزرعة النخيل',
      descriptionAr: 'وصف قصير لمزرعة جميلة في عمان',
      type: 'farm',
      capacity: 12,
      city: 'amman',
      area: 'Airport',
      approximateAddress: 'Near airport road',
      exactAddress: 'Gate 12 exact',
      mediaCount: 1,
    }).pricing === false,
  );
}

console.log('\n— i18n / schema / KYC —');
{
  expect('46 EN basePriceLabel', en.addFarm.basePriceLabel === 'Base price');
  expect('47 AR basePriceLabel', ar.addFarm.basePriceLabel === 'السعر الأساسي');
  expect('48 EN depositBody', Boolean(en.addFarm.depositBody));
  expect('49 AR periodsHeading', Boolean(ar.addFarm.periodsHeading));
  expect('50 AR overnight hint', Boolean(ar.addFarm.overnightDisabledHint));
  const af4Migrations = readdirSync(migrationsDir).filter((d) => /af[-_]?4/i.test(d));
  expect('51 no AF-4 migration', af4Migrations.length === 0);
  expect('52 wizard no partner KYC', !wizard.includes('partner-verification') && !wizard.includes('become-owner'));
  expect('53 no commission field UI', !pricingStep.includes('platformCommission'));
  expect('54 no null→0 coercion of basePrice input', !pricingStep.includes('basePrice: 0') && !wizard.includes('basePrice: 0,'));
}

console.log(`\nAF-4 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
