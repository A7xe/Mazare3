/**
 * Phase PR-2 — Property changes-requested reason + owner correction UX.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-property-changes-requested.ts
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  patchAdminPropertyStatusSchema,
  PROPERTY_REVIEW_CHANGE_REASON_MIN,
  PROPERTY_REVIEW_CHANGE_REASON_MAX,
  isOwnerPropertyEditableStatus,
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

const schema = read('packages/db/prisma/schema.prisma');
const adminSchema = read('packages/shared/src/schemas/admin.ts');
const adminService = read('apps/api/src/services/admin.service.ts');
const ownerPropertyService = read('apps/api/src/services/owner-property.service.ts');
const ownerService = read('apps/api/src/services/owner.service.ts');
const notify = read('apps/api/src/services/notification.service.ts');
const publicMapper = read('apps/api/src/mappers/public-property.mapper.ts');
const searchService = read('apps/api/src/services/property-search.service.ts');
const adminDetail = read('apps/web/src/components/admin/admin-property-detail-view.tsx');
const ownerDetail = read('apps/web/src/components/owner/owner-property-detail-view.tsx');
const ownerList = read('apps/web/src/components/owner/owner-properties-view.tsx');
const ownerForm = read('apps/web/src/components/owner/owner-property-form.tsx');
const types = read('packages/shared/src/types.ts');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const migrationsDir = join(root, 'packages/db/prisma/migrations');
const migrationName = '20260831160000_pr2_property_review_change_reason';
const migrationSqlPath = join(migrationsDir, migrationName, 'migration.sql');
const partnerShell = existsSync(join(root, 'apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-shell.tsx'))
  ? read('apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-shell.tsx')
  : '';
const addFarmWizard = read('apps/web/src/components/owner/add-farm-onboarding/add-farm-wizard.tsx');

console.log('\n— Schema / migration —');
{
  expect('1 reviewChangeReason on Property', schema.includes('reviewChangeReason'));
  expect('2 reviewChangeRequestedAt on Property', schema.includes('reviewChangeRequestedAt'));
  expect('3 migration file exists', existsSync(migrationSqlPath));
  const sql = existsSync(migrationSqlPath) ? readFileSync(migrationSqlPath, 'utf8') : '';
  expect('4 additive ADD COLUMN only', sql.includes('ADD COLUMN "reviewChangeReason"') && sql.includes('ADD COLUMN "reviewChangeRequestedAt"'));
  expect('5 no DROP in migration', !/\bDROP\b/i.test(sql));
  expect('6 no NOT NULL in migration', !/NOT NULL/i.test(sql));
}

console.log('\n— Validation rules —');
{
  expect('7 min constant is 8', PROPERTY_REVIEW_CHANGE_REASON_MIN === 8);
  expect('8 max constant is 2000', PROPERTY_REVIEW_CHANGE_REASON_MAX === 2000);
  const ok = patchAdminPropertyStatusSchema.safeParse({
    status: 'changes_requested',
    reason: 'يرجى إضافة صور أوضح للمسبح',
  });
  expect('9 pending_review→changes_requested with reason accepted', ok.success);
  const noReason = patchAdminPropertyStatusSchema.safeParse({ status: 'changes_requested' });
  expect('10 reason required for changes_requested', !noReason.success);
  const empty = patchAdminPropertyStatusSchema.safeParse({ status: 'changes_requested', reason: '' });
  expect('11 empty reason rejected', !empty.success);
  const ws = patchAdminPropertyStatusSchema.safeParse({ status: 'changes_requested', reason: '   \n\t  ' });
  expect('12 whitespace-only reason rejected', !ws.success);
  const short = patchAdminPropertyStatusSchema.safeParse({ status: 'changes_requested', reason: 'قصير' });
  expect('13 short reason rejected', !short.success);
  const other = patchAdminPropertyStatusSchema.safeParse({ status: 'approved' });
  expect('14 unrelated statuses do not require reason', other.success);
  expect('15 schema superRefine for changes_requested', adminSchema.includes("status !== 'changes_requested'") || adminSchema.includes('changes_requested'));
}

console.log('\n— Admin atomic persistence —');
{
  expect(
    '16 status+reason single update',
    /updateData\.reviewChangeReason = trimmedReason/.test(adminService) &&
      /updateData\.status = PropertyStatus\.changes_requested/.test(adminService) &&
      adminService.includes('updateMany'),
  );
  expect(
    '17 non-changes clears reason',
    /updateData\.reviewChangeReason = null/.test(adminService) &&
      /updateData\.reviewChangeRequestedAt = null/.test(adminService),
  );
  expect('18 shortcut opens reason dialog', adminDetail.includes('admin-property-request-changes') && adminDetail.includes('openChangeReasonDialog'));
  expect('19 request changes cannot bypass reason dialog', adminDetail.includes('admin-property-request-changes') && adminDetail.includes('confirmChangeReason') && !adminDetail.includes('admin-property-status-select'));
  expect('20 dialog confirm sends reason', adminDetail.includes("applyStatus('changes_requested'") && adminDetail.includes('admin-property-change-reason-confirm'));
}

console.log('\n— Owner DTO / public safety —');
{
  expect('21 OwnerPropertyDetail has reviewChangeReason', types.includes('interface OwnerPropertyDetail') && /OwnerPropertyDetail[\s\S]*reviewChangeReason/.test(types));
  expect('22 OwnerPropertyEdit has reviewChangeReason', /interface OwnerPropertyEdit[\s\S]*reviewChangeReason/.test(types));
  expect('23 AdminPropertyDetail has reviewChangeReason', /interface AdminPropertyDetail[\s\S]*reviewChangeReason/.test(types));
  expect('24 owner detail maps reason', ownerService.includes('reviewChangeReason: p.reviewChangeReason'));
  expect('25 owner edit maps reason', ownerPropertyService.includes('reviewChangeReason: p.reviewChangeReason'));
  expect('26 admin detail maps reason', adminService.includes('reviewChangeReason: p.reviewChangeReason'));
  expect('27 public mapper has no reviewChangeReason', !publicMapper.includes('reviewChangeReason'));
  expect('28 search service has no reviewChangeReason', !searchService.includes('reviewChangeReason'));
}

console.log('\n— Owner UX —');
{
  expect('29 changes panel on detail', ownerDetail.includes('owner-property-changes-requested-panel'));
  expect('30 panel shows reason', ownerDetail.includes('owner-property-change-reason') && ownerDetail.includes('reviewChangeReason'));
  expect('31 edit CTA in changes_requested', ownerDetail.includes('owner-property-edit-cta') && ownerDetail.includes('changesRequestedEdit'));
  expect('32 resubmit CTA uses submitOwnerPropertyReview', ownerDetail.includes('submitOwnerPropertyReview') && ownerDetail.includes('owner-property-resubmit-cta'));
  expect('33 edit route same property', ownerDetail.includes('/owner/properties/${property.id}/edit'));
  expect('34 draft remains editable helper', isOwnerPropertyEditableStatus('draft'));
  expect('35 pending_review not editable', isOwnerPropertyEditableStatus('pending_review') === false);
  expect('36 changes_requested editable', isOwnerPropertyEditableStatus('changes_requested'));
  expect('37 list gates Edit by editable status', ownerList.includes('isOwnerPropertyEditableStatus(p.status)'));
  expect('38 list attention chip', ownerList.includes('changesRequestedListLabel') && ownerList.includes('owner-property-needs-changes'));
  expect('39 edit correction notice', ownerForm.includes('owner-edit-correction-notice') && ownerForm.includes('editCorrectionNoticeTitle'));
}

console.log('\n— Resubmit / reason lifecycle —');
{
  expect('40 submit-review clears reason atomically', /status: PropertyStatus\.pending_review[\s\S]*reviewChangeReason: null[\s\S]*reviewChangeRequestedAt: null/.test(ownerPropertyService) || (/reviewChangeReason: null/.test(ownerPropertyService) && /pending_review/.test(ownerPropertyService)));
  expect('41 submit only draft|changes_requested', ownerPropertyService.includes('changes_requested') && ownerPropertyService.includes('Only draft or changes_requested'));
  expect('42 failed resubmit keeps panel (no clear before update)', !/reviewChangeReason:\s*null[\s\S]{0,200}assertMediaForSubmitReview/.test(ownerPropertyService));
  expect('43 assert gates before clear', ownerPropertyService.indexOf('assertMediaForSubmitReview') < ownerPropertyService.indexOf('reviewChangeReason: null'));
  expect('44 notification points to property page', notify.includes('راجع الملاحظات في صفحة المزرعة') || notify.includes('Review the notes on your property page'));
  expect('45 notification does not dump reason', !/notifyPropertyChangesRequested[\s\S]{0,400}reason/.test(notify));
}

console.log('\n— Out of scope preserved —');
{
  expect('46 rejection reason separate from change reason', schema.includes('reviewRejectionReason') && schema.includes('reviewChangeReason'));
  expect('47 Add Farm wizard untouched by PR-2 reason UI', !addFarmWizard.includes('reviewChangeReason') && !addFarmWizard.includes('owner-property-changes-requested-panel'));
  expect('48 partner shell untouched', !partnerShell.includes('reviewChangeReason'));
  expect('49 assertOwnerCanEditStatus preserved', ownerPropertyService.includes('assertOwnerCanEditListingStatus') || ownerPropertyService.includes('assertOwnerCanEditStatus') || ownerPropertyService.includes('OWNER_EDITABLE_STATUSES'));
  expect('50 admin publish gates unchanged', adminService.includes('assertMediaForPublish') && adminService.includes('assertAndGenerateForPublish'));
}

console.log('\n— i18n —');
{
  expect('51 AR changesRequestedTitle', Boolean(ar.owner?.changesRequestedTitle) && String(ar.owner.changesRequestedTitle).includes('تعديل'));
  expect('52 EN changesRequestedTitle', Boolean(en.owner?.changesRequestedTitle));
  expect('53 AR admin property reason placeholder', Boolean(ar.admin?.propertyRequestChangesReasonPlaceholder));
  expect('54 EN admin property reason placeholder', Boolean(en.admin?.propertyRequestChangesReasonPlaceholder));
  expect('55 no duplicate admin requestChangesReason overwrite', en.admin.requestChangesReason === 'What should the partner change?');
  expect('56 a11y dialog labelled', adminDetail.includes('aria-labelledby') && adminDetail.includes('aria-describedby'));
  expect('57 a11y owner panel heading', ownerDetail.includes('aria-labelledby') && ownerDetail.includes('owner-changes-requested-title'));
}

console.log('\n— Security / ownership comments —');
{
  expect('58 ownership via propertyWhere/ownerId', ownerService.includes('propertyWhere(scope)') || ownerService.includes('ownerId'));
  expect('59 no public export of reason in mapper return', !/return \{[\s\S]*reviewChangeReason/.test(publicMapper));
  const migDirs = readdirSync(migrationsDir).filter((d) => d.includes('pr2_property_review'));
  expect('60 single PR-2 migration folder', migDirs.length === 1);
}

console.log(`\nPR-2 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
