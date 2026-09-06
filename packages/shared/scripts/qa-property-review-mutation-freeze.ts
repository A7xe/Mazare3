/**
 * Phase PR-3 — Freeze owner listing mutations while pending_review.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-property-review-mutation-freeze.ts
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isOwnerPropertyEditableStatus,
  isOwnerReviewContentMutableStatus,
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

const guards = read('apps/api/src/lib/owner-property-mutation-guards.ts');
const ownerProperty = read('apps/api/src/services/owner-property.service.ts');
const media = read('apps/api/src/services/property-media/property-media.service.ts');
const ownerService = read('apps/api/src/services/owner.service.ts');
const adminService = read('apps/api/src/services/admin.service.ts');
const detail = read('apps/web/src/components/owner/owner-property-detail-view.tsx');
const form = read('apps/web/src/components/owner/owner-property-form.tsx');
const list = read('apps/web/src/components/owner/owner-properties-view.tsx');
const availView = read('apps/web/src/components/owner/owner-availability-view.tsx');
const availSched = read('apps/web/src/components/owner/owner-availability-schedule.tsx');
const sharedOnboarding = read('packages/shared/src/schemas/owner-onboarding.ts');
const addFarmWizard = read('apps/web/src/components/owner/add-farm-onboarding/add-farm-wizard.tsx');
const partnerShell = existsSync(
  join(root, 'apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-shell.tsx'),
)
  ? read('apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-shell.tsx')
  : '';
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const migrationsDir = join(root, 'packages/db/prisma/migrations');

console.log('\n— Shared helpers —');
{
  expect('1 draft editable', isOwnerPropertyEditableStatus('draft'));
  expect('2 changes_requested editable', isOwnerPropertyEditableStatus('changes_requested'));
  expect('3 pending_review not editable', !isOwnerPropertyEditableStatus('pending_review'));
  expect('4 pending_review content not mutable', !isOwnerReviewContentMutableStatus('pending_review'));
  expect('5 draft content mutable', isOwnerReviewContentMutableStatus('draft'));
  expect('6 published content mutable', isOwnerReviewContentMutableStatus('published'));
  expect('7 changes_requested content mutable', isOwnerReviewContentMutableStatus('changes_requested'));
  expect('8 helper exported', sharedOnboarding.includes('isOwnerReviewContentMutableStatus'));
}

console.log('\n— Core / location / booking mode —');
{
  expect('9 assertOwnerCanEditListingStatus exists', guards.includes('assertOwnerCanEditListingStatus'));
  expect('10 assertOwnerNotPendingReview exists', guards.includes('assertOwnerNotPendingReview'));
  expect(
    '11 location-only bypass removed',
    !ownerProperty.includes('if (!locationOnly)') && !ownerProperty.includes('locationOnly'),
  );
  expect(
    '12 core update always asserts listing editable',
    ownerProperty.includes('assertOwnerCanEditListingStatus(existing.status)'),
  );
  expect(
    '13 booking mode frozen while pending_review',
    /bookingModeOnly[\s\S]*assertOwnerNotPendingReview\(existing\.status\)/.test(ownerProperty),
  );
  expect('14 PROPERTY_NOT_EDITABLE code', guards.includes("PROPERTY_NOT_EDITABLE"));
}

console.log('\n— Media —');
{
  expect('15 media assert loads status', media.includes('select: { id: true, status: true }'));
  expect('16 media calls assertOwnerNotPendingReview', media.includes('assertOwnerNotPendingReview(property.status)'));
  expect('17 upload path uses assertCanManageProperty', media.includes('assertCanManageProperty'));
  expect('18 delete uses assertCanManageProperty', /deletePropertyMedia[\s\S]*assertCanManageProperty/.test(media));
  expect('19 cover uses assertCanManageProperty', /setPropertyMediaCover[\s\S]*assertCanManageProperty/.test(media));
  expect('20 reorder uses assertCanManageProperty', /reorderPropertyMedia[\s\S]*assertCanManageProperty/.test(media));
}

console.log('\n— Availability —');
{
  expect('21 put rules guarded', /putOwnerAvailabilityRules[\s\S]*assertOwnerCanMutateAvailability/.test(ownerService));
  expect('22 delete rule guarded', /deleteOwnerAvailabilityRule[\s\S]*assertOwnerCanMutateAvailability/.test(ownerService));
  expect('23 generate guarded', /generateOwnerAvailability[\s\S]*assertOwnerCanMutateAvailability/.test(ownerService));
  expect('24 apply-future guarded', /applyOwnerRuleToFuture[\s\S]*assertOwnerCanMutateAvailability/.test(ownerService));
  expect('25 slot patch checks pending_review', /patchOwnerAvailabilitySlot[\s\S]*assertOwnerNotPendingReview/.test(ownerService));
  expect('26 list/get still use assertPropertyAccess only for read', ownerService.includes('await assertPropertyAccess(scope, propertyId)'));
  expect('27 admin publish generate untouched', adminService.includes('assertAndGenerateForPublish'));
}

console.log('\n— UI —');
{
  expect('28 pending frozen hint on detail', detail.includes('owner-property-pending-frozen-hint'));
  expect('29 availability CTA hidden when pending', detail.includes('owner-property-availability-frozen'));
  expect('30 edit form pending freeze banner', form.includes('owner-edit-pending-frozen'));
  expect('31 media editor disabled when not mutable', form.includes('disabled={saving || !mediaMutable}'));
  expect('32 list hides availability for pending', list.includes('isOwnerReviewContentMutableStatus(p.status)'));
  expect('33 schedule readOnly prop', availSched.includes('readOnly'));
  expect('34 availability view passes readOnly', availView.includes('readOnly={!availabilityMutable}'));
}

console.log('\n— Out of scope / regressions —');
{
  expect('35 no new PR-3 migration', !readdirSync(migrationsDir).some((d) => /pr[-_]?3/i.test(d)));
  expect('36 Add Farm wizard no freeze redesign', !addFarmWizard.includes('assertOwnerNotPendingReview'));
  expect('37 partner shell untouched', !partnerShell.includes('assertOwnerNotPendingReview'));
  expect('38 PR-2 reason panel still present', detail.includes('owner-property-changes-requested-panel'));
  expect('39 EN pendingReviewFrozenHint', Boolean(en.owner?.pendingReviewFrozenHint));
  expect('40 AR pendingReviewFrozenHint', Boolean(ar.owner?.pendingReviewFrozenHint));
  expect('41 published still mutable helper', isOwnerReviewContentMutableStatus('published'));
  expect('42 approved still mutable helper', isOwnerReviewContentMutableStatus('approved'));
}

console.log(`\nPR-3 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
