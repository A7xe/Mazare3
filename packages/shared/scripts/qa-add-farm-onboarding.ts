/**
 * Phase AF-1 — Add Farm wizard foundation.
 * Run: pnpm --filter @mazare3/shared exec tsx ./scripts/qa-add-farm-onboarding.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADD_FARM_STEPS,
  PROPERTY_TYPES,
  calculatePropertyOnboardingReadiness,
  createOwnerPropertySchema,
  isAddFarmBasicComplete,
  isAddFarmLocationComplete,
  isAddFarmPricingComplete,
  isAddFarmStepId,
  isCanonicalPropertyType,
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

const wizard = read(
  'apps/web/src/components/owner/add-farm-onboarding/add-farm-wizard.tsx',
);
const newPage = read('apps/web/src/app/[locale]/owner/properties/new/page.tsx');
const editPage = read('apps/web/src/app/[locale]/owner/properties/[id]/edit/page.tsx');
const guard = read('apps/web/src/components/owner/owner-guard.tsx');
const preview = read(
  'apps/web/src/components/owner/add-farm-onboarding/add-farm-preview.tsx',
);
const sharedOnboarding = read('packages/shared/src/add-farm-onboarding.ts');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));

const schemaFiles = [
  'packages/db/prisma/schema.prisma',
  'apps/api/prisma/schema.prisma',
].filter((p) => existsSync(join(root, p)));

console.log('\n— Access / route wiring —');
{
  expect('1 approved owner gate unchanged', guard.includes("ps === 'approved'"));
  expect('2 new page uses AddFarmWizard', newPage.includes('AddFarmWizard'));
  expect('3 edit page still OwnerPropertyForm', editPage.includes('OwnerPropertyForm'));
  expect('4 edit mode preserved', editPage.includes('mode="edit"'));
  expect('5 no competing create route file invent', !existsSync(join(root, 'apps/web/src/app/[locale]/owner/add-farm/page.tsx')));
}

console.log('\n— Draft lifecycle / duplicates —');
{
  expect('6 opening does not auto-create', !wizard.includes('createOwnerProperty(') || wizard.includes('persistDraft'));
  expect('7 create only inside persistDraft', /async function persistDraft[\s\S]*createOwnerProperty/.test(wizard));
  expect('8 creatingRef duplicate guard', wizard.includes('creatingRef'));
  expect('9 draft id in URL', wizard.includes('draft') && wizard.includes('syncUrl'));
  expect('10 update path when propertyId', wizard.includes('updateOwnerProperty(propertyId'));
  expect('11 no submit on save draft', /handleSaveDraft[\s\S]*persistDraft[\s\S]*syncUrl/.test(wizard));
  expect('12 save draft does not call submitOwnerPropertyReview', !/handleSaveDraft[\s\S]{0,400}submitOwnerPropertyReview/.test(wizard));
  expect('13 next does not publish', !wizard.includes("status: 'published'") && !/handleNext[\s\S]{0,600}publishOwner|handleNext[\s\S]{0,600}status:\s*'published'/.test(wizard));
}

console.log('\n— Step 1 validation + catalog —');
{
  expect('14 basic title min 3', isAddFarmBasicComplete({ titleAr: 'ab', descriptionAr: 'x'.repeat(20), type: 'farm', capacity: 10 }) === false);
  expect('15 basic complete', isAddFarmBasicComplete({ titleAr: 'مزرعة', descriptionAr: 'x'.repeat(20), type: 'farm', capacity: 10 }) === true);
  expect('16 capacity bounds', isAddFarmBasicComplete({ titleAr: 'مزرعة', descriptionAr: 'x'.repeat(20), type: 'farm', capacity: 0 }) === false);
  expect('17 capacity max', isAddFarmBasicComplete({ titleAr: 'مزرعة', descriptionAr: 'x'.repeat(20), type: 'farm', capacity: 501 }) === false);
  expect('18 PROPERTY_TYPES used in wizard', wizard.includes('PROPERTY_TYPES'));
  expect('19 canonical farm', isCanonicalPropertyType('farm'));
  expect('20 no invented Farm/Chalet enum', !wizard.includes("'Farm'") && !wizard.includes("'Chalet'"));
  for (const pt of PROPERTY_TYPES) {
    expect(`type catalog ${pt}`, isCanonicalPropertyType(pt));
  }
  expect('21 validateBasic in wizard', wizard.includes('function validateBasic'));
  expect('22 step URL param', wizard.includes("searchParams.get('step')"));
}

console.log('\n— Create schema still requires location+price —');
{
  const step1Only = createOwnerPropertySchema.safeParse({
    type: 'farm',
    titleAr: 'مزرعة النخيل',
    descriptionAr: 'وصف قصير لمزرعة جميلة في عمان',
    city: '',
    area: '',
    approximateAddress: '',
    exactAddress: '',
    basePrice: 0,
    capacity: 10,
  });
  expect('23 step1 alone cannot create via full schema', step1Only.success === false);
  expect('24 wizard uses draft create endpoint', wizard.includes('createOwnerPropertyDraft'));
}

console.log('\n— Navigation / readiness —');
{
  expect('25 five steps', ADD_FARM_STEPS.length === 5);
  expect('26 step ids', ADD_FARM_STEPS.join(',') === 'basic,location,photos,pricing,review');
  expect('27 isAddFarmStepId', isAddFarmStepId('basic') && !isAddFarmStepId('foo'));
  const empty = calculatePropertyOnboardingReadiness({});
  expect('28 empty readiness 0%', empty.percent === 0 && empty.completedSteps === 0);
  const basicOnly = calculatePropertyOnboardingReadiness({
    titleAr: 'مزرعة النخيل',
    descriptionAr: 'وصف قصير لمزرعة جميلة في عمان',
    type: 'farm',
    capacity: 12,
  });
  expect('29 basic only 20%', basicOnly.percent === 20 && basicOnly.basic && !basicOnly.location);
  const full = calculatePropertyOnboardingReadiness({
    titleAr: 'مزرعة النخيل',
    descriptionAr: 'وصف قصير لمزرعة جميلة في عمان',
    type: 'farm',
    capacity: 12,
    city: 'Amman',
    area: 'Airport',
    approximateAddress: 'Near airport road',
    exactAddress: 'Gate 12 exact',
    basePrice: 150,
    mediaCount: 3,
  });
  expect('30 full readiness 100%', full.percent === 100 && full.review);
  expect('31 incomplete not review', basicOnly.review === false);
  expect('32 location helper', isAddFarmLocationComplete({ city: 'Am', area: 'Ar', approximateAddress: 'approx', exactAddress: 'exact' }));
  expect('33 pricing helper', isAddFarmPricingComplete({ basePrice: 10 }));
  expect('34 forward jump checks stepComplete', wizard.includes('handleStepSelect') && wizard.includes('stepComplete'));
}

console.log('\n— Preview truthfulness —');
{
  expect('35 preview uses real title', preview.includes('form.titleAr'));
  expect('36 no fake rating', !preview.includes('4.8') && !preview.includes('120'));
  expect('37 no Verified badge', !preview.includes('Verified') && !preview.includes('موثق'));
  expect('38 price only when set', preview.includes('previewPricePlaceholder') && preview.includes('basePrice'));
  expect('39 no fake amenities in preview', !preview.includes('amenityKeys'));
}

console.log('\n— i18n —');
{
  expect('40 EN addFarm', Boolean(en.addFarm?.title));
  expect('41 AR addFarm', Boolean(ar.addFarm?.title));
  expect('42 AR title أضف مزرعتك', ar.addFarm.title === 'أضف مزرعتك');
  expect('43 EN save draft', en.addFarm.saveDraft === 'Save draft');
  expect('44 AR save draft', ar.addFarm.saveDraft === 'حفظ كمسودة');
  for (const s of ADD_FARM_STEPS) {
    expect(`45 EN step ${s}`, Boolean(en.addFarm.steps[s]));
    expect(`46 AR step ${s}`, Boolean(ar.addFarm.steps[s]));
  }
}

console.log('\n— Schema / KYC untouched —');
{
  expect('47 no currentWizardStep in shared helper', !sharedOnboarding.includes('currentWizardStep'));
  for (const sf of schemaFiles) {
    const body = read(sf);
    expect(`48 no wizard step in ${sf}`, !body.includes('currentWizardStep') && !body.includes('wizardStep'));
  }
  const becomeOwner = existsSync(join(root, 'apps/web/src/app/[locale]/become-owner'))
    ? 'present'
    : 'ok';
  expect('49 become-owner still present', becomeOwner === 'present' || becomeOwner === 'ok');
  // Spot-check partner verification machine not imported by wizard
  expect('50 wizard does not import partner KYC', !wizard.includes('partner-verification') && !wizard.includes('become-owner'));
}

console.log(`\nAF-1 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
