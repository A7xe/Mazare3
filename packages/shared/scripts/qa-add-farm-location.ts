/**
 * Phase AF-2 — Add Farm Location step + privacy-safe map.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-add-farm-location.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXACT_LOCATION_PAYLOAD_KEYS,
  JORDAN_CITIES,
  approximateCoordsFromExact,
  canRevealExactLocation,
  isAddFarmLocationComplete,
  isPropertyListingCoreComplete,
  toPublicLocation,
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

const locationStep = read(
  'apps/web/src/components/owner/add-farm-onboarding/steps/location-step.tsx',
);
const wizard = read('apps/web/src/components/owner/add-farm-onboarding/add-farm-wizard.tsx');
const mapPreview = read(
  'apps/web/src/components/owner/add-farm-onboarding/add-farm-map-preview.tsx',
);
const preview = read('apps/web/src/components/owner/add-farm-onboarding/add-farm-preview.tsx');
const privacy = read('packages/shared/src/location-privacy.ts');
const publicMapper = read('apps/api/src/mappers/public-property.mapper.ts');
const search = read('apps/api/src/services/property-search.service.ts');
const editPage = read('apps/web/src/app/[locale]/owner/properties/[id]/edit/page.tsx');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const migrationsDir = join(root, 'packages/db/prisma/migrations');

console.log('\n— Step 2 fields / city catalog —');
{
  expect('1 uses JORDAN_CITIES', locationStep.includes('JORDAN_CITIES'));
  expect('2 city is select control', locationStep.includes('<select'));
  expect('3 stores city keys via option value={c.key}', locationStep.includes('value={c.key}'));
  expect('4 amman in catalog', JORDAN_CITIES.some((c) => c.key === 'amman'));
  expect('5 public + private sections', locationStep.includes('publicLocationTitle') && locationStep.includes('privateLocationTitle'));
  expect('6 OwnerLocationPicker reused', locationStep.includes('OwnerLocationPicker'));
  expect('7 approximateAddress field', locationStep.includes('approximateAddress'));
  expect('8 exactAddress field', locationStep.includes('exactAddress'));
  expect('9 privacy callout', locationStep.includes('add-farm-location-privacy'));
  expect('10 no geocoding provider invent', !locationStep.includes('nominatim') && !locationStep.includes('google.maps.Geocoder'));
}

console.log('\n— Save Draft vs Next —');
{
  expect('11 Save Draft allows partial location', /handleSaveDraft[\s\S]*step === 'basic' \|\| !propertyId/.test(wizard));
  expect('12 Next validates location', wizard.includes("if (s === 'location')"));
  expect('13 location extras after draft create', wizard.includes('locationPatchExtras'));
  expect('14 PATCH same draft', wizard.includes('updateOwnerProperty(propertyId'));
  expect('15 Next advances via ADD_FARM_STEPS', wizard.includes('ADD_FARM_STEPS[idx + 1]'));
}

console.log('\n— Completeness / coords optional —');
{
  expect(
    '16 location complete without coords',
    isAddFarmLocationComplete({
      city: 'amman',
      area: 'Airport',
      approximateAddress: 'Near airport road',
      exactAddress: 'Gate 12 private',
    }),
  );
  expect(
    '17 location incomplete without exactAddress',
    isAddFarmLocationComplete({
      city: 'amman',
      area: 'Airport',
      approximateAddress: 'Near airport road',
      exactAddress: '',
    }) === false,
  );
  expect(
    '18 listing incomplete without price',
    isPropertyListingCoreComplete({
      city: 'amman',
      area: 'Airport',
      approximateAddress: 'Near airport road',
      exactAddress: 'Gate 12 private',
      basePrice: null,
    }) === false,
  );
}

console.log('\n— Privacy model —');
{
  expect('19 exact keys deny list', EXACT_LOCATION_PAYLOAD_KEYS.includes('exactAddress'));
  expect('20 exact coords deny list', EXACT_LOCATION_PAYLOAD_KEYS.includes('latitudeExact'));
  expect(
    '21 reveal only confirmed + paid',
    canRevealExactLocation({ status: 'confirmed', paymentState: 'deposit_paid' }) === true,
  );
  expect(
    '22 hide unpaid',
    canRevealExactLocation({ status: 'confirmed', paymentState: 'unpaid' }) === false,
  );
  const pub = toPublicLocation({
    city: 'amman',
    area: 'Airport',
    approximateAddress: 'Near road',
    latitudeApprox: 31.95,
    longitudeApprox: 35.91,
  });
  expect('23 public uses approximateLocation', pub.approximateLocation === 'Near road');
  expect('24 approx derivation exists', Boolean(approximateCoordsFromExact(31.953, 35.91)));
  expect('25 public mapper uses toPublicLocation', publicMapper.includes('toPublicLocation'));
  expect('26 public mapper has no exactAddress', !publicMapper.includes('exactAddress'));
  expect('27 privacy wording matches deposit/payment', en.addFarm.privacyBody.includes('deposit'));
  expect('28 AR privacy title', ar.addFarm.privacyTitle.includes('خصوصية'));
}

console.log('\n— Preview / map rail —');
{
  expect('29 map preview component', existsSync(join(root, 'apps/web/src/components/owner/add-farm-onboarding/add-farm-map-preview.tsx')));
  expect('30 preferTextSummary on location step', wizard.includes('preferTextSummary={step === \'location\'}'));
  expect('31 listing preview uses jordanCityLabel', preview.includes('jordanCityLabel'));
  expect('32 middle-dot separator', preview.includes("' · '"));
  expect('33 PublicApproxLocation for off-step preview', mapPreview.includes('PublicApproxLocation'));
}

console.log('\n— Regression / freeze —');
{
  expect('34 search still excludes null location', search.includes('city: { not: null }'));
  expect('35 edit page OwnerPropertyForm', editPage.includes('OwnerPropertyForm'));
  expect('36 no AF-2 migration folder invent', !existsSync(join(migrationsDir, '20260830200000_af2')));
  expect('37 EN location tips', Boolean(en.addFarm.tips.location.a));
  expect('38 AR location tips', Boolean(ar.addFarm.tips.location.b));
  expect('39 city field label AR', ar.addFarm.fields.city === 'المدينة');
  expect('40 city field label EN', en.addFarm.fields.city === 'City');
  expect('41 wizard does not touch partner KYC', !wizard.includes('become-owner'));
  expect('42 approximateCoordsFromExact in privacy module', privacy.includes('approximateCoordsFromExact'));
}

console.log(`\nAF-2 Location QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
