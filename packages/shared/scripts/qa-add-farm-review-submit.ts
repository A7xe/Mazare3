/**
 * Phase AF-5 — Add Farm Review & Submit.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-add-farm-review-submit.ts
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MIN_MEDIA_FOR_PUBLISH,
  MIN_MEDIA_FOR_SUBMIT_REVIEW,
  calculatePropertyOnboardingReadiness,
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

const review = read(
  'apps/web/src/components/owner/add-farm-onboarding/steps/review-step.tsx',
);
const wizard = read('apps/web/src/components/owner/add-farm-onboarding/add-farm-wizard.tsx');
const actions = read('apps/web/src/components/owner/add-farm-onboarding/add-farm-actions.tsx');
const detail = read('apps/web/src/components/owner/owner-property-detail-view.tsx');
const submitService = read('apps/api/src/services/owner-property.service.ts');
const listing = read('packages/shared/src/property-listing-completeness.ts');
const mediaRules = read('packages/shared/src/property-media-rules.ts');
const onboarding = read('packages/shared/src/add-farm-onboarding.ts');
const search = read('apps/api/src/services/property-search.service.ts');
const adminService = read('apps/api/src/services/admin.service.ts');
const editPage = read('apps/web/src/app/[locale]/owner/properties/[id]/edit/page.tsx');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const migrationsDir = join(root, 'packages/db/prisma/migrations');

console.log('\n— Preview truthfulness —');
{
  expect('1 review needs draft messaging', review.includes('reviewNeedDraft') || wizard.includes('reviewNeedDraft'));
  expect('2 final preview uses real form/media', review.includes('add-farm-review-preview') && review.includes('form.titleAr'));
  expect('3 no fake rating', !review.includes('4.8') && !review.includes('rating'));
  expect('4 no fake verification', !review.includes('Verified') && !review.includes('موثق'));
  expect('5 no fake promotion', !review.includes('Sponsored') && !review.includes('promotional'));
  expect('6 unpublished badge', review.includes('unpublishedBadge') && review.includes('previewBeforePublish'));
  expect('7 From price semantics', review.includes("tCommon('from')") && review.includes('formatPrice'));
}

console.log('\n— Section summaries —');
{
  expect('8 basic summary + edit', review.includes('add-farm-review-basic') && review.includes("onEditStep('basic')"));
  expect('9 location public/private', review.includes('publicLocationTitle') && review.includes('privateLocationTitle'));
  expect('10 privacy body reused', review.includes('privacyBody'));
  expect('11 photos cover + thumbs', review.includes('coverPhotoLabel') && review.includes('orderedMedia'));
  expect('12 amenities canonical', review.includes('AMENITY_KEYS') || review.includes('amenity.'));
  expect('13 period prices from rules API', review.includes('fetchOwnerAvailabilityRules') && review.includes('add-farm-review-period-prices'));
  expect('14 deposit informational', review.includes('depositReviewNote') && !review.includes('depositPercent'));
  expect('15 no commission edit', !review.includes('platformCommission'));
}

console.log('\n— Dual checklists —');
{
  expect('16 ready for review section', review.includes('add-farm-ready-for-review'));
  expect('17 before live section', review.includes('add-farm-before-live'));
  expect('18 submit min media constant', review.includes('MIN_MEDIA_FOR_SUBMIT_REVIEW') && MIN_MEDIA_FOR_SUBMIT_REVIEW === 1);
  expect('19 publish min media constant', review.includes('MIN_MEDIA_FOR_PUBLISH') && MIN_MEDIA_FOR_PUBLISH === 3);
  expect('20 submit vs publish note', review.includes('submitVsPublishNote'));
  expect('21 missing basic → basic', review.includes("onEditStep('basic')"));
  expect('22 missing location → location', review.includes("onEditStep('location')"));
  expect('23 missing photos → photos', review.includes("onEditStep('photos')"));
  expect('24 missing price → pricing', review.includes("onEditStep('pricing')"));
}

console.log('\n— Readiness —');
{
  const openReviewOnly = calculatePropertyOnboardingReadiness({
    titleAr: 'مزرعة',
    descriptionAr: 'x'.repeat(20),
    type: 'farm',
    capacity: 10,
  });
  expect('25 opening review alone not 100%', openReviewOnly.percent < 100 && openReviewOnly.review === false);
  const full = calculatePropertyOnboardingReadiness({
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
  expect('26 100% when submit requirements met', full.percent === 100 && full.review);
  expect('27 review bucket = prior four complete', onboarding.includes('review = basic && location && photos && pricing'));
  expect('28 admin approval not in readiness', !onboarding.includes('pending_review') && !onboarding.includes('approved'));
}

console.log('\n— Submit behavior —');
{
  expect('29 submit uses submitOwnerPropertyReview', wizard.includes('submitOwnerPropertyReview'));
  expect('30 web does not PATCH status', !wizard.includes("status: 'pending_review'") && !wizard.includes("status: 'published'"));
  expect('31 server draft|changes_requested → pending_review', submitService.includes('pending_review') && submitService.includes('changes_requested'));
  expect('32 assertPropertyListingComplete on submit', submitService.includes('assertPropertyListingComplete'));
  expect('33 assertMediaForSubmitReview on submit', submitService.includes('assertMediaForSubmitReview'));
  expect('34 no generate on submit', !/handleSubmitReview[\s\S]{0,800}generateOwnerAvailability/.test(wizard));
  expect('35 double-submit guard saving', /handleSubmitReview[\s\S]*if \(saving \|\| creatingRef/.test(wizard));
  expect('36 redirect to owner detail', wizard.includes('/owner/properties/${id}?submitted=1') || wizard.includes('?submitted=1'));
  expect('37 Save Draft hidden on review', actions.includes('showSaveDraft') && wizard.includes("showSaveDraft={step !== 'review'}"));
  expect('38 CTA wording submit for review', en.addFarm.submitReview === 'Submit for review' && ar.addFarm.submitReview.includes('مراجعة'));
}

console.log('\n— After submit / public —');
{
  expect('39 success banner on detail', detail.includes('submittedForReviewTitle') && detail.includes('owner-property-submitted-banner'));
  expect('40 no SLA promise', !en.owner.submittedForReviewHint.includes('24') && !ar.owner.submittedForReviewHint.includes('24'));
  expect('41 search published only', search.includes('PropertyStatus.published'));
  expect('42 listing completeness shared', listing.includes('isPropertyListingCoreComplete'));
  expect('43 media rules submit vs publish', mediaRules.includes('MIN_MEDIA_FOR_SUBMIT_REVIEW') && mediaRules.includes('MIN_MEDIA_FOR_PUBLISH'));
  expect('44 edit route still OwnerPropertyForm', editPage.includes('OwnerPropertyForm'));
  expect('45 admin publish still guarded', adminService.includes('assertMediaForPublish') || adminService.includes('published'));
}

console.log('\n— What happens next / a11y —');
{
  expect('46 what happens next', review.includes('whatHappensNextTitle'));
  expect('47 accuracy note informational', review.includes('accuracyNote'));
  expect('48 aria-busy on submit', review.includes('aria-busy'));
  expect('49 checklist sr-only complete/incomplete', review.includes('sr-only'));
}

console.log('\n— i18n / schema / KYC —');
{
  expect('50 EN readyForReviewTitle', Boolean(en.addFarm.readyForReviewTitle));
  expect('51 AR readyForReviewTitle', Boolean(ar.addFarm.readyForReviewTitle));
  expect('52 EN submitted banner', Boolean(en.owner.submittedForReviewTitle));
  expect('53 AR submitted banner', ar.owner.submittedForReviewTitle.includes('مراجعة'));
  const af5Migrations = readdirSync(migrationsDir).filter((d) => /af[-_]?5/i.test(d));
  expect('54 no AF-5 migration', af5Migrations.length === 0);
  expect('55 wizard no partner KYC', !wizard.includes('partner-verification') && !wizard.includes('become-owner'));
  expect('56 no public draft fetch', !review.includes('/properties/') || !review.includes('fetchPublic'));
}

console.log(`\nAF-5 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
