/**
 * Phase AF-3 — Add Farm Photos & Amenities.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-add-farm-photos-amenities.ts
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AMENITY_KEYS,
  MIN_MEDIA_FOR_PUBLISH,
  MIN_MEDIA_FOR_SUBMIT_REVIEW,
  assessPropertyMedia,
  calculatePropertyOnboardingReadiness,
  hasCoverImage,
  isAddFarmPhotosComplete,
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

const photosStep = read(
  'apps/web/src/components/owner/add-farm-onboarding/steps/photos-amenities-step.tsx',
);
const wizard = read('apps/web/src/components/owner/add-farm-onboarding/add-farm-wizard.tsx');
const preview = read('apps/web/src/components/owner/add-farm-onboarding/add-farm-preview.tsx');
const mediaEditor = read('apps/web/src/components/owner/owner-property-media-editor.tsx');
const mediaService = read('apps/api/src/services/property-media/property-media.service.ts');
const mediaRules = read('packages/shared/src/property-media-rules.ts');
const onboarding = read('packages/shared/src/add-farm-onboarding.ts');
const pricingStep = read(
  'apps/web/src/components/owner/add-farm-onboarding/steps/pricing-availability-step.tsx',
);
const editPage = read('apps/web/src/app/[locale]/owner/properties/[id]/edit/page.tsx');
const publicMapper = read('apps/api/src/mappers/public-property.mapper.ts');
const search = read('apps/api/src/services/property-search.service.ts');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const migrationsDir = join(root, 'packages/db/prisma/migrations');

console.log('\n— Draft / property ID —');
{
  expect('1 photos step needs draft for upload', photosStep.includes('photosNeedDraft'));
  expect('2 OwnerPropertyMediaEditor only with propertyId', /propertyId \? \(/.test(photosStep));
  expect('3 Next validates photos need draft', wizard.includes("s === 'photos'") && wizard.includes('photosNeedDraft'));
  expect('4 same draft retained on next', wizard.includes("syncUrl(next, id)"));
}

console.log('\n— Upload architecture reuse —');
{
  expect('5 reuses OwnerPropertyMediaEditor', photosStep.includes('OwnerPropertyMediaEditor'));
  expect('6 sequential upload loop', mediaEditor.includes('for (const file of files)'));
  expect('7 jpeg/png/webp accept', mediaEditor.includes('image/jpeg,image/png,image/webp'));
  expect('8 MEDIA_LIMIT_REACHED handled', mediaEditor.includes('MEDIA_LIMIT_REACHED'));
  expect('9 max media 12 in service', mediaService.includes('MAX_MEDIA_PER_PROPERTY = 12'));
  expect('10 PROPERTY_MEDIA_NOT_OWNED guard', mediaService.includes('PROPERTY_MEDIA_NOT_OWNED'));
  expect('11 no KYC storage path', !photosStep.includes('kyc') && !mediaEditor.includes('kyc'));
}

console.log('\n— Cover semantics —');
{
  expect('12 cover is sortOrder === 0', mediaRules.includes('sortOrder === 0') && hasCoverImage([{ sortOrder: 0 }]));
  expect('13 isCover derived in service', mediaService.includes('isCover: m.sortOrder === 0'));
  expect('14 set cover API used', mediaEditor.includes('setOwnerPropertyMediaCover'));
  expect('15 cover badge in UI', mediaEditor.includes('mediaCoverPhoto'));
  expect('16 preview uses coverMediaUrl', wizard.includes('coverMediaUrl') && wizard.includes('isCover'));
  expect('17 first photo becomes sort 0 via getNextSortOrder', mediaService.includes('getNextSortOrder'));
}

console.log('\n— Order / delete —');
{
  expect('18 reorder endpoint used', mediaEditor.includes('reorderOwnerPropertyMedia'));
  expect('19 move up/down accessible', mediaEditor.includes('mediaMoveUp') && mediaEditor.includes('mediaMoveDown'));
  expect('20 delete uses owner API', mediaEditor.includes('deleteOwnerPropertyMedia'));
  expect('21 delete confirm optional', mediaEditor.includes('confirmDelete') && mediaEditor.includes('mediaDeleteConfirm'));
  expect('22 delete renorms sortOrder', mediaService.includes('data: { sortOrder: i }'));
  expect('23 failed upload keeps prior media', mediaEditor.includes('onMediaChange(current)'));
}

console.log('\n— Photo requirements —');
{
  expect('24 submit-review min is 1', MIN_MEDIA_FOR_SUBMIT_REVIEW === 1);
  expect('25 publish recommend min is 3', MIN_MEDIA_FOR_PUBLISH === 3);
  expect(
    '26 readiness photos complete at 1',
    isAddFarmPhotosComplete({ mediaCount: 1 }) === true,
  );
  expect(
    '27 readiness photos incomplete at 0',
    isAddFarmPhotosComplete({ mediaCount: 0 }) === false,
  );
  expect(
    '28 readiness does not require 3 for photos bucket',
    isAddFarmPhotosComplete({ mediaCount: 2 }) === true,
  );
  expect(
    '29 assess canSubmitReview at 1',
    assessPropertyMedia([{ sortOrder: 0 }]).canSubmitReview === true,
  );
  expect(
    '30 assess canPublish needs 3+cover',
    assessPropertyMedia([{ sortOrder: 0 }, { sortOrder: 1 }]).canPublish === false,
  );
  expect('31 Next uses MIN_MEDIA_FOR_SUBMIT_REVIEW', wizard.includes('MIN_MEDIA_FOR_SUBMIT_REVIEW'));
  expect('32 UI recommends publish count', photosStep.includes('MIN_MEDIA_FOR_PUBLISH') && photosStep.includes('photosRecommend'));
  expect('33 onboarding uses MIN_MEDIA_FOR_SUBMIT_REVIEW', onboarding.includes('MIN_MEDIA_FOR_SUBMIT_REVIEW'));
}

console.log('\n— Amenities —');
{
  expect('34 canonical AMENITY_KEYS', photosStep.includes('AMENITY_KEYS'));
  expect('35 amenity count matches catalog', AMENITY_KEYS.length === 11);
  expect('36 amenity PATCH via buildPatchPayload', wizard.includes('amenityKeys: form.amenityKeys'));
  expect('37 no per-amenity API', !photosStep.includes('updateOwnerProperty(') && !photosStep.includes('fetch('));
  expect('38 poolsCount on photos step', photosStep.includes('add-farm-pools'));
  expect('39 poolsCount removed from pricing step', !pricingStep.includes('poolsCount'));
  expect('40 pool amenity sync helper', photosStep.includes('POOL_AMENITY_KEYS') && photosStep.includes('syncPoolsWithAmenities'));
  expect('41 no allowsOvernight duplicate in photos', !photosStep.includes('allowsOvernight'));
  expect('42 selected amenity summary', photosStep.includes('amenitiesSelected'));
}

console.log('\n— Save Draft / Next —');
{
  expect('43 Save Draft allows partial (no photos validate)', /handleSaveDraft[\s\S]*step === 'basic' \|\| !propertyId/.test(wizard));
  expect('44 Save Draft does not submit review', !/handleSaveDraft[\s\S]{0,500}submitOwnerPropertyReview/.test(wizard));
  expect('45 Next validates photos', wizard.includes("if (s === 'photos')"));
  expect('46 Next advances to pricing step id', wizard.includes('ADD_FARM_STEPS'));
}

console.log('\n— Preview truthfulness —');
{
  expect('47 no stock farm image', !preview.includes('unsplash') && !preview.includes('stock'));
  expect('48 placeholder when no media', preview.includes('previewImagePlaceholder'));
  expect('49 no fake rating', !preview.includes('4.8') && !preview.includes('rating'));
  expect('50 no fake verification', !preview.includes('Verified') && !preview.includes('موثق'));
  expect('51 price only when set', preview.includes('previewPricePlaceholder'));
}

console.log('\n— Public safety / edit —');
{
  expect('52 search excludes null location drafts', search.includes('city: { not: null }'));
  expect('53 edit still OwnerPropertyForm', editPage.includes('OwnerPropertyForm'));
  expect('54 media editor shared with confirmDelete optional', mediaEditor.includes('confirmDelete = false'));
  expect('55 public mapper sorts media', publicMapper.includes('sortOrder') || publicMapper.includes('media'));
}

console.log('\n— i18n / a11y —');
{
  expect('56 EN photos heading', en.addFarm.photosHeading === 'Property photos');
  expect('57 AR photos heading', ar.addFarm.photosHeading === 'صور المزرعة');
  expect('58 EN amenities selected', Boolean(en.addFarm.amenitiesSelected));
  expect('59 AR amenities selected', Boolean(ar.addFarm.amenitiesSelected));
  expect('60 EN delete confirm', Boolean(en.ownerProperty.mediaDeleteConfirm));
  expect('61 AR delete confirm', Boolean(ar.ownerProperty.mediaDeleteConfirm));
  expect('62 media move aria labels', mediaEditor.includes('aria-label={t(\'mediaMoveUp\')}'));
  expect('63 amenity checkbox semantics', photosStep.includes('type="checkbox"') && photosStep.includes('aria-checked'));
}

console.log('\n— Schema / partner freeze —');
{
  const af3Migrations = readdirSync(migrationsDir).filter((d) => d.includes('af3') || d.includes('af-3'));
  expect('64 no AF-3 migration', af3Migrations.length === 0);
  expect('65 wizard does not touch partner KYC', !wizard.includes('partner-verification') && !wizard.includes('become-owner'));
  expect('66 no video upload in AF-3 step', !photosStep.includes('video/') && !photosStep.includes('type="video"'));
}

console.log('\n— Readiness calculation —');
{
  const withOnePhoto = calculatePropertyOnboardingReadiness({
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
  expect('67 one photo marks photos complete', withOnePhoto.photos === true);
  expect('68 one photo + all else is review ready', withOnePhoto.review === true);
  const noPhoto = calculatePropertyOnboardingReadiness({
    titleAr: 'مزرعة النخيل',
    descriptionAr: 'وصف قصير لمزرعة جميلة في عمان',
    type: 'farm',
    capacity: 12,
    city: 'amman',
    area: 'Airport',
    approximateAddress: 'Near airport road',
    exactAddress: 'Gate 12 exact',
    basePrice: 150,
    mediaCount: 0,
  });
  expect('69 zero photos incomplete', noPhoto.photos === false && noPhoto.review === false);
}

console.log(`\nAF-3 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
